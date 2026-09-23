/**
 * Adapter between our React layer and the restored diorama source
 * (`src/scene/diorama/*`).
 *
 * It describes the shape of the scene handle (`bootDiorama()`'s return value,
 * also published as `window.__DIORAMA` for the diagnostic scripts) and owns the
 * water-parameter / quality-preset surface used by `src/ui/WaterPanel.tsx`.
 *
 * NOTE: this module deliberately does NOT import `three`. The diorama source
 * uses the project's three (0.169, ESM) while `src/_legacy_experience` was built
 * against the same copy — but keeping this file free of three types means the UI
 * layer can never accidentally depend on the runtime and stays cheap to import.
 */

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

interface BundleVec3 extends Vec3Like {
  lerp(v: Vec3Like, alpha: number): void;
  copy(v: Vec3Like): void;
  set(x: number, y: number, z: number): void;
}

export interface DioramaHandle {
  camera: {
    position: BundleVec3;
    near: number;
    far: number;
    updateProjectionMatrix(): void;
  };
  controls: {
    target: BundleVec3;
    enabled: boolean;
    enableDamping: boolean;
    dampingFactor: number;
    rotateSpeed: number;
    zoomSpeed: number;
    panSpeed: number;
    autoRotate: boolean;
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    update(): void;
  };
  renderer: {
    info: { render: { calls: number; frame: number } };
    setPixelRatio(v: number): void;
    domElement: HTMLCanvasElement;
    shadowMap: { autoUpdate: boolean; needsUpdate: boolean; type: number };
  };
  post: {
    composite: { material: { uniforms: Record<string, { value: number }> } };
  };
  ground: {
    uniforms: Record<string, { value: number }>;
    maxSize: number;
    rt: { width: number; height: number };
  };
  rain: { setAmount(v: number): void };
  fitCamera(azDeg: number, elDeg: number, dist: number): void;
}

/** the live handle, as published by `bootDiorama()` */
export function getDiorama(): DioramaHandle | null {
  return (window as unknown as { __DIORAMA?: DioramaHandle }).__DIORAMA ?? null;
}

/* ------------------------------------------------------------------ */
/* Water panel parameters                                              */
/* ------------------------------------------------------------------ */

export type WaterKey = "wave" | "rip" | "refl" | "dark" | "spark" | "pool" | "rain" | "expo";

export interface WaterParamSpec {
  key: WaterKey;
  label: string;
  min: number;
  max: number;
  step: number;
  /** decimal places for the readout */
  dp: number;
  /** scene default, as applied by bootDiorama() when no URL override is present */
  default: number;
}

export const WATER_PARAMS: WaterParamSpec[] = [
  { key: "wave", label: "波纹强度", min: 0, max: 1.6, step: 0.01, dp: 2, default: 0.6 },
  { key: "rip", label: "雨点涟漪", min: 0, max: 2, step: 0.01, dp: 2, default: 1 },
  { key: "refl", label: "反射亮度", min: 0, max: 1.6, step: 0.01, dp: 2, default: 0.85 },
  { key: "dark", label: "水面暗度", min: 0, max: 1, step: 0.01, dp: 2, default: 0.55 },
  { key: "spark", label: "波峰高光", min: 0, max: 0.2, step: 0.005, dp: 3, default: 0.02 },
  { key: "pool", label: "地面灯光", min: 0, max: 2.5, step: 0.05, dp: 2, default: 1.2 },
  { key: "rain", label: "雨量", min: 0, max: 1.5, step: 0.05, dp: 2, default: 1 },
  { key: "expo", label: "曝光", min: 0.6, max: 2.2, step: 0.02, dp: 2, default: 1.62 },
];

/** which ground uniform each key maps to (rain / expo are handled separately) */
const UNIFORM_OF: Partial<Record<WaterKey, string>> = {
  wave: "uWaveScale",
  rip: "uRipAmp",
  refl: "uReflStrength",
  dark: "uWaterDark",
  spark: "uSparkle",
  pool: "uPoolStrength",
};

export function applyWaterParam(dio: DioramaHandle | null, key: WaterKey, value: number): void {
  if (!dio) return;
  const uniformName = UNIFORM_OF[key];
  if (uniformName) {
    const target = dio.ground.uniforms[uniformName];
    if (target) target.value = value;
    return;
  }
  if (key === "rain") {
    dio.rain.setAmount(value);
    return;
  }
  if (key === "expo") {
    const u = dio.post.composite.material.uniforms.uExposure;
    if (u) u.value = value;
  }
}

/**
 * Current effective values.
 *
 * Read straight from the live scene: `bootDiorama()` already applied any URL
 * override (`?wave=1.4`, `?refl=…`) to the uniforms, so the uniforms *are* the
 * source of truth. `rain` is the one exception — the rain system only exposes
 * `setAmount()` with no getter, so it falls back to the URL param / default.
 */
export function readWaterParams(dio: DioramaHandle | null): Record<WaterKey, number> {
  const out = {} as Record<WaterKey, number>;
  for (const spec of WATER_PARAMS) {
    let value: number | null = null;

    if (dio) {
      const uniformName = UNIFORM_OF[spec.key];
      if (uniformName) {
        const target = dio.ground.uniforms[uniformName];
        if (target) value = target.value;
      } else if (spec.key === "rain") {
        // no getter available — URL param wins, otherwise the documented default
        value = queryNumber("rain", spec.default);
      } else if (spec.key === "expo") {
        value = dio.post.composite.material.uniforms.uExposure?.value ?? null;
      }
    }

    out[spec.key] = value ?? spec.default;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Quality presets                                                     */
/* ------------------------------------------------------------------ */

export type QualityPreset = "smooth" | "balanced" | "sharp";

export interface QualitySpec {
  key: QualityPreset;
  label: string;
  /** device pixel ratio cap */
  dpr: number;
  /** planar-reflection render target cap (px, square) */
  reflect: number;
}

/**
 * The diorama is fill-rate bound: it draws the scene twice (a full planar
 * reflection pass on top of the main pass), then runs a bloom composite, all at
 * full device resolution. On fill-rate limited GPUs (Apple silicon laptops in
 * particular) the pixel count is what decides the frame rate — so these three
 * presets mostly trade resolution, and the reflection target size, for speed.
 */
export const QUALITY_PRESETS: QualitySpec[] = [
  { key: "smooth", label: "流畅", dpr: 1.25, reflect: 384 },
  { key: "balanced", label: "均衡", dpr: 1.75, reflect: 640 },
  { key: "sharp", label: "品质", dpr: 2, reflect: 896 },
];

export function getQualitySpec(preset: QualityPreset): QualitySpec {
  return QUALITY_PRESETS.find((p) => p.key === preset) ?? QUALITY_PRESETS[1];
}

/** absolute ceilings so a phone never tries to render a 2× 896² reflection */
const QUALITY_CAP = {
  desktop: { dpr: 2, reflect: 896 },
  mobile: { dpr: 1.5, reflect: 512 },
};

/**
 * Apply a quality preset to the running scene.
 * Safe to call repeatedly (preset switches dispatch a resize, which the scene
 * handles by resizing the post targets and the reflection target).
 */
export function applyQualityPreset(dio: DioramaHandle | null, preset: QualityPreset, isMobile: boolean): void {
  if (!dio) return;
  const spec = getQualitySpec(preset);
  const cap = isMobile ? QUALITY_CAP.mobile : QUALITY_CAP.desktop;
  const dpr = Math.min(window.devicePixelRatio || 1, spec.dpr, cap.dpr);

  dio.renderer.setPixelRatio(dpr);
  dio.ground.maxSize = Math.min(spec.reflect, cap.reflect);
  window.dispatchEvent(new Event("resize"));
}

/* ------------------------------------------------------------------ */
/* Query params (the scene understands quite a few)                    */
/* ------------------------------------------------------------------ */

export function hasQueryFlag(name: string): boolean {
  return new URLSearchParams(location.search).has(name);
}

export function queryNumber(name: string, fallback: number): number {
  const params = new URLSearchParams(location.search);
  if (!params.has(name)) return fallback;
  const parsed = parseFloat(params.get(name) as string);
  return Number.isNaN(parsed) ? fallback : parsed;
}

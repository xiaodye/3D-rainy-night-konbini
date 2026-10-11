/**
 * React 层与还原后的场景源码（`src/scene/diorama/*`）之间的适配器。
 *
 * 它描述场景句柄的形状（`bootDiorama()` 的返回值，同时也发布为
 * `window.__DIORAMA` 供诊断脚本使用），并拥有 `src/ui/WaterPanel.tsx`
 * 所需的水面参数 / 画质档位接口。
 *
 * 注意：本模块刻意**不** import `three`。场景源码用的是项目里的 three
 * (0.169, ESM)，`src/_legacy_experience` 也基于同一份副本 —— 但让本文件
 * 不涉及 three 类型，意味着 UI 层不可能意外依赖运行时，import 成本也低。
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
    /** 合成 pass 的 uniform —— 其中 `uExposure` 由 UI 驱动 */
    composite: { material: { uniforms: Record<string, { value: any }> } };
  };
  ground: {
    /**
     * 这里只声明面板会写入的水面 uniform。场景自身的 `GroundUniforms`
     * 是它的超集，因此可以互相赋值 —— 注意 `interface` 永远不会获得隐式索引
     * 签名，所以正是这个键联合上的 mapped type 让两端对得上。
     */
    uniforms: Record<WaterUniformKey, { value: number }>;
    /** 反射 target 的像素上限（可选：场景有自己的默认值） */
    maxSize?: number;
    rt: { width: number; height: number };
  };
  rain: { setAmount(v: number): void };
  fitCamera(azDeg: number, elDeg: number, dist: number): void;
}

/** 活动句柄，由 `bootDiorama()` 发布 */
export function getDiorama(): DioramaHandle | null {
  return (window as unknown as { __DIORAMA?: DioramaHandle }).__DIORAMA ?? null;
}

/* ------------------------------------------------------------------ */
/* 水面面板参数                                                        */
/* ------------------------------------------------------------------ */

export type WaterKey = "wave" | "rip" | "refl" | "dark" | "spark" | "pool" | "rain" | "expo";

/** 水面面板写入的地面 uniform（shader uniform 全集的一个子集） */
export type WaterUniformKey =
  | "uWaveScale"
  | "uRipAmp"
  | "uReflStrength"
  | "uWaterDark"
  | "uSparkle"
  | "uPoolStrength";

export interface WaterParamSpec {
  key: WaterKey;
  label: string;
  min: number;
  max: number;
  step: number;
  /** 读数保留的小数位 */
  dp: number;
  /** 场景默认值：无 URL 覆盖时由 bootDiorama() 应用 */
  default: number;
}

export const WATER_PARAMS: WaterParamSpec[] = [
  { key: "wave", label: "波纹强度", min: 0, max: 1.6, step: 0.01, dp: 2, default: 0.6 },
  { key: "rip", label: "雨点涟漪", min: 0, max: 2, step: 0.01, dp: 2, default: 1 },
  { key: "refl", label: "反射亮度", min: 0, max: 1.6, step: 0.01, dp: 2, default: 0.85 },
  { key: "dark", label: "水面暗度", min: 0, max: 1, step: 0.01, dp: 2, default: 0.55 },
  { key: "spark", label: "波峰高光", min: 0, max: 0.2, step: 0.005, dp: 3, default: 0.02 },
  // 这是叠加光池的增益：可用区间很小，滑块步长取得很细，
  // 便于在低端做微调（shader 已对光池做软饱和）
  { key: "pool", label: "地面灯光", min: 0, max: 0.5, step: 0.005, dp: 3, default: 0.06 },
  { key: "rain", label: "雨量", min: 0, max: 1.5, step: 0.05, dp: 2, default: 1 },
  { key: "expo", label: "曝光", min: 0.6, max: 2.2, step: 0.02, dp: 2, default: 1.62 },
];

/** 每个键对应的地面 uniform（rain / expo 单独处理） */
const UNIFORM_OF: Partial<Record<WaterKey, WaterUniformKey>> = {
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
 * 当前生效的参数值。
 *
 * 直接从活动场景读取：`bootDiorama()` 已把 URL 覆盖（`?wave=1.4`、`?refl=…`）
 * 应用到 uniform，所以 uniform *就是* 唯一真相。`rain` 是唯一例外 ——
 * 雨系统只暴露 `setAmount()` 而没有 getter，因此回退到 URL 参数 / 默认值。
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
        // 没有可用的 getter —— URL 参数优先，否则用文档里的默认值
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
/* 画质档位                                                            */
/* ------------------------------------------------------------------ */

export type QualityPreset = "smooth" | "balanced" | "sharp";

export interface QualitySpec {
  key: QualityPreset;
  label: string;
  /** device pixel ratio 上限 */
  dpr: number;
  /** 平面反射 render target 的尺寸上限（像素，正方形） */
  reflect: number;
}

/**
 * 这个 diorama 是 fill-rate 受限的：它要画两遍场景（主 pass 之上还有一遍完整的
 * 平面反射），再做 bloom 合成，且全部按设备全分辨率。在 fill-rate 吃紧的 GPU 上
 * （尤其是 Apple silicon 笔记本），决定帧率的就是像素数量 ——
 * 所以这三档主要是在分辨率与反射 target 尺寸上换速度。
 */
export const QUALITY_PRESETS: QualitySpec[] = [
  { key: "smooth", label: "流畅", dpr: 1.25, reflect: 384 },
  { key: "balanced", label: "均衡", dpr: 1.75, reflect: 640 },
  { key: "sharp", label: "品质", dpr: 2, reflect: 896 },
];

export function getQualitySpec(preset: QualityPreset): QualitySpec {
  return QUALITY_PRESETS.find((p) => p.key === preset) ?? QUALITY_PRESETS[1];
}

/** 绝对上限，避免手机去渲染 2× 896² 的反射 */
const QUALITY_CAP = {
  desktop: { dpr: 2, reflect: 896 },
  mobile: { dpr: 1.5, reflect: 512 },
};

/**
 * 把画质档位应用到正在运行的场景。
 * 可反复调用（切换档位会派发 resize，场景据此重设后处理与反射 target 的尺寸）。
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
/* URL 查询参数（场景支持的相当多）                                     */
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

/*
 * 还原自打包产物 diorama（见 docs/source-restore.md）。
 *
 * 这里是原本的装配入口（上游项目的 `src/main.js`），机械转换为 ES module。
 * 相较打包版本有两处刻意改动：
 *
 *   1. 改为暴露 `bootDiorama()`，而不再依赖 <script> 标签的副作用执行，
 *      于是由 React 决定场景何时创建。
 *   2. 上游自带的调参面板 DOM 已移除 —— 由我们的 React 面板
 *      （src/ui/WaterPanel.tsx）接管。过去经它灌进水 uniform 的 URL 参数
 *      现在直接生效，因此 `?wave=1.4` 之类的用法与从前完全一致。
 *      MSAA 默认值也从 4 下调为 2（见 docs/performance-report.md）。
 *
 * TYPED ✓ — 见 docs/source-restore.md。
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { Builder } from "./toon";
import { buildSky } from "./sky";
import { buildGround } from "./ground";
import { buildStore } from "./store";
import { buildProps } from "./props";
import { buildRain } from "./rain";
import { PostFX } from "./postfx";
import type { BuildStats } from "./toon";
import type { Sky } from "./sky";
import type { StoreHandle } from "./store";
import type { PropsHandle } from "./props";
import type { RainHandle } from "./rain";
import type { DioramaHandle } from "./adapter";

// 再导出 adapter 接口，让 `from './diorama'` 的用法继续可用
export * from "./adapter";

declare global {
  interface Window {
    /** 由 bootDiorama() 发布，供诊断脚本与截图工具读取 */
    __DIORAMA?: DioramaScene;
  }
}

/**
 * 调用方（或诊断脚本）可能想访问的一切。
 * 是 `DioramaHandle` 的超集 —— 后者是 UI 所需的最小接口。
 */
export interface DioramaScene extends DioramaHandle {
  scene: THREE.Scene;
  stats: BuildStats;
  sky: Sky;
  store: StoreHandle;
  props: PropsHandle;
  rain: RainHandle;
  THREE: typeof THREE;
}

let handle: DioramaScene | null = null;

/**
 * 构建 diorama 并启动渲染循环。幂等：重复调用返回同一个句柄
 * （React StrictMode 在开发环境会双挂载 effect）。
 *
 * 需要文档中存在 `<canvas id="scene">`。
 */
export function bootDiorama(): DioramaScene {
  if (handle) return handle;

  // --- URL 查询参数（调试视图 / 确定性截图） --------------------------------
  const qs = new URLSearchParams(location.search);
  const num = (k: string, d: number): number => (qs.has(k) ? parseFloat(qs.get(k) as string) : d);

  // --- 渲染器 ----------------------------------------------------------------
  const canvas = document.getElementById("scene") as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
    alpha: false,
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // 在合成 pass 里做调色
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = true;

  // --- 场景 ------------------------------------------------------------------
  const scene = new THREE.Scene();
  const FOG = { color: new THREE.Color(0x0b1220), density: 0.0125 };
  scene.fog = new THREE.FogExp2(FOG.color, FOG.density);

  const camera = new THREE.PerspectiveCamera(31, innerWidth / innerHeight, 1.0, 320);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.85;
  controls.panSpeed = 0.7;
  controls.screenSpacePanning = false;
  controls.minDistance = 7;
  controls.maxDistance = 78;
  controls.minPolarAngle = 0.1;
  controls.maxPolarAngle = 1.47;
  controls.target.set(1.6, 1.05, -1.8);

  // --- 灯光 ------------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0x3f548a, 0x2a2620, 1.45);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0x35497a, 0.85);
  scene.add(ambient);

  const moon = new THREE.DirectionalLight(0xc6d8ff, 1.35);
  moon.position.set(-16, 26, 14);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.near = 4;
  moon.shadow.camera.far = 78;
  moon.shadow.camera.left = -20;
  moon.shadow.camera.right = 20;
  moon.shadow.camera.top = 20;
  moon.shadow.camera.bottom = -20;
  moon.shadow.bias = -0.0012;
  moon.shadow.normalBias = 0.035;
  scene.add(moon);

  // 从店面洒向店前场的一道柔和暖色反弹光
  const storeBounce = new THREE.PointLight(0xffd9a0, 11, 22, 2.0);
  storeBounce.position.set(3.6, 2.1, 1.6);
  scene.add(storeBounce);

  // --- 世界 ------------------------------------------------------------------
  const builder = new Builder();
  const sky = buildSky(scene);
  const { ground } = buildGround(builder, renderer, scene);

  const store = buildStore(builder, scene, { ground, forceDoor: qs.has("door") });
  const props = buildProps(builder, scene, { ground });
  const rain = buildRain(scene, { ground, splash: !qs.has("nosplash") });

  ground.maxSize = num("rtsize", 896);
  ground.uniforms.uDebugRefl.value = num("dbgr", 0);
  document.documentElement.setAttribute(
    "data-dbg",
    `rip=${ground.uniforms.uRipAmp.value} dbgr=${ground.uniforms.uDebugRefl.value} rt=${ground.rt.width} vp=${innerWidth}x${innerHeight} dpr=${renderer.getPixelRatio()}`,
  );

  const stats = builder.finalize();
  scene.add(builder.root);
  document.documentElement.setAttribute("data-stats", JSON.stringify({ ...stats, calls: renderer.info.render.calls }));

  // --- 后处理 ----------------------------------------------------------------
  // MSAA 用 2 而非上游的 4：这个场景 fill-rate 受限，且合成 pass 本就会柔化边缘。
  // 见 docs/performance-report.md。
  const post = new PostFX(renderer, num("msaa", 2));

  // --- 参数初值 --------------------------------------------------------------
  // 这些值过去要经上游面板的 DOM range 才到达 uniform。
  // 现在直接应用 —— URL 覆盖仍然优先于默认值，
  // 而我们的 React 面板会把最终生效的活动值读回来。
  ground.uniforms.uWaveScale.value = num("wave", 0.6);
  ground.uniforms.uRipAmp.value = num("rip", 1);
  ground.uniforms.uReflStrength.value = num("refl", 0.85);
  ground.uniforms.uWaterDark.value = num("dark", 0.55);
  ground.uniforms.uSparkle.value = num("spark", 0.02);
  ground.uniforms.uPoolStrength.value = num("pool", 0.01);
  rain.setAmount(num("rain", 1));
  post.composite.material.uniforms.uExposure.value = num("expo", 1.62);

  // --- 相机取景 --------------------------------------------------------------
  function fitCamera(azDeg: number, elDeg: number, dist: number): void {
    const az = THREE.MathUtils.degToRad(azDeg);
    const el = THREE.MathUtils.degToRad(elDeg);
    const r = dist;
    camera.position.set(
      controls.target.x + Math.sin(az) * Math.cos(el) * r,
      controls.target.y + Math.sin(el) * r,
      controls.target.z + Math.cos(az) * Math.cos(el) * r,
    );
    controls.update();
  }

  const DEFAULT_AZ = 24;
  const DEFAULT_EL = 18;
  function defaultDistance(): number {
    const aspect = innerWidth / innerHeight;
    return THREE.MathUtils.clamp(46 * (1.8 / aspect) ** 0.5, 30, 78);
  }

  const useCustomView = ["az", "el", "d"].some((k) => qs.has(k));
  if (useCustomView) {
    controls.target.set(num("tx", 0.4), num("ty", 1.15), num("tz", -1.0));
    fitCamera(num("az", DEFAULT_AZ), num("el", DEFAULT_EL), num("d", defaultDistance()));
  } else {
    fitCamera(DEFAULT_AZ, DEFAULT_EL, defaultDistance());
  }

  // --- 尺寸变化 --------------------------------------------------------------
  function resize(): void {
    const w = innerWidth,
      h = innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    const dpr = renderer.getPixelRatio();
    ground.setSize(w * dpr, h * dpr);
  }
  addEventListener("resize", resize);
  resize();

  // --- 主循环 ----------------------------------------------------------------
  const clock = new THREE.Clock();
  const frozen = qs.has("t");
  let elapsed = 0;

  function frame(): void {
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed = frozen ? num("t", 0) : elapsed + dt;

    controls.update();
    sky.update(elapsed, camera);
    ground.update(elapsed);
    if (store.update) store.update(elapsed, dt, camera);
    // props 的 tick 只依赖时间（多传的参数本来就会被忽略）
    if (props.update) props.update(elapsed);
    if (rain.update) rain.update(elapsed, dt, camera);

    ground.renderMirror(scene, camera);

    if (qs.has("nopost")) {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    } else {
      post.render(scene, camera, elapsed);
      if (qs.get("debug") === "refl") {
        const u = post.composite.material.uniforms;
        u.tScene.value = ground.rt.texture;
        u.uBloom.value = 0;
        u.uExposure.value = 1.0;
        post.composite.render(renderer, null);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // --- 句柄 ------------------------------------------------------------------
  // 同时也挂在 window 上：docs/performance-report.md 里的诊断脚本
  // 与截图工具会从那里读取。
  const diorama: DioramaScene = {
    scene,
    camera,
    controls,
    renderer,
    post,
    stats,
    fitCamera,
    ground,
    store,
    props,
    rain,
    sky,
    THREE,
  };
  handle = diorama;
  window.__DIORAMA = diorama;

  // ?export=glb —— 首帧渲染完成后，把整个场景作为二进制 glTF 下载
  //（见 src/scene/diorama/export.ts）
  if (qs.has("export")) {
    const fmt = qs.get("export");
    const name = "rainy-night-konbini" + (fmt && fmt !== "glb" ? "-" + fmt : "") + ".glb";
    // 推迟到首帧之后，保证导出发生在场景已就绪时
    requestAnimationFrame(() => {
      import("./export")
        .then(({ exportGLB }) => exportGLB(diorama, name))
        .catch((err) => console.error("[diorama] glb export failed", err));
    });
  }

  return diorama;
}

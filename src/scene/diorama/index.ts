/*
 * Restored from the bundled diorama (see reference/README.md).
 *
 * This is the original assembly entry point (`src/main.js` in the upstream
 * project), mechanically converted to an ES module. Two deliberate changes
 * compared with the bundle:
 *
 *   1. It exposes `bootDiorama()` instead of running as a side effect of a
 *      <script> tag, so React controls when the scene is created.
 *   2. The upstream project's own tuning panel DOM is gone — our React panel
 *      (src/ui/WaterPanel.tsx) took over. The URL parameters it used to funnel
 *      into the water uniforms are now applied directly, so `?wave=1.4` and
 *      friends still work exactly as before. Its MSAA default is also lowered
 *      from 4 to 2 (see docs/performance-report.md).
 *
 * TYPED ✓ — see docs/source-restore.md.
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { Builder } from './toon'
import { buildSky } from './sky'
import { buildGround } from './ground'
import { buildStore } from './store'
import { buildProps } from './props'
import { buildRain } from './rain'
import { PostFX } from './postfx'
import type { BuildStats } from './toon'
import type { Sky } from './sky'
import type { StoreHandle } from './store'
import type { PropsHandle } from './props'
import type { RainHandle } from './rain'
import type { DioramaHandle } from './adapter'

// re-export the adapter surface so `from './diorama'` keeps working
export * from './adapter'

declare global {
  interface Window {
    /** published by bootDiorama() for the diagnostic scripts and screenshot tooling */
    __DIORAMA?: DioramaScene
  }
}

/**
 * Everything a caller (or the diagnostic scripts) may want to poke at.
 * A superset of `DioramaHandle`, which is the minimal surface the UI needs.
 */
export interface DioramaScene extends DioramaHandle {
  scene: THREE.Scene
  stats: BuildStats
  sky: Sky
  store: StoreHandle
  props: PropsHandle
  rain: RainHandle
  THREE: typeof THREE
}

let handle: DioramaScene | null = null

/**
 * Build the diorama and start its render loop. Idempotent: repeated calls
 * return the same handle (React StrictMode double-mounts effects in dev).
 *
 * Requires `<canvas id="scene">` to be in the document.
 */
export function bootDiorama(): DioramaScene {
  if (handle) return handle

  // --- query params (debug views / deterministic captures) -------------------
  const qs = new URLSearchParams(location.search);
  const num = (k: string, d: number): number => (qs.has(k) ? parseFloat(qs.get(k) as string) : d);

  // --- renderer --------------------------------------------------------------
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // graded in the composite pass
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = true;

  // --- scene -----------------------------------------------------------------
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
  controls.minPolarAngle = 0.10;
  controls.maxPolarAngle = 1.47;
  controls.target.set(1.6, 1.05, -1.8);

  // --- lights ----------------------------------------------------------------
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

  // a soft warm bounce from the storefront onto the forecourt
  const storeBounce = new THREE.PointLight(0xffd9a0, 11, 22, 2.0);
  storeBounce.position.set(3.6, 2.1, 1.6);
  scene.add(storeBounce);

  // --- world -----------------------------------------------------------------
  const builder = new Builder();
  const sky = buildSky(scene);
  const { ground } = buildGround(builder, renderer, scene);

  const store = buildStore(builder, scene, { ground, forceDoor: qs.has('door') });
  const props = buildProps(builder, scene, { ground });
  const rain = buildRain(scene, { ground, splash: !qs.has('nosplash') });

  ground.maxSize = num('rtsize', 896);
  ground.uniforms.uDebugRefl.value = num('dbgr', 0);
  document.documentElement.setAttribute('data-dbg', `rip=${ground.uniforms.uRipAmp.value} dbgr=${ground.uniforms.uDebugRefl.value} rt=${ground.rt.width} vp=${innerWidth}x${innerHeight} dpr=${renderer.getPixelRatio()}`);

  const stats = builder.finalize();
  scene.add(builder.root);
  document.documentElement.setAttribute('data-stats', JSON.stringify({ ...stats, calls: renderer.info.render.calls }));

  // --- post ------------------------------------------------------------------
  // MSAA 2 instead of the upstream 4: this scene is fill-rate bound and the
  // composite pass already softens edges. See docs/performance-report.md.
  const post = new PostFX(renderer, num('msaa', 2));

  // --- parameter initial values ----------------------------------------------
  // These used to reach the uniforms through the upstream panel's DOM ranges.
  // Now they are applied directly — a URL override still wins over the default,
  // and our React panel reads the resulting live values back out.
  ground.uniforms.uWaveScale.value = num('wave', 0.6);
  ground.uniforms.uRipAmp.value = num('rip', 1);
  ground.uniforms.uReflStrength.value = num('refl', 0.85);
  ground.uniforms.uWaterDark.value = num('dark', 0.55);
  ground.uniforms.uSparkle.value = num('spark', 0.02);
  ground.uniforms.uPoolStrength.value = num('pool', 1.2);
  rain.setAmount(num('rain', 1));
  post.composite.material.uniforms.uExposure.value = num('expo', 1.62);

  // --- camera framing --------------------------------------------------------
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
    return THREE.MathUtils.clamp(46 * (1.80 / aspect) ** 0.5, 30, 78);
  }

  const useCustomView = ['az', 'el', 'd'].some((k) => qs.has(k));
  if (useCustomView) {
    controls.target.set(num('tx', 0.4), num('ty', 1.15), num('tz', -1.0));
    fitCamera(num('az', DEFAULT_AZ), num('el', DEFAULT_EL), num('d', defaultDistance()));
  } else {
    fitCamera(DEFAULT_AZ, DEFAULT_EL, defaultDistance());
  }

  // --- resize ----------------------------------------------------------------
  function resize(): void {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    const dpr = renderer.getPixelRatio();
    ground.setSize(w * dpr, h * dpr);
  }
  addEventListener('resize', resize);
  resize();

  // --- loop ------------------------------------------------------------------
  const clock = new THREE.Clock();
  const frozen = qs.has('t');
  let elapsed = 0;

  function frame(): void {
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed = frozen ? num('t', 0) : elapsed + dt;

    controls.update();
    sky.update(elapsed, camera);
    ground.update(elapsed);
    if (store.update) store.update(elapsed, dt, camera);
    // the props tick only depends on time (the extra args were always ignored)
    if (props.update) props.update(elapsed);
    if (rain.update) rain.update(elapsed, dt, camera);

    ground.renderMirror(scene, camera);

    if (qs.has('nopost')) { renderer.setRenderTarget(null); renderer.render(scene, camera); }
    else {
      post.render(scene, camera, elapsed);
      if (qs.get('debug') === 'refl') {
        const u = post.composite.material.uniforms;
        u.tScene.value = ground.rt.texture;
        u.uBloom.value = 0;
        u.uExposure.value = 1.0;
        post.composite.render(renderer, null);
      }
    }
    requestAnimationFrame(frame);}
  requestAnimationFrame(frame);

  // --- handle ----------------------------------------------------------------
  // Kept on window as well: the diagnostic scripts in docs/performance-report.md
  // and the screenshot tooling read it from there.
  const diorama: DioramaScene = {
    scene, camera, controls, renderer, post, stats, fitCamera, ground, store, props, rain, sky, THREE,
  };
  handle = diorama;
  window.__DIORAMA = diorama;

  return diorama;
}

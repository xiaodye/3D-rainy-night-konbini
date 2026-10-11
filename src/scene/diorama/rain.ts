/*
 * 还原自打包产物 diorama（见 docs/source-restore.md）。
 *
 * 机械转换回源码：原模块结构相同，本文件只是把 `window.__M` 命名空间
 * 接线换成 ES module 的 import/export，渲染逻辑本身未改动。
 *
 * TYPED ✓ — 见 docs/source-restore.md。
 */

import * as THREE from 'three'

import { makeRng } from './config'
import type { WetGround } from './ground'

// ---------------------------------------------------------------------------
// 雨：下落的雨丝、地面溅落，以及从雨棚 / 屋檐滴落的水。
// 全部使用 instancing，动画在 GPU 上完成。
// ---------------------------------------------------------------------------

const BOX = 30;      // 雨体积的平铺尺寸 —— 以 diorama 为中心，而非相机
const HEIGHT = 26;

function streakTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 128;
  const g = cv.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0.0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  grd.addColorStop(0.85, 'rgba(255,255,255,0.95)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 16, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function ringTexture(): THREE.CanvasTexture {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.clearRect(0, 0, S, S);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 4;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 5, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 9;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 8, 0, Math.PI * 2); g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const RAIN_VS = /* glsl */`
  attribute vec3 aOffset;
  attribute vec2 aParams;   // 下落速度、随机相位
  attribute float aLen;
  uniform float uTime;
  uniform vec3 uCam;
  uniform float uBox;
  uniform float uHeight;
  uniform vec3 uWind;
  varying float vFade;
  varying vec2 vUvS;

  void main() {
    vec3 p = aOffset;
    p.y = mod(aOffset.y - uTime * aParams.x, uHeight);
    p += uWind * (p.y * 0.06);

    vec3 toCam = normalize(uCam - p);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
    vec3 up = normalize(vec3(0.0, 1.0, 0.0) + uWind * 0.12);

    float w = 0.016 + 0.012 * aParams.y;
    vec3 wp = p + right * position.x * w + up * position.y * aLen;

    float d = length(uCam - wp);
    // 让雨只落在模型范围内
    float outside = 1.0 - smoothstep(12.5, 15.5, length(p.xz));
    vFade = exp(-d * 0.014) * (0.55 + 0.45 * aParams.y) * outside;
    vUvS = uv;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;

const RAIN_FS = /* glsl */`
  precision mediump float;
  uniform sampler2D tStreak;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  varying vec2 vUvS;
  void main() {
    vec4 t = texture2D(tStreak, vUvS);
    float a = t.a * vFade * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const SPLASH_VS = /* glsl */`
  attribute vec3 aOffset;
  attribute vec2 aParams;   // 相位、尺寸
  uniform float uTime;
  uniform vec3 uCam;
  uniform float uBox;
  varying vec2 vUvS;
  varying float vFade;
  void main() {
    vec3 p = aOffset;
    float ph = fract(uTime * 1.15 + aParams.x);
    float s = (0.10 + ph * 0.42) * aParams.y;
    vFade = (1.0 - ph) * (1.0 - ph) * exp(-length(uCam - p) * 0.035)
          * (1.0 - smoothstep(12.5, 15.5, length(p.xz)));
    vUvS = uv;

    vec3 right = vec3(1.0, 0.0, 0.0);
    vec3 fwd = vec3(0.0, 0.0, 1.0);
    vec3 wp = p + right * position.x * s + fwd * position.y * s;
    wp.y += 0.012;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;

const SPLASH_FS = /* glsl */`
  precision mediump float;
  uniform sampler2D tRing;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUvS;
  varying float vFade;
  void main() {
    vec4 t = texture2D(tRing, vUvS);
    float a = t.a * vFade * 0.5 * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

// 从一组世界坐标起点滴落的水
const DRIP_VS = /* glsl */`
  attribute vec3 aOrigin;
  attribute vec2 aParams;   // 相位、速度
  attribute float aLen;
  uniform float uTime;
  varying float vFade;
  varying vec2 vUvS;
  void main() {
    float cycle = 2.6 + aParams.x * 2.4;
    float t = mod(uTime * aParams.y + aParams.x * 7.0, cycle);
    float fall = t * 6.5;
    vec3 p = aOrigin - vec3(0.0, fall, 0.0);
    float alive = step(0.15, t) * step(p.y, aOrigin.y) * step(0.0, p.y);
    vFade = alive * (0.55 + 0.45 * aParams.x) * (1.0 - smoothstep(cycle * 0.72, cycle, t));
    vec3 right = vec3(1.0, 0.0, 0.0);
    vec3 wp = p + right * position.x * 0.016 + vec3(0.0, 1.0, 0.0) * position.y * aLen;
    vUvS = uv;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;

const DRIP_FS = /* glsl */`
  precision mediump float;
  uniform sampler2D tStreak;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  varying vec2 vUvS;
  void main() {
    vec4 t = texture2D(tStreak, vUvS);
    float a = t.a * vFade * 0.85 * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

/** 活动的雨系统：设置密度、每帧 tick */
export interface RainHandle {
  group: THREE.Group
  /** 0 = 无雨，1 = 默认，>1 = 更大 */
  setAmount(v: number): void
  update(t: number, dt: number, camera: THREE.Camera): void
}

function buildRain(
  scene: THREE.Scene,
  { ground, splash: wantSplash = true }: { ground?: WetGround; splash?: boolean } = {},
): RainHandle {
  const rng = makeRng(9182);
  const group = new THREE.Group();
  scene.add(group);

  const streakTex = streakTexture();
  const ringTex = ringTexture();

  // --- 下落的雨丝 -------------------------------------------------------------
  const N = 3200;
  const plane = new THREE.PlaneGeometry(1, 1);
  const rainGeo = new THREE.InstancedBufferGeometry();
  rainGeo.index = plane.index;
  rainGeo.attributes.position = plane.attributes.position;
  rainGeo.attributes.uv = plane.attributes.uv;
  const off = new Float32Array(N * 3);
  const par = new Float32Array(N * 2);
  const len = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    off[i * 3 + 0] = (rng() - 0.5) * BOX;
    off[i * 3 + 1] = rng() * HEIGHT;
    off[i * 3 + 2] = (rng() - 0.5) * BOX;
    par[i * 2 + 0] = 13 + rng() * 11;
    par[i * 2 + 1] = rng();
    len[i] = 0.42 + rng() * 0.62;
  }
  rainGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3));
  rainGeo.setAttribute('aParams', new THREE.InstancedBufferAttribute(par, 2));
  rainGeo.setAttribute('aLen', new THREE.InstancedBufferAttribute(len, 1));

  const rainMat = new THREE.ShaderMaterial({
    vertexShader: RAIN_VS, fragmentShader: RAIN_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: BOX },
      uHeight: { value: HEIGHT }, uWind: { value: new THREE.Vector3(-0.05, 0, 0.02) },
      tStreak: { value: streakTex }, uColor: { value: new THREE.Color(0xa8c6e6) }, uOpacity: { value: 0.78 },
    },
  });
  const rain = new THREE.Mesh(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.renderOrder = 6;
  group.add(rain);

  // --- 溅落 -------------------------------------------------------------------
  const M = 260;
  const splashGeo = new THREE.InstancedBufferGeometry();
  splashGeo.index = plane.index;
  splashGeo.attributes.position = plane.attributes.position;
  splashGeo.attributes.uv = plane.attributes.uv;
  const soff = new Float32Array(M * 3);
  const spar = new Float32Array(M * 2);
  for (let i = 0; i < M; i++) {
    soff[i * 3 + 0] = (rng() - 0.5) * BOX;
    soff[i * 3 + 1] = 0.0;
    soff[i * 3 + 2] = (rng() - 0.5) * BOX;
    spar[i * 2 + 0] = rng();
    spar[i * 2 + 1] = 0.6 + rng() * 1.1;
  }
  splashGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(soff, 3));
  splashGeo.setAttribute('aParams', new THREE.InstancedBufferAttribute(spar, 2));
  const splashMat = new THREE.ShaderMaterial({
    vertexShader: SPLASH_VS, fragmentShader: SPLASH_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: BOX },
      tRing: { value: ringTex }, uColor: { value: new THREE.Color(0x8fb2d8) },
      uOpacity: { value: 1 },
    },
  });
  const splash = new THREE.Mesh(splashGeo, splashMat);
  splash.frustumCulled = false;
  splash.renderOrder = 5;
  if (wantSplash) group.add(splash);

  // --- 檐下滴水 ---------------------------------------------------------------
  const drips = [
    // 店前雨棚边缘
    [-0.4, 3.16, 0.42], [1.6, 3.16, 0.42], [3.6, 3.16, 0.42], [5.6, 3.16, 0.42], [7.6, 3.16, 0.42],
    // 便利店屋顶轮廓
    [-0.9, 4.32, 0.55], [2.4, 4.32, 0.55], [5.6, 4.32, 0.55], [8.2, 4.32, 0.55],
    // 西侧屋檐
    [-1.02, 4.32, -3.2], [-1.02, 4.32, -6.4], [-1.02, 4.32, -8.6],
    // 邻居楼的屋檐
    [10.05, 6.6, -2.2], [10.05, 6.6, -5.6], [10.05, 6.6, -9.4],
    [-9.62, 5.6, -1.0], [-9.62, 5.6, -4.6], [-9.62, 5.6, -8.0],
    // 信号灯横杆
    [-7.6, 4.9, 5.3],
  ];
  const D = drips.length;
  const dripGeo = new THREE.InstancedBufferGeometry();
  dripGeo.index = plane.index;
  dripGeo.attributes.position = plane.attributes.position;
  dripGeo.attributes.uv = plane.attributes.uv;
  const dof = new Float32Array(D * 3);
  const dpa = new Float32Array(D * 2);
  const dle = new Float32Array(D);
  drips.forEach((d, i) => {
    dof[i * 3] = d[0]; dof[i * 3 + 1] = d[1]; dof[i * 3 + 2] = d[2];
    dpa[i * 2] = rng(); dpa[i * 2 + 1] = 0.7 + rng() * 0.6;
    dle[i] = 0.16 + rng() * 0.16;
  });
  dripGeo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(dof, 3));
  dripGeo.setAttribute('aParams', new THREE.InstancedBufferAttribute(dpa, 2));
  dripGeo.setAttribute('aLen', new THREE.InstancedBufferAttribute(dle, 1));
  const dripMat = new THREE.ShaderMaterial({
    vertexShader: DRIP_VS, fragmentShader: DRIP_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: {
      uTime: { value: 0 }, tStreak: { value: streakTex },
      uColor: { value: new THREE.Color(0xbdd4ee) }, uOpacity: { value: 1 },
    },
  });
  const drip = new THREE.Mesh(dripGeo, dripMat);
  drip.frustumCulled = false;
  drip.renderOrder = 6;
  group.add(drip);

  const cam = new THREE.Vector3();
  return {
    group,
    /** 0 = 无雨，1 = 默认，>1 = 更大 */
    setAmount(v: number): void {
      const k = Math.max(0, v);
      rainMat.uniforms.uOpacity.value = 0.78 * k;
      splashMat.uniforms.uOpacity.value = k;
      dripMat.uniforms.uOpacity.value = k;
      rain.visible = k > 0.01;
      splash.visible = wantSplash && k > 0.01;
      drip.visible = k > 0.01;
    },
    update(t: number, dt: number, camera: THREE.Camera): void {
      camera.getWorldPosition(cam);
      rainMat.uniforms.uTime.value = t;
      rainMat.uniforms.uCam.value.copy(cam);
      splashMat.uniforms.uTime.value = t;
      splashMat.uniforms.uCam.value.copy(cam);
      dripMat.uniforms.uTime.value = t;
    },
  };
}

export { buildRain };

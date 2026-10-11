/*
 * 还原自打包产物 diorama（见 docs/source-restore.md）。
 *
 * 机械转换回源码：原模块结构相同，本文件只是把 `window.__M` 命名空间
 * 接线换成 ES module 的 import/export，渲染逻辑本身未改动。
 *
 * TYPED ✓ — 见 docs/source-restore.md。
 */

import * as THREE from 'three'

import { BASE, STREET, WALK, COLORS, makeRng } from './config'
import { toon, Builder } from './toon'
import type { Vec3 } from './toon'

// ---------------------------------------------------------------------------
// 底座 + 湿路面。
//  * 一张 2048px 画布绘制所有道路标线、地砖、排水沟与积水遮罩
//  * 自定义 shader 把这层绘制与真实的平面反射混合
//  * 雨点涟漪扰动反射，并带来细微的闪烁
// ---------------------------------------------------------------------------

const S = 2048; // 画布分辨率
const PX = S / BASE.size;

const wx = (x: number): number => (x + BASE.half) * PX;
const wz = (z: number): number => (z + BASE.half) * PX;

function rgba(hex: number, a = 1): string {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// 画布绘制
// ---------------------------------------------------------------------------
/** 湿地面采样的两张画布：albedo + 湿度遮罩 */
export interface GroundMaps {
  albedo: THREE.CanvasTexture
  wet: THREE.CanvasTexture
}

function paintGround(): GroundMaps {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const rng = makeRng(20240917);

  const rect = (x0: number, z0: number, x1: number, z1: number): number[] =>
    [wx(x0), wz(z0), (x1 - x0) * PX, (z1 - z0) * PX];

  // --- 1. 一切都从潮湿的深色地面开始 -------------------------------------
  g.fillStyle = rgba(COLORS.asphaltDark);
  g.fillRect(0, 0, S, S);

  // 整体先铺柏油（"街道之外"的区域大多被人行道与建筑遮住，
  // 但底座边缘仍应看得出来）
  const fill = (x0: number, z0: number, x1: number, z1: number, col: string) => {
    const [a, b, w, h] = rect(x0, z0, x1, z1);
    g.fillStyle = col; g.fillRect(a, b, w, h);
  };

  fill(-13, 4.6, 13, 11.0, rgba(0x373b48)); // 主街
  fill(-9.6, -13, -5.0, 4.6, rgba(0x353946)); // 侧街
  fill(8.4, -13, 10.0, -0.6, rgba(0x2b2e38)); // 东侧巷道
  fill(-3.6, -0.6, 13, 4.6, rgba(0x3e424f)); // 店前场（颜色更浅的混凝土）
  fill(-3.6, -13, -1.0, -0.6, rgba(0x383c48)); // 便利店旁边的空地
  fill(-5.0, -13, -3.6, 4.6, rgba(0x3a3e4a)); // 沿侧街的人行道带

  // --- 2. 柏油颗粒噪点 -----------------------------------------------------
  for (let i = 0; i < 26000; i++) {
    const x = rng() * S, y = rng() * S;
    const v = rng();
    g.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.012 + rng() * 0.03})` : `rgba(0,0,0,${0.02 + rng() * 0.05})`;
    g.fillRect(x, y, 1 + rng() * 2.2, 1 + rng() * 2.2);
  }
  // 大面积的深浅斑块（油渍 / 磨损）
  for (let i = 0; i < 90; i++) {
    const x = rng() * S, y = rng() * S, r = 30 + rng() * 190;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rng() > 0.42;
    grd.addColorStop(0, dark ? 'rgba(0,0,0,0.16)' : 'rgba(150,160,180,0.07)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  // --- 3. 前场混凝土的伸缩缝 -----------------------------------------------
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 2.4;
  for (let x = -3.6; x <= 13; x += 2.6) {
    g.beginPath(); g.moveTo(wx(x), wz(-0.6)); g.lineTo(wx(x), wz(4.6)); g.stroke();
  }

  // --- 4. 道路标线 ---------------------------------------------------------
  g.lineCap = 'butt';
  // 主街边线
  g.strokeStyle = rgba(COLORS.paint, 0.62);
  g.lineWidth = 0.14 * PX;
  for (const z of [5.05, 10.55]) {
    g.beginPath(); g.moveTo(wx(-13), wz(z)); g.lineTo(wx(13), wz(z)); g.stroke();
  }
  // 中央虚线
  g.strokeStyle = rgba(COLORS.paint, 0.5);
  g.lineWidth = 0.12 * PX;
  for (let x = -12.6; x < 13; x += 2.0) {
    g.beginPath(); g.moveTo(wx(x), wz(7.8)); g.lineTo(wx(x + 1.1), wz(7.8)); g.stroke();
  }
  // 侧街边线
  g.strokeStyle = rgba(COLORS.paint, 0.4);
  g.lineWidth = 0.12 * PX;
  for (const x of [-9.35, -5.25]) {
    g.beginPath(); g.moveTo(wx(x), wz(-13)); g.lineTo(wx(x), wz(4.55)); g.stroke();
  }

  // 横穿主街的人行横道，与店门前的车道对齐
  const cwX0 = 0.7, cwX1 = 3.7;
  for (let x = cwX0; x < cwX1 - 0.01; x += 0.78) {
    g.fillStyle = rgba(COLORS.paint, 0.72);
    g.fillRect(wx(x), wz(4.95), 0.46 * PX, 5.9 * PX);
  }
  // 侧街的停止线
  g.fillStyle = rgba(COLORS.paint, 0.66);
  g.fillRect(wx(-9.6), wz(4.72), 4.6 * PX, 0.4 * PX);
  // 侧街的让行三角标
  g.fillStyle = rgba(COLORS.paint, 0.5);
  for (let i = 0; i < 5; i++) {
    const cx = -9.3 + i * 0.95;
    g.beginPath();
    g.moveTo(wx(cx), wz(5.55)); g.lineTo(wx(cx + 0.6), wz(5.55)); g.lineTo(wx(cx + 0.3), wz(6.4));
    g.closePath(); g.fill();
  }

  // 前场的停车位（三个车位 + 斜线禁停区）
  g.strokeStyle = rgba(COLORS.paint, 0.6);
  g.lineWidth = 0.13 * PX;
  const bays = [1.1, 3.7, 6.3, 8.9];
  for (const x of bays) {
    g.beginPath(); g.moveTo(wx(x), wz(-0.5)); g.lineTo(wx(x), wz(2.7)); g.stroke();
  }
  g.beginPath(); g.moveTo(wx(1.1), wz(2.7)); g.lineTo(wx(8.9), wz(2.7)); g.stroke();
  // 挡车器
  g.fillStyle = rgba(0x9aa2b2, 0.85);
  for (const x of bays.slice(0, 3)) {
    g.fillRect(wx(x + 0.35), wz(-0.42), 2.0 * PX, 0.2 * PX);
  }
  // 店面入口附近的斜线填充
  g.strokeStyle = rgba(COLORS.paint, 0.34);
  g.lineWidth = 0.1 * PX;
  for (let i = 0; i < 12; i++) {
    const x = 9.4 + i * 0.42;
    g.beginPath(); g.moveTo(wx(x), wz(-0.4)); g.lineTo(wx(x - 1.0), wz(2.6)); g.stroke();
  }

  // --- 5. 排水沟、雨水篦子、井盖 -------------------------------------------
  // 贴着主街北侧路缘的排水槽
  g.fillStyle = 'rgba(0,0,0,0.30)';
  g.fillRect(wx(-13), wz(4.6), 26 * PX, 0.34 * PX);
  g.fillStyle = 'rgba(0,0,0,0.26)';
  g.fillRect(wx(-13), wz(10.66), 26 * PX, 0.34 * PX);
  g.fillRect(wx(-5.0), wz(-13), 0.34 * PX, 17.6 * PX);
  g.fillRect(wx(-9.94), wz(-13), 0.34 * PX, 17.6 * PX);

  // 雨水篦子
  const grate = (x: number, z: number, w: number, d: number, rot = 0) => {
    g.save();
    g.translate(wx(x), wz(z));
    if (rot) g.rotate(rot);
    g.fillStyle = 'rgba(12,14,20,0.85)';
    g.fillRect(-w * PX / 2, -d * PX / 2, w * PX, d * PX);
    g.fillStyle = 'rgba(120,130,150,0.5)';
    for (let i = 0; i < Math.floor(w * 6); i++) {
      const px = -w * PX / 2 + 0.08 * PX + i * 0.17 * PX;
      g.fillRect(px, -d * PX / 2 + 0.03 * PX, 0.07 * PX, d * PX - 0.06 * PX);
    }
    g.restore();
  };
  grate(2.4, 4.78, 0.9, 0.34);
  grate(-6.9, 4.78, 0.9, 0.34);
  grate(9.6, 4.78, 0.9, 0.34);
  grate(-5.15, -2.2, 0.34, 0.9);
  grate(-5.15, -7.4, 0.34, 0.9);

  // 井盖
  const manhole = (x: number, z: number, r: number) => {
    g.save(); g.translate(wx(x), wz(z));
    g.fillStyle = 'rgba(30,33,42,0.9)';
    g.beginPath(); g.arc(0, 0, r * PX, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(120,130,150,0.34)';
    g.lineWidth = 0.05 * PX;
    g.beginPath(); g.arc(0, 0, r * PX * 0.86, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * r * PX * 0.2, Math.sin(a) * r * PX * 0.2);
      g.lineTo(Math.cos(a) * r * PX * 0.8, Math.sin(a) * r * PX * 0.8);
      g.stroke();
    }
    g.restore();
  };
  manhole(-7.6, 8.4, 0.42);
  manhole(5.6, 9.2, 0.42);
  manhole(-7.2, -3.0, 0.36);

  // --- 6. 湿度 / 积水遮罩（独立的灰度图） -----------------------------------
  // 黑 = 潮湿，白 = 积水 / 强反射
  const wcv = document.createElement('canvas');
  wcv.width = wcv.height = S;
  const wg = wcv.getContext('2d')!;
  wg.fillStyle = '#6e6e6e'; // 整体为潮湿的柏油
  wg.fillRect(0, 0, S, S);
  // 更湿的柔和斑块
  for (let i = 0; i < 60; i++) {
    const x = rng() * S, y = rng() * S, r = 60 + rng() * 260;
    const grd = wg.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    wg.fillStyle = grd;
    wg.beginPath(); wg.arc(x, y, r, 0, Math.PI * 2); wg.fill();
  }

  const puddle = (x: number, z: number, rx: number, rz: number, strength: number, seed: number) => {
    const r2 = makeRng(seed);
    wg.save();
    wg.translate(wx(x), wz(z));
    wg.scale(rx * PX, rz * PX);
    const grd = wg.createRadialGradient(0, 0, 0.1, 0, 0, 1);
    grd.addColorStop(0, `rgba(255,255,255,${strength})`);
    grd.addColorStop(0.62, `rgba(255,255,255,${strength * 0.9})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    wg.fillStyle = grd;
    wg.beginPath();
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = 0.72 + r2() * 0.42;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) wg.moveTo(px, py); else wg.lineTo(px, py);
    }
    wg.closePath();
    wg.fill();
    wg.restore();
  };

  // 沿排水沟与街道低洼处的较大积水
  puddle(-8.5, 5.4, 3.4, 1.0, 0.62, 11);
  puddle(2.0, 5.6, 3.0, 0.9, 0.6, 12);
  puddle(7.5, 10.2, 3.6, 1.1, 0.58, 13);
  puddle(-11.4, 9.0, 2.2, 2.6, 0.5, 14);
  puddle(-6.2, 0.5, 1.4, 2.6, 0.55, 15);
  puddle(-7.4, -6.5, 1.7, 3.2, 0.6, 16);
  puddle(-6.6, -11.0, 1.5, 2.4, 0.52, 17);
  puddle(9.2, -5.0, 0.6, 3.0, 0.62, 18);
  puddle(9.3, -10.5, 0.62, 2.4, 0.55, 19);
  puddle(4.0, 1.6, 2.6, 1.2, 0.66, 20);
  puddle(6.8, 0.9, 2.0, 1.0, 0.6, 21);
  puddle(1.2, 2.9, 2.2, 0.9, 0.55, 22);
  puddle(11.4, 2.2, 1.6, 1.2, 0.5, 23);
  puddle(-2.0, -4.0, 1.2, 2.2, 0.5, 24);

  // 零散的小水洼
  for (let i = 0; i < 70; i++) {
    const x = -13 + rng() * 26, z = -13 + rng() * 26;
    puddle(x, z, 0.35 + rng() * 1.1, 0.3 + rng() * 0.9, 0.3 + rng() * 0.4, 300 + i);
  }

  // 店灯光洒落处积水最强
  puddle(2.4, 0.6, 3.2, 1.5, 0.55, 41);
  puddle(6.4, 1.2, 2.6, 1.3, 0.5, 42);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;

  const wetTex = new THREE.CanvasTexture(wcv);
  wetTex.colorSpace = THREE.NoColorSpace;
  wetTex.anisotropy = 4;
  wetTex.minFilter = THREE.LinearMipmapLinearFilter;
  wetTex.magFilter = THREE.LinearFilter;
  wetTex.generateMipmaps = true;
  wetTex.needsUpdate = true;

  return { albedo: tex, wet: wetTex };
}

// ---------------------------------------------------------------------------
// 人行道地砖贴图（小尺寸可平铺画布）
// ---------------------------------------------------------------------------
function tileTexture(): THREE.CanvasTexture {
  const T = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = T;
  const g = cv.getContext('2d')!;
  g.fillStyle = rgba(COLORS.sidewalk);
  g.fillRect(0, 0, T, T);
  const rng = makeRng(77);
  // 4x4 地砖与砖缝
  const n = 4, s = T / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = 0.92 + rng() * 0.16;
      const c = new THREE.Color(COLORS.sidewalk).multiplyScalar(v);
      g.fillStyle = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
      g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
      // 角砖上的盲道凸点
      if (i === 0 && j === 0) {
        g.fillStyle = 'rgba(0,0,0,0.10)';
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
          g.beginPath(); g.arc(s * (0.28 + a * 0.22), s * (0.28 + b * 0.22), s * 0.055, 0, 6.3); g.fill();
        }
      }
    }
  }
  g.strokeStyle = 'rgba(0,0,0,0.16)';
  g.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, T); g.stroke();
    g.beginPath(); g.moveTo(0, i * s); g.lineTo(T, i * s); g.stroke();
  }
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    g.fillRect(rng() * T, rng() * T, 2, 2);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// ---------------------------------------------------------------------------
// 带平面反射的湿地面 mesh
// ---------------------------------------------------------------------------
const GROUND_VS = /* glsl */`
  uniform mat4 uTextureMatrix;
  varying vec2 vUvG;
  varying vec4 vProj;
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vUvG = uv;
    vProj = uTextureMatrix * wp;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const GROUND_FS = /* glsl */`
  precision highp float;
  uniform sampler2D tGround;
  uniform sampler2D tWet;
  uniform sampler2D tReflect;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uTime;
  uniform vec3 uAmbient;
  uniform vec3 uSky;
  uniform float uRipAmp;
  uniform float uWaveScale;
  uniform float uReflStrength;
  uniform float uWaterDark;
  uniform float uSparkle;
  uniform float uPoolStrength;
  uniform float uDebugRefl;
  uniform vec3 uLightPos[8];
  uniform vec3 uLightCol[8];
  uniform vec2 uLightRad[8];
  uniform int uLightCount;
  varying vec2 vUvG;
  varying vec4 vProj;
  varying vec3 vWorld;

  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  // 两层频率的扩散雨环；返回屏幕空间偏移
  vec2 ripples(vec2 p, float t, float scale, float speed) {
    vec2 acc = vec2(0.0);
    vec2 cell = floor(p / scale);
    for (int j = 0; j <= 1; j++) {
      for (int i = 0; i <= 1; i++) {
        vec2 c = cell + vec2(float(i), float(j));
        vec2 h = hash22(c * 1.37);
        vec2 center = (c + vec2(0.15) + 0.7 * h) * scale;
        float ph = fract(t * speed + h.x * 5.13 + h.y * 2.71);
        vec2 d = p - center;
        float r = length(d);
        float rad = ph * scale * 0.85;
        float ring = exp(-abs(r - rad) * 22.0 / scale) * (1.0 - ph) * (1.0 - ph);
        acc += (d / max(r, 1e-4)) * ring * sin((r - rad) * 34.0 / scale);
      }
    }
    return acc;
  }

  // 一列方向性波；返回 d(height)/d(p)
  vec2 waveTrain(vec2 p, vec2 dir, float wavelength, float amp, float speed, float t) {
    float k = 6.2831853 / wavelength;
    float ph = dot(p, dir) * k + t * speed;
    return dir * (k * amp) * cos(ph);
  }

  // 水面斜率：以雨点同心圆环为主，只留极轻的慢波让水面不完全静止
  vec2 waterGrad(vec2 p, float t, float dist) {
    // 高频分量随距离衰减：符合物理，也避免远处闪烁
    float near = 1.0 / (1.0 + dist * 0.05);
    vec2 g = vec2(0.0);
    g += waveTrain(p, normalize(vec2(1.00, 0.30)), 5.0, 0.0030, 0.35, t);
    // 三层不同尺度 / 不同网格相位的雨点环，避免出现规则网格感
    g += ripples(p, t, 0.42, 0.90) * 0.95 * near;
    g += ripples(p * 1.70 + 7.0, t * 1.35, 0.60, 0.70) * 0.75 * near;
    g += ripples(p * 2.90 + 21.0, t * 1.70, 0.85, 0.55) * 0.55 * near;
    return g;
  }

  void main() {
    vec4 ground = texture2D(tGround, vUvG);
    vec3 albedo = mix(ground.rgb / 12.92, pow((ground.rgb + 0.055) / 1.055, vec3(2.4)), step(0.04045, ground.rgb));
    float wet = texture2D(tWet, vUvG).r;
    wet = clamp(wet * 1.45, 0.0, 1.0);

    vec3 viewVec = cameraPosition - vWorld;
    float dist = length(viewVec);
    vec3 V = viewVec / max(dist, 1e-4);

    // 水面斜率 -> 扰动后的反射方向 -> 屏幕偏移。
    // 这是物理上的路径：波法线让反射光线偏折，
    // 而沿视线方向的偏折在屏幕上表现为竖直方向的晃动。
    vec2 wg = waterGrad(vWorld.xz, uTime, dist) * uRipAmp;
    vec3 N = normalize(vec3(-wg.x, 1.0, -wg.y));
    vec3 R = reflect(-V, N);
    vec3 R0 = vec3(-V.x, V.y, -V.z);
    vec3 dR = R - R0;
    vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec2 disp = vec2(dot(dR, camRight), dot(dR, camUp)) * uWaveScale * mix(0.6, 1.0, wet);

    vec4 proj = vProj;
    proj.xy += disp * proj.w;
    vec2 puv = proj.xy / proj.w;
    // 投影 uv 越出 render target 时，避免镜面拖影
    vec2 dd = abs(puv - 0.5) * 2.0;
    float valid = smoothstep(1.45, 0.98, max(dd.x, dd.y));
    // 紧凑高斯模糊：只让反射轻微发虚，绝不产生重影
    float blurK = 0.0035 + 0.00018 * dist;
    float b1 = proj.w * blurK, b2 = proj.w * blurK * 2.5;
    vec3 refl =
        texture2DProj(tReflect, proj).rgb * 0.40
      + (texture2DProj(tReflect, proj + vec4(0.0, b1, 0.0, 0.0)).rgb
       + texture2DProj(tReflect, proj - vec4(0.0, b1, 0.0, 0.0)).rgb) * 0.20
      + (texture2DProj(tReflect, proj + vec4(0.0, b2, 0.0, 0.0)).rgb
       + texture2DProj(tReflect, proj - vec4(0.0, b2, 0.0, 0.0)).rgb) * 0.10;
    refl *= valid;


    // 视角：掠射角下反射显著更强
    float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.2);
    float mirror = mix(0.48, 0.92, wet) * mix(0.92, 1.0, fres);

    int dbg = int(uDebugRefl + 0.5);
    if (dbg == 1) { gl_FragColor = vec4(texture2D(tWet, vUvG).rrr, 1.0); return; }
    if (dbg == 2) { gl_FragColor = vec4(texture2D(tGround, vUvG).rgb, 1.0); return; }
    if (dbg == 3) { gl_FragColor = vec4(wet, fres, dot(refl, vec3(0.3333)), 1.0); return; }
    if (dbg == 4) { gl_FragColor = vec4(valid, mirror, dot(refl, vec3(0.3333)), 1.0); return; }
    if (dbg == 5) { gl_FragColor = vec4(refl.rgb, 1.0); return; }
    if (dbg == 6) { gl_FragColor = vec4(0.43, 0.86, 0.21, 1.0); return; }
    vec3 col = albedo * uAmbient * mix(1.0, 0.5, uWaterDark * wet);
    col = mix(col, refl * vec3(1.0, 0.99, 1.04) * uReflStrength, clamp(mirror, 0.0, 0.9));
    // 深水更暗：表面越湿，吞掉的光越多
    col *= mix(1.0, 0.78, uWaterDark * wet);
    // 微弱的天空光泽，避免湿柏油变成纯黑
    col += uSky * wet * (0.16 + 0.30 * fres) * (1.0 - 0.75 * uWaterDark);

    // 路面上的光池
    // 店前最多会有八个光池重叠。线性相加会直接冲出白色
    // （单盏灯在近处就贡献约 1），所以改为累加"加权颜色 + 总权重"，
    // 再让亮度走一条饱和曲线：光会叠加，但永远不会超过白色 ——
    // 面板滑块在整个范围内都保持可用。
    vec3 poolCol = vec3(0.0);
    float poolW = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= uLightCount) break;
      vec3 d = uLightPos[i] - vWorld;
      float dist2 = dot(d, d);
      float r = uLightRad[i].x;
      // 平方衰减：灯正下方保持满强度，出了半径迅速衰减。
      // 半径给得比较宽松，没有这一步的话，八个光池会叠成一片均匀泛亮，
      // 而不是读作几片光池。
      float att = 1.0 / (1.0 + dist2 / (r * r));
      att *= att;
      float w = att * uLightRad[i].y;
      poolCol += uLightCol[i] * w;
      poolW += w;
    }
    if (poolW > 0.0) {
      // 归一化颜色，避免冷暖混合被重叠放大
      vec3 poolTint = poolCol / poolW;
      float lum = poolW * uPoolStrength;
      lum = lum / (1.0 + lum);            // 软饱和：0→0，1→0.5，∞→1
      col += poolTint * lum * mix(0.55, 1.0, wet);
    }

    // 波峰会捕捉光线
    float spark = length(wg);
    col += vec3(0.5, 0.62, 0.85) * spark * uSparkle * wet;

    // 雾
    float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    col = mix(col, uFogColor, clamp(f, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** 湿地面 shader 读取的全部 uniform（也是 UI 调节的接口面） */
export interface GroundUniforms {
  tGround: THREE.IUniform<THREE.Texture | null>
  tWet: THREE.IUniform<THREE.Texture | null>
  tReflect: THREE.IUniform<THREE.Texture | null>
  uTextureMatrix: THREE.IUniform<THREE.Matrix4>
  uFogColor: THREE.IUniform<THREE.Color>
  uFogDensity: THREE.IUniform<number>
  uTime: THREE.IUniform<number>
  uAmbient: THREE.IUniform<THREE.Vector3>
  uSky: THREE.IUniform<THREE.Vector3>
  /** 雨点涟漪幅度 */
  uRipAmp: THREE.IUniform<number>
  /** 慢波尺度 */
  uWaveScale: THREE.IUniform<number>
  /** 镜面混合强度 */
  uReflStrength: THREE.IUniform<number>
  /** 水面的暗度 */
  uWaterDark: THREE.IUniform<number>
  /** 波峰高光（HDR） */
  uSparkle: THREE.IUniform<number>
  /** 已注册灯光贡献的光池 */
  uPoolStrength: THREE.IUniform<number>
  uDebugRefl: THREE.IUniform<number>
  uLightPos: THREE.IUniform<THREE.Vector3[]>
  uLightCol: THREE.IUniform<THREE.Color[]>
  uLightRad: THREE.IUniform<THREE.Vector2[]>
  uLightCount: THREE.IUniform<number>
}

class WetGround extends THREE.Mesh {
  uniforms: GroundUniforms
  renderer: THREE.WebGLRenderer
  textureMatrix: THREE.Matrix4
  /** 平面反射的 render target */
  rt: THREE.WebGLRenderTarget
  virtualCamera: THREE.PerspectiveCamera
  clipPlane: THREE.Plane
  normal: THREE.Vector3
  view: THREE.Vector3
  target: THREE.Vector3
  /** 镜像相机的朝向目标（改名以避免与 Object3D.lookAt() 冲突） */
  lookPoint: THREE.Vector3
  rot: THREE.Matrix4
  rwp: THREE.Vector3
  cwp: THREE.Vector3
  /** 镜像 pass 期间隐藏的对象（例如水面线以下的底座） */
  hideInMirror: THREE.Object3D[]
  clearColor: THREE.Color
  /** 反射 target 的像素上限 —— 由画质档位设置 */
  maxSize?: number
  _lights: number

  constructor(renderer: THREE.WebGLRenderer, size = BASE.size) {
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const textureMatrix = new THREE.Matrix4();
    const maps = paintGround();
    const uniforms: GroundUniforms = {
      tGround: { value: null },
      tWet: { value: null },
      tReflect: { value: null },
      uTextureMatrix: { value: textureMatrix },
      uFogColor: { value: new THREE.Color(0x0a0f1a) },
      uFogDensity: { value: 0.0125 },
      uTime: { value: 0 },
      uAmbient: { value: new THREE.Vector3(4.2, 4.4, 5.2) },
      uSky: { value: new THREE.Vector3(0.07, 0.095, 0.155) },
      uRipAmp: { value: 1 },
      uWaveScale: { value: 0.6 },
      uReflStrength: { value: 0.85 },
      uWaterDark: { value: 0.55 },
      uSparkle: { value: 0.02 },
      // 刻意取小值：这是叠加光池的增益，即使 0.25 也会把湿柏油冲淡。
      // ~0.06 能让街道保持深色，只在店前留下一点微弱的暖光池；
      // 面板上限为 0.5。
      uPoolStrength: { value: 0.06 },
      uDebugRefl: { value: 0 },
      uLightPos: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) },
      uLightCol: { value: Array.from({ length: 8 }, () => new THREE.Color(0, 0, 0)) },
      uLightRad: { value: Array.from({ length: 8 }, () => new THREE.Vector2(4, 1)) },
      uLightCount: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: GROUND_VS,
      fragmentShader: GROUND_FS,
      // GroundUniforms 刻意保持精确（没有索引签名），只在这里、
      // 在与 three 的 uniform bag 交界处放宽
      uniforms: uniforms as unknown as { [uniform: string]: THREE.IUniform },
      fog: false,
    });
    super(geo, mat);
    this.frustumCulled = false;
    uniforms.tGround.value = maps.albedo;
    uniforms.tWet.value = maps.wet;
    this.uniforms = uniforms;
    this.renderer = renderer;
    this.textureMatrix = textureMatrix;
    this._lights = 0;

    // 反射 target —— 分辨率跟随画布，这样拉近时不会放大一张固定尺寸的镜面。
    // 不生成 mipmap：带 mipmap 的 half-float target 在部分驱动上可能不完整，
    // 进而采样成全黑。
    this.rt = new THREE.WebGLRenderTarget(1024, 1024, {
      type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });
    this.rt.texture.generateMipmaps = false;
    this.setSize(renderer.domElement.width, renderer.domElement.height);
    this.virtualCamera = new THREE.PerspectiveCamera();
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 100000);
    this.normal = new THREE.Vector3();
    this.view = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.lookPoint = new THREE.Vector3();
    this.rot = new THREE.Matrix4();
    this.rwp = new THREE.Vector3();
    this.cwp = new THREE.Vector3();
    this.hideInMirror = [];
    uniforms.tReflect.value = this.rt.texture;
    this.clearColor = new THREE.Color(0x232c42);
    // 一个常驻的全局裁剪平面，平时停在很远处，只在镜像 pass 期间启用 ——
    // 彻底避开对驱动敏感的斜投影（oblique projection）
    renderer.clippingPlanes = [this.clipPlane];
  }

  setSize(w: number, h: number): void {
    const s = Math.min(this.maxSize || 896, Math.max(512, Math.round(Math.max(w, h) * 0.55)));
    if (this.rt.width !== s) {
      this.rt.setSize(s, s);
      this.rt.texture.generateMipmaps = false;
      this.rt.texture.minFilter = THREE.LinearFilter;
    }
  }

  /**
   * 注册一盏地面灯，参与反射 / 光池着色（最多 8 盏）。
   *
   * 调用方传的是 `[r, g, b]` 数组，而 `THREE.Color.set()` 只认
   * Color | number | string —— 数组会被静默忽略，这让所有光池一直是黑的。
   * 这里把数组改走 `setRGB()`，于是各个调用点无需改动。
   * 数值按线性工作空间解读（即 `setRGB` 的默认行为）。
   */
  addLight(pos: number[], color: Vec3 | number | string, radius: number, intensity: number): void {
    const i = this._lights++;
    if (i >= 8) return;
    this.uniforms.uLightPos.value[i].set(pos[0], pos[1], pos[2]);

    const tint = this.uniforms.uLightCol.value[i];
    if (Array.isArray(color)) tint.setRGB(color[0], color[1], color[2]);
    else tint.set(color as THREE.ColorRepresentation);
    this.uniforms.uLightRad.value[i].set(radius, intensity);
    this.uniforms.uLightCount.value = this._lights;
  }

  update(t: number): void { this.uniforms.uTime.value = t; }

  /** 渲染镜像 target。每帧调用一次，在主渲染之前。 */
  renderMirror(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    const renderer = this.renderer;
    const u = this.uniforms;
    this.rwp.setFromMatrixPosition(this.matrixWorld);
    this.cwp.setFromMatrixPosition(camera.matrixWorld);
    this.rot.extractRotation(this.matrixWorld);
    this.normal.set(0, 1, 0).applyMatrix4(this.rot);
    this.view.subVectors(this.rwp, this.cwp);
    if (this.view.dot(this.normal) > 0) return;
    this.view.reflect(this.normal).negate().add(this.rwp);

    this.rot.extractRotation(camera.matrixWorld);
    this.lookPoint.set(0, 0, -1).applyMatrix4(this.rot).add(this.cwp);
    this.target.subVectors(this.rwp, this.lookPoint);
    this.target.reflect(this.normal).negate().add(this.rwp);

    const vc = this.virtualCamera;
    vc.position.copy(this.view);
    vc.up.set(0, 1, 0).applyMatrix4(this.rot).reflect(this.normal);
    vc.lookAt(this.target);
    vc.near = camera.near;
    vc.far = camera.far;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);

    this.textureMatrix.set(
      0.5, 0, 0, 0.5,
      0, 0.5, 0, 0.5,
      0, 0, 0.5, 0.5,
      0, 0, 0, 1,
    );
    this.textureMatrix.multiply(vc.projectionMatrix);
    this.textureMatrix.multiply(vc.matrixWorldInverse);
    u.uTextureMatrix.value.copy(this.textureMatrix);

    const prevVisible = this.visible;
    const prevRT = renderer.getRenderTarget();
    const prevShadow = renderer.shadowMap.autoUpdate;
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    this.visible = false;
    // 水面以下的东西绝不能漏进镜像
    for (const o of this.hideInMirror) o.visible = false;
    renderer.shadowMap.autoUpdate = false;
    // 裁掉 y = 0 以下的世界；该平面在其余时间都停在很远处
    this.clipPlane.constant = 0.003;
    renderer.setClearColor(this.clearColor, 1);
    renderer.setRenderTarget(this.rt);
    renderer.state.buffers.depth.setMask(true);
    renderer.clear();
    renderer.render(scene, vc);
    this.clipPlane.constant = 100000;
    renderer.setClearColor(prevClear, prevAlpha);
    renderer.setRenderTarget(prevRT);
    renderer.shadowMap.autoUpdate = prevShadow;
    for (const o of this.hideInMirror) o.visible = true;
    this.visible = prevVisible;
  }

  _reflect(): void {
    // 镜像由主循环通过 renderMirror() 驱动
  }
}

// ---------------------------------------------------------------------------
// 组装底座 + 人行道 + 路缘
// ---------------------------------------------------------------------------
function buildGround(
  builder: Builder,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
): { ground: WetGround } {
  const tileTex = tileTexture();

  // --- 湿地面 --------------------------------------------------------------
  const ground = new WetGround(renderer);
  ground.position.y = 0.0;
  scene.add(ground);

  // --- 底座（阶梯状，微缩模型的手感） -------------------------------------
  // 单独放在一个合并 group 里，便于渲染镜像时隐藏
  const plinthBuilder = new Builder();
  const plinth = (w: number, h: number, d: number, y: number, col: number) => {
    plinthBuilder.box(w, h, d, toon(col, { ramp: 3 }), { pos: [0, y, 0], outline: 0 });
  };
  // 注意：顶层板停在 y=0 下方 2cm —— 绝不能与湿地面共面，
  // 否则两者会 z-fighting，镜面随之忽隐忽现。
  plinth(26.5, 0.34, 26.5, -0.19, 0x272b36);
  plinth(26.05, 0.92, 26.05, -0.82, 0x1e212a);
  plinth(25.4, 0.16, 25.4, -1.36, 0x161820);
  plinth(24.2, 0.1, 24.2, -1.47, 0x101218);
  plinthBuilder.finalize({ outlineMeshes: false });
  scene.add(plinthBuilder.root);
  ground.hideInMirror.push(plinthBuilder.root);

  // --- 人行道 --------------------------------------------------------------
  const H = STREET.curbH;

  const slab = (x0: number, z0: number, x1: number, z1: number, texScale = 1.35) => {
    const w = x1 - x0, d = z1 - z0;
    const t = tileTex.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(w / texScale)), Math.max(1, Math.round(d / texScale)));
    builder.box(w, H, d, toon(0xffffff, { map: t }), {
      pos: [(x0 + x1) / 2, H / 2, (z0 + z1) / 2], outline: 0.9,
    });
  };

  // 南侧人行道
  slab(-13, WALK.southZ0, 13, WALK.southZ1);
  // 侧街西侧人行道
  slab(-13, -13, -9.6, WALK.southZ0);
  // 侧街东侧人行道
  slab(-5.0, -13, -3.6, 4.6);

  // 路缘边缘（略亮，能接住路灯光）
  const curbMat = toon(COLORS.curb, { ramp: 3 });
  const curb = (x0: number, z0: number, x1: number, z1: number) => {
    builder.box(x1 - x0, H + 0.04, z1 - z0, curbMat, {
      pos: [(x0 + x1) / 2, (H + 0.04) / 2, (z0 + z1) / 2], outline: 1.0,
    });
  };
  curb(-13, WALK.southZ0 - 0.02, 13, WALK.southZ0 + STREET.curbW);
  curb(-9.6 - STREET.curbW, -13, -9.6, 4.6);
  curb(-5.0, -13, -5.0 + STREET.curbW, 4.6);

  return { ground };
}

export { tileTexture, WetGround, buildGround };

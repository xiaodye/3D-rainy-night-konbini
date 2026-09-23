// @ts-nocheck — pending incremental typing (see docs/source-restore.md)

/*
 * Restored from the bundled diorama (see reference/README.md).
 *
 * Mechanically converted back to source: the original module had the same
 * structure, this file just swaps the `window.__M` namespace wiring for ES
 * module imports/exports. The rendering logic itself is unchanged.
 */

import * as THREE from 'three'

import { BASE, STREET, WALK, COLORS, makeRng } from './config'
import { toon, Builder } from './toon'

// ---------------------------------------------------------------------------
// The base plate + the wet street surface.
//  * a 2048px canvas paints every road marking, tile, gutter and puddle mask
//  * a custom shader mixes that paint with a real planar reflection
//  * rain ripples distort the reflection and add micro sparkle
// ---------------------------------------------------------------------------

const S = 2048; // canvas resolution
const PX = S / BASE.size;

const wx = (x) => (x + BASE.half) * PX;
const wz = (z) => (z + BASE.half) * PX;

function rgba(hex, a = 1) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Canvas paint
// ---------------------------------------------------------------------------
function paintGround() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const rng = makeRng(20240917);

  const rect = (x0, z0, x1, z1) => [wx(x0), wz(z0), (x1 - x0) * PX, (z1 - z0) * PX];

  // --- 1. everything starts as damp dark ground -----------------------------
  g.fillStyle = rgba(COLORS.asphaltDark);
  g.fillRect(0, 0, S, S);

  // base asphalt everywhere (the "outside the streets" areas are mostly hidden
  // under sidewalks and buildings, but the edge of the base should still read)
  const fill = (x0, z0, x1, z1, col) => {
    const [a, b, w, h] = rect(x0, z0, x1, z1);
    g.fillStyle = col; g.fillRect(a, b, w, h);
  };

  fill(-13, 4.6, 13, 11.0, rgba(0x373b48)); // main street
  fill(-9.6, -13, -5.0, 4.6, rgba(0x353946)); // side street
  fill(8.4, -13, 10.0, -0.6, rgba(0x2b2e38)); // east alley
  fill(-3.6, -0.6, 13, 4.6, rgba(0x3e424f)); // store forecourt (lighter concrete)
  fill(-3.6, -13, -1.0, -0.6, rgba(0x383c48)); // side lot beside the store
  fill(-5.0, -13, -3.6, 4.6, rgba(0x3a3e4a)); // pavement strip along the side street

  // --- 2. asphalt aggregate noise ------------------------------------------
  for (let i = 0; i < 26000; i++) {
    const x = rng() * S, y = rng() * S;
    const v = rng();
    g.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.012 + rng() * 0.03})` : `rgba(0,0,0,${0.02 + rng() * 0.05})`;
    g.fillRect(x, y, 1 + rng() * 2.2, 1 + rng() * 2.2);
  }
  // broad tonal blotches (oil / wear)
  for (let i = 0; i < 90; i++) {
    const x = rng() * S, y = rng() * S, r = 30 + rng() * 190;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rng() > 0.42;
    grd.addColorStop(0, dark ? 'rgba(0,0,0,0.16)' : 'rgba(150,160,180,0.07)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  // --- 3. concrete joint lines on the forecourt ----------------------------
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 2.4;
  for (let x = -3.6; x <= 13; x += 2.6) {
    g.beginPath(); g.moveTo(wx(x), wz(-0.6)); g.lineTo(wx(x), wz(4.6)); g.stroke();
  }

  // --- 4. road markings ----------------------------------------------------
  g.lineCap = 'butt';
  // main street edge lines
  g.strokeStyle = rgba(COLORS.paint, 0.62);
  g.lineWidth = 0.14 * PX;
  for (const z of [5.05, 10.55]) {
    g.beginPath(); g.moveTo(wx(-13), wz(z)); g.lineTo(wx(13), wz(z)); g.stroke();
  }
  // dashed centre line
  g.strokeStyle = rgba(COLORS.paint, 0.5);
  g.lineWidth = 0.12 * PX;
  for (let x = -12.6; x < 13; x += 2.0) {
    g.beginPath(); g.moveTo(wx(x), wz(7.8)); g.lineTo(wx(x + 1.1), wz(7.8)); g.stroke();
  }
  // side street edge lines
  g.strokeStyle = rgba(COLORS.paint, 0.4);
  g.lineWidth = 0.12 * PX;
  for (const x of [-9.35, -5.25]) {
    g.beginPath(); g.moveTo(wx(x), wz(-13)); g.lineTo(wx(x), wz(4.55)); g.stroke();
  }

  // crosswalk across the main street, aligned with the store driveway
  const cwX0 = 0.7, cwX1 = 3.7;
  for (let x = cwX0; x < cwX1 - 0.01; x += 0.78) {
    g.fillStyle = rgba(COLORS.paint, 0.72);
    g.fillRect(wx(x), wz(4.95), 0.46 * PX, 5.9 * PX);
  }
  // stop line for the side street
  g.fillStyle = rgba(COLORS.paint, 0.66);
  g.fillRect(wx(-9.6), wz(4.72), 4.6 * PX, 0.4 * PX);
  // give-way triangles on the side street
  g.fillStyle = rgba(COLORS.paint, 0.5);
  for (let i = 0; i < 5; i++) {
    const cx = -9.3 + i * 0.95;
    g.beginPath();
    g.moveTo(wx(cx), wz(5.55)); g.lineTo(wx(cx + 0.6), wz(5.55)); g.lineTo(wx(cx + 0.3), wz(6.4));
    g.closePath(); g.fill();
  }

  // parking stalls in the forecourt (three bays + hatched no-park zone)
  g.strokeStyle = rgba(COLORS.paint, 0.6);
  g.lineWidth = 0.13 * PX;
  const bays = [1.1, 3.7, 6.3, 8.9];
  for (const x of bays) {
    g.beginPath(); g.moveTo(wx(x), wz(-0.5)); g.lineTo(wx(x), wz(2.7)); g.stroke();
  }
  g.beginPath(); g.moveTo(wx(1.1), wz(2.7)); g.lineTo(wx(8.9), wz(2.7)); g.stroke();
  // wheel stops
  g.fillStyle = rgba(0x9aa2b2, 0.85);
  for (const x of bays.slice(0, 3)) {
    g.fillRect(wx(x + 0.35), wz(-0.42), 2.0 * PX, 0.2 * PX);
  }
  // diagonal hatching near the store entrance
  g.strokeStyle = rgba(COLORS.paint, 0.34);
  g.lineWidth = 0.1 * PX;
  for (let i = 0; i < 12; i++) {
    const x = 9.4 + i * 0.42;
    g.beginPath(); g.moveTo(wx(x), wz(-0.4)); g.lineTo(wx(x - 1.0), wz(2.6)); g.stroke();
  }

  // --- 5. gutters, grates, manholes ---------------------------------------
  // gutter channel hugging the north curb of the main street
  g.fillStyle = 'rgba(0,0,0,0.30)';
  g.fillRect(wx(-13), wz(4.6), 26 * PX, 0.34 * PX);
  g.fillStyle = 'rgba(0,0,0,0.26)';
  g.fillRect(wx(-13), wz(10.66), 26 * PX, 0.34 * PX);
  g.fillRect(wx(-5.0), wz(-13), 0.34 * PX, 17.6 * PX);
  g.fillRect(wx(-9.94), wz(-13), 0.34 * PX, 17.6 * PX);

  // drain grates
  const grate = (x, z, w, d, rot = 0) => {
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

  // manhole covers
  const manhole = (x, z, r) => {
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

  // --- 6. wetness / puddle mask (separate grayscale map) --------------------
  // black = damp, white = standing water / strong mirror
  const wcv = document.createElement('canvas');
  wcv.width = wcv.height = S;
  const wg = wcv.getContext('2d');
  wg.fillStyle = '#6e6e6e'; // damp asphalt everywhere
  wg.fillRect(0, 0, S, S);
  // softer patches of extra dampness
  for (let i = 0; i < 60; i++) {
    const x = rng() * S, y = rng() * S, r = 60 + rng() * 260;
    const grd = wg.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    wg.fillStyle = grd;
    wg.beginPath(); wg.arc(x, y, r, 0, Math.PI * 2); wg.fill();
  }

  const puddle = (x, z, rx, rz, strength, seed) => {
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

  // big pooling along the gutters and in the low centre of the streets
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

  // scattered small puddles
  for (let i = 0; i < 70; i++) {
    const x = -13 + rng() * 26, z = -13 + rng() * 26;
    puddle(x, z, 0.35 + rng() * 1.1, 0.3 + rng() * 0.9, 0.3 + rng() * 0.4, 300 + i);
  }

  // puddles are strongest right where the store light spills
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
// sidewalk tile texture (small tiling canvas)
// ---------------------------------------------------------------------------
function tileTexture() {
  const T = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = T;
  const g = cv.getContext('2d');
  g.fillStyle = rgba(COLORS.sidewalk);
  g.fillRect(0, 0, T, T);
  const rng = makeRng(77);
  // 4x4 tiles with grout
  const n = 4, s = T / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = 0.92 + rng() * 0.16;
      const c = new THREE.Color(COLORS.sidewalk).multiplyScalar(v);
      g.fillStyle = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
      g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
      // tactile dots on the corner tile
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
// Wet ground mesh with planar reflection
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

  // two octaves of expanding rain rings; returns a screen-space offset
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

  // one directional wave train; returns d(height)/d(p)
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

    // water surface slope -> perturbed reflection direction -> screen offset.
    // This is the physical route: the wave normal tilts the reflected ray, and
    // tilts along the view direction show up as vertical wobble on screen.
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
    // keep the mirror from smearing when the projected uv leaves the render target
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


    // view angle: grazing views reflect much more
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
    // deep water reads darker: the wetter the surface, the more light it swallows
    col *= mix(1.0, 0.78, uWaterDark * wet);
    // faint sky sheen so wet asphalt is not pure black
    col += uSky * wet * (0.16 + 0.30 * fres) * (1.0 - 0.75 * uWaterDark);

    // light pools on the pavement
    for (int i = 0; i < 8; i++) {
      if (i >= uLightCount) break;
      vec3 d = uLightPos[i] - vWorld;
      float dist2 = dot(d, d);
      float r = uLightRad[i].x;
      float att = 1.0 / (1.0 + dist2 / (r * r));
      col += uLightCol[i] * att * uLightRad[i].y * uPoolStrength * mix(0.55, 1.0, wet);
    }

    // wave crests catch the light
    float spark = length(wg);
    col += vec3(0.5, 0.62, 0.85) * spark * uSparkle * wet;

    // fog
    float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    col = mix(col, uFogColor, clamp(f, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

class WetGround extends THREE.Mesh {
  constructor(renderer, size = BASE.size) {
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const textureMatrix = new THREE.Matrix4();
    const maps = paintGround();
    const uniforms = {
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
      uPoolStrength: { value: 1.2 },
      uDebugRefl: { value: 0 },
      uLightPos: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) },
      uLightCol: { value: Array.from({ length: 8 }, () => new THREE.Color(0, 0, 0)) },
      uLightRad: { value: Array.from({ length: 8 }, () => new THREE.Vector2(4, 1)) },
      uLightCount: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: GROUND_VS, fragmentShader: GROUND_FS, uniforms, fog: false,
    });
    super(geo, mat);
    this.frustumCulled = false;
    uniforms.tGround.value = maps.albedo;
    uniforms.tWet.value = maps.wet;
    this.uniforms = uniforms;
    this.renderer = renderer;
    this.textureMatrix = textureMatrix;
    this._lights = 0;

    // reflection target - resolution follows the canvas so zooming never
    // magnifies a fixed-size mirror. No mipmaps: a mipmapped half-float target
    // can be incomplete on some drivers and then samples as black.
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
    this.lookAt = new THREE.Vector3();
    this.rot = new THREE.Matrix4();
    this.rwp = new THREE.Vector3();
    this.cwp = new THREE.Vector3();
    this.hideInMirror = [];
    uniforms.tReflect.value = this.rt.texture;
    this.clearColor = new THREE.Color(0x232c42);
    // one permanent global clipping plane, parked far below except during the
    // mirror pass — avoids the driver-sensitive oblique projection entirely
    renderer.clippingPlanes = [this.clipPlane];
  }

  setSize(w, h) {
    const s = Math.min(this.maxSize || 896, Math.max(512, Math.round(Math.max(w, h) * 0.55)));
    if (this.rt.width !== s) {
      this.rt.setSize(s, s);
      this.rt.texture.generateMipmaps = false;
      this.rt.texture.minFilter = THREE.LinearFilter;
    }
  }

  addLight(pos, color, radius, intensity) {
    const i = this._lights++;
    if (i >= 8) return;
    this.uniforms.uLightPos.value[i].set(pos[0], pos[1], pos[2]);
    this.uniforms.uLightCol.value[i].set(color);
    this.uniforms.uLightRad.value[i].set(radius, intensity);
    this.uniforms.uLightCount.value = this._lights;
  }

  update(t) { this.uniforms.uTime.value = t; }

  /** Renders the mirror target. Call once per frame, before the main render. */
  renderMirror(scene, camera) {
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
    this.lookAt.set(0, 0, -1).applyMatrix4(this.rot).add(this.cwp);
    this.target.subVectors(this.rwp, this.lookAt);
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
    // anything below the water plane must not leak into the mirror
    for (const o of this.hideInMirror) o.visible = false;
    renderer.shadowMap.autoUpdate = false;
    // clip the world under y = 0; the plane is parked far away the rest of the frame
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

  _reflect() {
    // mirrors are driven from the main loop via renderMirror()
  }
}

// ---------------------------------------------------------------------------
// assemble base + sidewalks + curbs
// ---------------------------------------------------------------------------
function buildGround(builder, renderer, scene) {
  const tileTex = tileTexture();

  // --- wet ground ----------------------------------------------------------
  const ground = new WetGround(renderer);
  ground.position.y = 0.0;
  scene.add(ground);

  // --- plinth (stepped, collectible-model feel) ----------------------------
  // kept in its own merged group so it can be hidden while the mirror renders
  const plinthBuilder = new Builder();
  const plinth = (w, h, d, y, col) => {
    plinthBuilder.box(w, h, d, toon(col, { ramp: 3 }), { pos: [0, y, 0], outline: 0 });
  };
  // NOTE: the top slab stops 2cm below y=0 — it must never be coplanar with the
  // wet ground plane, or the two z-fight and the mirror flickers on and off.
  plinth(26.5, 0.34, 26.5, -0.19, 0x272b36);
  plinth(26.05, 0.92, 26.05, -0.82, 0x1e212a);
  plinth(25.4, 0.16, 25.4, -1.36, 0x161820);
  plinth(24.2, 0.1, 24.2, -1.47, 0x101218);
  plinthBuilder.finalize({ outlineMeshes: false });
  scene.add(plinthBuilder.root);
  ground.hideInMirror.push(plinthBuilder.root);

  // --- sidewalks -----------------------------------------------------------
  const H = STREET.curbH;

  const slab = (x0, z0, x1, z1, texScale = 1.35) => {
    const w = x1 - x0, d = z1 - z0;
    const t = tileTex.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(w / texScale)), Math.max(1, Math.round(d / texScale)));
    builder.box(w, H, d, toon(0xffffff, { map: t }), {
      pos: [(x0 + x1) / 2, H / 2, (z0 + z1) / 2], outline: 0.9,
    });
  };

  // south sidewalk
  slab(-13, WALK.southZ0, 13, WALK.southZ1);
  // west sidewalk of the side street
  slab(-13, -13, -9.6, WALK.southZ0);
  // east sidewalk of the side street
  slab(-5.0, -13, -3.6, 4.6);

  // curb noses (slightly lighter, catches the street light)
  const curbMat = toon(COLORS.curb, { ramp: 3 });
  const curb = (x0, z0, x1, z1) => {
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

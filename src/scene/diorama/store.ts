// @ts-nocheck — pending incremental typing (see docs/source-restore.md)

/*
 * Restored from the bundled diorama (see reference/README.md).
 *
 * Mechanically converted back to source: the original module had the same
 * structure, this file just swaps the `window.__M` namespace wiring for ES
 * module imports/exports. The rendering logic itself is unchanged.
 */

import * as THREE from 'three'

import { STORE, COLORS, makeRng, lerp, clamp } from './config'
import { toon, glow, additive } from './toon'

// ---------------------------------------------------------------------------
// The convenience store: shell, illuminated signage, glass storefront, and a
// densely furnished interior that reads clearly through the windows.
// ---------------------------------------------------------------------------

const X0 = STORE.x0, X1 = STORE.x1, Z0 = STORE.z0, Z1 = STORE.z1;
const H = STORE.h;
const WALL = STORE.wallT;
const IX0 = X0 + WALL, IX1 = X1 - WALL;
const IZ0 = Z0 + WALL, IZ1 = Z1 - WALL;
const FLOOR = 0.18;
const CEIL = 2.92;
const FRONT = Z1; // facade plane
const GY0 = STORE.glassBase; // 0.22
const GY1 = STORE.glassTop; // 2.95

// ---------------------------------------------------------------------------
// canvas art helpers
// ---------------------------------------------------------------------------
function cvs(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
const JP = '"Yu Gothic","YuGothic","MS Gothic","Meiryo",sans-serif';
const EN = '"Segoe UI","Helvetica Neue",Arial,sans-serif';

function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Big fascia sign: brand block on the left, name + 24H badge on the right. */
function fasciaTexture() {
  const W = 2048, Hh = 256;
  const [c, g] = cvs(W, Hh);
  const bg = g.createLinearGradient(0, 0, 0, Hh);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.55, '#f2f5fb');
  bg.addColorStop(1, '#dde4f0');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, Hh);

  // brand colour bands top / bottom
  g.fillStyle = '#2f6fe0'; g.fillRect(0, 0, W, 12);
  g.fillStyle = '#ff8a3d'; g.fillRect(0, Hh - 16, W, 16);

  // logo mark
  const cx = 150, cy = Hh / 2, r = 74;
  g.fillStyle = '#2f6fe0';
  roundRect(g, cx - r, cy - r, r * 2, r * 2, 26); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(cx - 46, cy + 40); g.lineTo(cx + 46, cy - 40); g.lineTo(cx + 46, cy - 8);
  g.lineTo(cx - 10, cy + 40); g.closePath(); g.fill();
  g.fillStyle = '#ff8a3d';
  g.beginPath(); g.arc(cx + 34, cy + 30, 20, 0, 6.3); g.fill();

  // wordmark
  g.fillStyle = '#1b2b52';
  g.font = `bold 148px ${EN}`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText('SUNMART', 268, cy - 12);

  g.fillStyle = '#2f6fe0';
  g.font = `600 62px ${JP}`;
  g.fillText('サンマート', 274, cy + 78);

  g.fillStyle = '#5a6b8c';
  g.font = `500 52px ${EN}`;
  g.fillText('CONVENIENCE STORE', 800, cy + 80);

  // 24H badge
  const bx = W - 430;
  g.fillStyle = '#ff8a3d';
  roundRect(g, bx, 44, 360, 168, 26); g.fill();
  g.fillStyle = '#ffffff';
  g.font = `bold 128px ${EN}`;
  g.textAlign = 'center';
  g.fillText('24H', bx + 180, 132);
  g.font = `600 44px ${JP}`;
  g.fillText('年中無休', bx + 180, 190);

  // soft lightbox falloff
  const vg = g.createRadialGradient(W / 2, Hh / 2, Hh * 0.3, W / 2, Hh / 2, W * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(40,60,110,0.18)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, Hh);
  return tex(c);
}

/** Vertical pylon sign (Japanese street-corner style). */
function pylonTexture() {
  const W = 256, Hh = 1024;
  const [c, g] = cvs(W, Hh);
  g.fillStyle = '#f7f9fd'; g.fillRect(0, 0, W, Hh);
  g.fillStyle = '#2f6fe0'; g.fillRect(0, 0, W, 18); g.fillRect(0, Hh - 18, W, 18);

  // logo
  g.fillStyle = '#2f6fe0';
  roundRect(g, 48, 46, 160, 160, 30); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(88, 176); g.lineTo(168, 76); g.lineTo(168, 122); g.lineTo(112, 176); g.closePath(); g.fill();
  g.fillStyle = '#ff8a3d';
  g.beginPath(); g.arc(160, 168, 24, 0, 6.3); g.fill();

  // vertical katakana
  g.fillStyle = '#1b2b52';
  g.font = `bold 118px ${JP}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const chars = ['サ', 'ン', 'マ', 'ー', 'ト'];
  chars.forEach((ch, i) => g.fillText(ch, W / 2, 320 + i * 128));

  g.fillStyle = '#ff8a3d';
  g.font = `bold 66px ${JP}`;
  g.fillText('24時間', W / 2, Hh - 74);
  return tex(c);
}

function posterTexture(seed, hue) {
  const W = 320, Hh = 448;
  const [c, g] = cvs(W, Hh);
  const rng = makeRng(seed);
  const base = new THREE.Color().setHSL(hue, 0.55, 0.62);
  const bg = g.createLinearGradient(0, 0, W, Hh);
  bg.addColorStop(0, `#${base.clone().offsetHSL(0, 0, 0.22).getHexString()}`);
  bg.addColorStop(1, `#${base.clone().offsetHSL(0.05, 0, -0.16).getHexString()}`);
  g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
  // abstract shapes
  for (let i = 0; i < 5; i++) {
    g.globalAlpha = 0.18 + rng() * 0.3;
    g.fillStyle = i % 2 ? '#ffffff' : `#${base.clone().offsetHSL(0.5, 0.1, 0).getHexString()}`;
    g.beginPath();
    g.arc(rng() * W, rng() * Hh * 0.7, 40 + rng() * 130, 0, 6.3);
    g.fill();
  }
  g.globalAlpha = 1;
  // headline bars
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.fillRect(28, Hh - 168, W - 56, 26);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillRect(28, Hh - 128, (W - 56) * 0.66, 16);
  g.fillRect(28, Hh - 100, (W - 56) * 0.45, 16);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.font = `bold 44px ${JP}`;
  g.fillText('新発売', 30, 66);
  return tex(c);
}

function interiorFloorTexture() {
  const S = 1024;
  const [c, g] = cvs(S, S);
  g.fillStyle = '#ded7c9'; g.fillRect(0, 0, S, S);
  const n = 16, s = S / n;
  const rng = makeRng(4242);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = 0.955 + rng() * 0.09;
      const col = new THREE.Color(0xded7c9).multiplyScalar(v);
      g.fillStyle = `#${col.getHexString()}`;
      g.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
    }
  }
  g.strokeStyle = 'rgba(120,110,95,0.22)';
  g.lineWidth = 1.6;
  for (let i = 0; i <= n; i++) {
    g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, S); g.stroke();
    g.beginPath(); g.moveTo(0, i * s); g.lineTo(S, i * s); g.stroke();
  }
  // green guide arrows pointing to the register
  g.fillStyle = 'rgba(38,150,110,0.5)';
  const arrow = (x, y, rot) => {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.beginPath();
    g.moveTo(0, -46); g.lineTo(34, -6); g.lineTo(14, -6); g.lineTo(14, 46);
    g.lineTo(-14, 46); g.lineTo(-14, -6); g.lineTo(-34, -6);
    g.closePath(); g.fill();
    g.restore();
  };
  arrow(S * 0.3, S * 0.28, 0);
  arrow(S * 0.3, S * 0.52, 0);
  arrow(S * 0.62, S * 0.4, Math.PI * 0.5);
  return tex(c);
}

function productColor(i, rng) {
  const pal = [
    0xe8402f, 0xf59a1e, 0xf5d33a, 0x36a862, 0x2b7fe0, 0x6b4fd6, 0xd63f92,
    0xf2f0e8, 0x7fd4e8, 0x8a5a3a, 0xf07ba8, 0x3fc8b4, 0xd13a3a, 0xfaf6ea,
    0xb0b8c8, 0xef7f3a,
  ];
  return pal[(i + Math.floor(rng() * pal.length)) % pal.length];
}

// ---------------------------------------------------------------------------
// glass shader: faint tint, fresnel edge, anime highlight, running rain
// ---------------------------------------------------------------------------
const GLASS_VS = /* glsl */`
  varying vec3 vWorld;
  varying vec2 vUvG;
  varying vec3 vN;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vUvG = uv;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const GLASS_FS = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform vec3 uTint;
  uniform vec3 uLightA;
  uniform vec3 uLightB;
  uniform vec2 uScale;
  varying vec3 vWorld;
  varying vec2 vUvG;
  varying vec3 vN;

  float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

  void main() {
    vec2 uv = vec2(vUvG.x * uScale.x, vUvG.y * uScale.y);
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - abs(dot(normalize(vN), V)), 3.0);

    // running rain: columns of droplets sliding down at different speeds
    float rain = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float col = floor(uv.x * (7.0 + fi * 5.0) + fi * 3.7);
      float rnd = h21(vec2(col, fi));
      float speed = 0.06 + rnd * 0.16;
      float y = uv.y + uTime * speed + rnd * 10.0;
      float cell = floor(y * 2.2);
      float r2 = h21(vec2(col, cell + fi * 11.0));
      float drop = smoothstep(0.94, 1.0, r2);
      float streak = drop * smoothstep(0.0, 0.35, fract(y * 2.2)) * (1.0 - fract(y * 2.2) * 0.55);
      rain += streak * (0.5 - fi * 0.12);
    }

    // slow film of water everywhere
    float film = 0.05 * (0.5 + 0.5 * sin(uv.x * 9.0 + uTime * 0.7)) * 0.5;

    // one soft diagonal anime highlight
    float band = smoothstep(0.34, 0.5, uv.x * 0.42 + uv.y * 0.58)
               * (1.0 - smoothstep(0.5, 0.66, uv.x * 0.42 + uv.y * 0.58));

    vec3 col = uTint * (0.35 + fres * 1.5);
    col += uLightA * (rain * 0.55 + film);
    col += uLightB * band * 0.5;
    col += uLightA * fres * 0.35;

    float a = 0.085 + fres * 0.34 + rain * 0.40 + band * 0.11 + film * 0.16;
    a = clamp(a, 0.0, 0.62);
    gl_FragColor = vec4(col, a);
  }
`;

function glassMaterial(tint = 0x9fc6e8, scale = [3, 2]) {
  return new THREE.ShaderMaterial({
    vertexShader: GLASS_VS, fragmentShader: GLASS_FS,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: {
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(tint) },
      uLightA: { value: new THREE.Color(0xdff0ff) },
      uLightB: { value: new THREE.Color(0xffffff) },
      uScale: { value: new THREE.Vector2(scale[0], scale[1]) },
    },
  });
}

// ---------------------------------------------------------------------------
function buildStore(builder, scene, ctx = {}) {
  const rng = makeRng(5150);
  const group = new THREE.Group();
  scene.add(group);
  const dynamic = { glassMats: [], doors: [], lights: [], flickers: [] };

  const M = {
    wall: toon(COLORS.wall),
    wallShade: toon(COLORS.wallShade),
    trim: toon(COLORS.wallTrim),
    metal: toon(COLORS.metal),
    metalDark: toon(COLORS.metalDark),
    white: toon(0xf2f3f6),
    fascia: toon(0xeef1f7),
    brandBlue: toon(COLORS.brand),
    brandWarm: toon(COLORS.brandWarm),
    sign: glow(0xffffff, 1.55),
    signSoft: glow(0xe8f0ff, 1.25),
    roof: toon(0x6e7079, { ramp: 3 }),
    roofSeam: toon(0x55575f, { ramp: 3 }),
    // interior — emissive-boosted so the shop reads bright through the glass
    floor: toon(0xcbc4b6, { map: interiorFloorTexture(), emissive: 0x201c15 }),
    iWall: toon(0xc2bcb0, { emissive: 0x211d16 }),
    iWallCool: toon(0xb8c0c8, { emissive: 0x181e26 }),
    iCeil: toon(0xc6c2b8, { emissive: 0x211e17 }),
    shelf: toon(0xbcc2cc, { emissive: 0x1c1f24 }),
    shelfEdge: toon(0x9ba2ae, { emissive: 0x15171b }),
    counter: toon(0xd0cabe, { emissive: 0x231f1b }),
    counterTop: toon(0xc2b9ab, { emissive: 0x1f1c18 }),
    lightPanel: glow(0xfff0d0, 0.88),
    lightPanelCool: glow(0xe8f4ff, 0.8),
    fridgeGlow: glow(0xcfe4ff, 0.72),
    fridgeShelf: toon(0xdfe7f0, { emissive: 0x2a3442 }),
    warmGlow: glow(0xffcf8a, 0.9),
    screen: glow(0x9fd8ff, 0.8),
    door: toon(0xdfe4ec),
  };

  // 1. shell
  const wallH = H;
  // back wall
  builder.box(X1 - X0, wallH, WALL, M.wall, { pos: [(X0 + X1) / 2, wallH / 2, Z0 + WALL / 2], outline: 1.1 });
  // left (west) wall
  builder.box(WALL, wallH, Z1 - Z0, M.wall, { pos: [X0 + WALL / 2, wallH / 2, (Z0 + Z1) / 2], outline: 1.1 });
  // right (east) wall
  builder.box(WALL, wallH, Z1 - Z0, M.wall, { pos: [X1 - WALL / 2, wallH / 2, (Z0 + Z1) / 2], outline: 1.1 });

  // front facade above the glass
  const headerY0 = GY1;
  builder.box(X1 - X0, H - headerY0, WALL, M.wall, {
    pos: [(X0 + X1) / 2, (headerY0 + H) / 2, FRONT - WALL / 2], outline: 1.1,
  });
  // front corner pillars
  builder.box(0.62, headerY0, WALL, M.wall, { pos: [X0 + 0.31, headerY0 / 2, FRONT - WALL / 2], outline: 1.1 });
  builder.box(0.62, headerY0, WALL, M.wall, { pos: [X1 - 0.31, headerY0 / 2, FRONT - WALL / 2], outline: 1.1 });
  // low plinth under the glass
  builder.box(X1 - X0 - 1.24, GY0, WALL + 0.06, M.wallShade, {
    pos: [(X0 + X1) / 2, GY0 / 2, FRONT - WALL / 2 + 0.03], outline: 1.0,
  });

  // roof slab + parapet
  builder.box(X1 - X0 + 0.3, 0.22, Z1 - Z0 + 0.3, M.roof, {
    pos: [(X0 + X1) / 2, H - 0.11, (Z0 + Z1) / 2], outline: 1.0,
  });
  // roof membrane seams
  for (let x = X0 + 1.6; x < X1; x += 2.2) {
    builder.box(0.05, 0.03, Z1 - Z0, M.roofSeam, { pos: [x, H + 0.005, (Z0 + Z1) / 2], outline: 0 });
  }
  const parapet = (w, d, x, z) => {
    builder.box(w, 0.34, d, M.wall, { pos: [x, H + 0.17, z], outline: 1.1 });
    builder.box(w + 0.06, 0.06, d + 0.06, M.metalDark, { pos: [x, H + 0.36, z], outline: 0.8 });
  };
  parapet(X1 - X0 + 0.3, 0.22, (X0 + X1) / 2, Z0 - 0.04);
  parapet(0.22, Z1 - Z0 + 0.3, X0 - 0.04, (Z0 + Z1) / 2);
  parapet(0.22, Z1 - Z0 + 0.3, X1 + 0.04, (Z0 + Z1) / 2);
  parapet(X1 - X0 + 0.3, 0.22, (X0 + X1) / 2, Z1 + 0.04);

  // roof clutter
  builder.box(1.1, 0.72, 0.62, M.metal, { pos: [6.9, H + 0.47, -6.4], outline: 1.1 });
  builder.cyl(0.26, 0.26, 0.55, 10, M.metal, { pos: [6.9, H + 0.5, -6.0], rot: [Math.PI / 2, 0, 0], outline: 1.1 });
  builder.box(0.9, 0.6, 0.56, M.metal, { pos: [1.4, H + 0.41, -7.8], outline: 1.1 });
  builder.cyl(0.09, 0.09, 1.3, 8, M.metalDark, { pos: [2.6, H + 0.65, -5.2], outline: 1.0 });
  builder.cyl(0.32, 0.32, 0.14, 10, M.metalDark, { pos: [2.6, H + 1.32, -5.2], outline: 1.0 });
  // low water tank, satellite dish and a service box
  builder.box(0.62, 0.5, 0.62, M.metalDark, { pos: [0.3, H + 0.4, -2.6], outline: 1.0 });
  builder.box(0.68, 0.08, 0.68, M.metal, { pos: [0.3, H + 0.68, -2.6], outline: 0.8 });
  builder.add(new THREE.SphereGeometry(0.42, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.36), M.white, {
    pos: [7.6, H + 0.5, -2.2], rot: [1.1, -0.6, 0], outline: 0.9,
  });
  builder.cyl(0.05, 0.05, 0.5, 8, M.metalDark, { pos: [7.6, H + 0.25, -2.2], outline: 0.6 });
  builder.box(0.5, 0.34, 0.28, M.metal, { pos: [4.9, H + 0.28, -8.4], outline: 0.9 });

  // 2. signage
  const fasciaTex = fasciaTexture();
  const signMat = glow(0xffffff, 1.18, { map: fasciaTex });
  dynamic.flickers.push(signMat);
  // lightbox body
  builder.box(X1 - X0 - 0.24, 1.06, 0.30, M.fascia, {
    pos: [(X0 + X1) / 2, 3.56, FRONT + 0.14], outline: 1.0,
  });
  // lit face
  builder.plane(X1 - X0 - 0.3, 1.0, signMat, { pos: [(X0 + X1) / 2, 3.56, FRONT + 0.30] });
  // under-fascia trim strip with a row of tiny lamps
  builder.box(X1 - X0 - 0.3, 0.06, 0.16, M.metalDark, { pos: [(X0 + X1) / 2, 3.0, FRONT + 0.18], outline: 0 });
  for (let x = X0 + 0.7; x < X1 - 0.5; x += 0.62) {
    builder.cyl(0.055, 0.055, 0.03, 8, M.lightPanel, { pos: [x, 2.97, FRONT + 0.16], outline: 0 });
  }

  // pylon sign on the forecourt corner
  const pylonTex = pylonTexture();
  const pylonFace = glow(0xffffff, 1.22, { map: pylonTex });
  dynamic.flickers.push(pylonFace);
  builder.cyl(0.11, 0.13, 2.0, 10, M.metalDark, { pos: [9.35, 1.0, 2.35], outline: 1.0 });
  builder.box(0.72, 3.3, 0.42, M.fascia, { pos: [9.35, 3.65, 2.35], outline: 1.1 });
  builder.plane(0.66, 3.2, pylonFace, { pos: [9.35, 3.65, 2.35 + 0.215] });
  builder.plane(0.66, 3.2, pylonFace, { pos: [9.35, 3.65, 2.35 - 0.215], rot: [0, Math.PI, 0] });
  builder.plane(0.4, 3.2, pylonFace, { pos: [9.35 + 0.365, 3.65, 2.35], rot: [0, Math.PI / 2, 0] });
  builder.plane(0.4, 3.2, pylonFace, { pos: [9.35 - 0.365, 3.65, 2.35], rot: [0, -Math.PI / 2, 0] });

  // side (west) sign facing the side lot
  builder.box(0.26, 0.9, 3.2, M.fascia, { pos: [X0 - 0.13, 3.55, -4.6], outline: 1.0 });
  builder.plane(3.0, 0.84, signMat, { pos: [X0 - 0.28, 3.55, -4.6], rot: [0, -Math.PI / 2, 0] });

  // 3. storefront glass + mullions
  const glassMat = glassMaterial(0x9fc6e8, [4, 1.6]);
  dynamic.glassMats.push(glassMat);
  const mull = M.metalDark;
  const mullion = (x, w = 0.09) => builder.box(w, GY1 - GY0, 0.12, mull, {
    pos: [x, (GY0 + GY1) / 2, FRONT - 0.06], outline: 0.8,
  });
  // top and bottom rails
  builder.box(X1 - X0 - 1.0, 0.1, 0.14, mull, { pos: [(X0 + X1) / 2, GY1 + 0.02, FRONT - 0.06], outline: 0.9 });
  builder.box(X1 - X0 - 1.0, 0.08, 0.14, mull, { pos: [(X0 + X1) / 2, GY0 - 0.01, FRONT - 0.06], outline: 0.9 });

  const DOOR_X0 = 1.8, DOOR_X1 = 3.8;
  // fixed panes left of the door
  for (const x of [X0 + 0.62, 0.95, 1.38]) mullion(x);
  mullion(DOOR_X0 - 0.05, 0.11);
  mullion(DOOR_X1 + 0.05, 0.11);
  for (const x of [4.25, 5.3, 6.35, 7.4, 8.05]) mullion(x);
  // the glass sheets themselves (one big sheet, mullions read as divisions)
  builder.add(builder.planeGeo(X1 - X0 - 1.24, GY1 - GY0), glassMat, {
    pos: [(X0 + X1) / 2, (GY0 + GY1) / 2, FRONT - 0.055], outline: 0,
  });

  // automatic sliding doors (dynamic)
  const doorGlassL = glassMaterial(0x9fc6e8, [1.2, 1.6]);
  const doorGlassR = glassMaterial(0x9fc6e8, [1.2, 1.6]);
  dynamic.glassMats.push(doorGlassL, doorGlassR);
  const doorFrame = (x) => {
    const g = new THREE.Group();
    g.position.set(x, 0, FRONT - 0.05);
    group.add(g);
    return g;
  };
  const dl = doorFrame(DOOR_X0 + 0.5);
  const dr = doorFrame(DOOR_X1 - 0.5);
  const doorPanel = (parent, mat, sign) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, GY1 - GY0 - 0.06, 0.05), mat);
    m.position.set(0, (GY0 + GY1) / 2, 0);
    parent.add(m);
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.07), M.metalDark);
    f.position.set(0, GY1 - 0.1, 0);
    parent.add(f);
    const f2 = f.clone(); f2.position.y = GY0 + 0.05; parent.add(f2);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.07), M.metalDark);
    rail.position.set(0, (GY0 + GY1) / 2, 0); parent.add(rail);
    // small blue decal band (the classic automatic-door sticker)
    const decal = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.055), M.brandBlue);
    decal.position.set(0, GY1 - 0.42, 0.03); parent.add(decal);
    void sign;
  };
  doorPanel(dl, doorGlassL, true);
  doorPanel(dr, doorGlassR, false);
  dynamic.doors.push({ left: dl, right: dr, x0: DOOR_X0 + 0.5, x1: DOOR_X1 - 0.5 });

  // door threshold + mat
  builder.box(2.3, 0.06, 0.5, M.metal, { pos: [2.8, 0.03, FRONT + 0.24], outline: 0.8 });
  builder.box(2.0, 0.03, 0.62, toon(0x2b2f38), { pos: [2.8, 0.055, FRONT + 0.62], outline: 0.6 });

  // entrance canopy
  builder.box(3.4, 0.14, 1.3, M.fascia, { pos: [2.8, 2.9, FRONT + 0.6], outline: 1.0 });
  builder.box(3.4, 0.06, 0.1, M.metalDark, { pos: [2.8, 2.82, FRONT + 1.2], outline: 0.6 });
  for (const x of [1.7, 2.8, 3.9]) {
    builder.cyl(0.11, 0.11, 0.05, 10, M.lightPanel, { pos: [x, 2.8, FRONT + 0.45], outline: 0 });
  }

  // 4. interior shell
  const iw = IX1 - IX0, id = IZ1 - IZ0;
  const icx = (IX0 + IX1) / 2, icz = (IZ0 + IZ1) / 2;
  // floor
  builder.plate(iw, id, M.floor, { pos: [icx, FLOOR, icz] });
  // ceiling
  builder.plate(iw, id, M.iCeil, { pos: [icx, CEIL, icz], rot: [0, 0, Math.PI] });
  // interior wall skins (brighter than the shell so the inside glows)
  builder.plane(iw, CEIL - FLOOR, M.iWall, { pos: [icx, (FLOOR + CEIL) / 2, IZ0 + 0.02] });
  builder.plane(id, CEIL - FLOOR, M.iWall, { pos: [IX0 + 0.02, (FLOOR + CEIL) / 2, icz], rot: [0, Math.PI / 2, 0] });
  builder.plane(id, CEIL - FLOOR, M.iWallCool, { pos: [IX1 - 0.02, (FLOOR + CEIL) / 2, icz], rot: [0, -Math.PI / 2, 0] });
  // interior side of the front wall (above the glass)
  builder.plane(iw, H - GY1, M.iWall, { pos: [icx, (GY1 + H) / 2, IZ1 - 0.02], rot: [0, Math.PI, 0] });

  // ceiling light panels
  for (let x = IX0 + 1.1; x < IX1 - 0.6; x += 2.1) {
    for (let z = IZ0 + 1.2; z < IZ1 - 0.8; z += 2.6) {
      builder.box(1.5, 0.05, 0.34, M.lightPanel, { pos: [x, CEIL - 0.05, z], outline: 0 });
      builder.box(1.6, 0.08, 0.44, M.iCeil, { pos: [x, CEIL - 0.01, z], outline: 0.5 });
    }
  }

  // 5. interior fittings
  const prod = (x, y, z, w, h, d, col, outline = 0.7) =>
    builder.box(w, h, d, toon(col, { emissive: new THREE.Color(col).multiplyScalar(0.16).getHex() }), {
      pos: [x, y, z], outline,
    });

  // --- back wall: refrigerated drink bank ----------------------------------
  const fz = IZ0 + 0.05;
  const fx0 = IX0 + 1.1, fx1 = IX0 + 6.4;
  builder.box(fx1 - fx0 + 0.3, 2.28, 0.72, M.fridgeShelf, { pos: [(fx0 + fx1) / 2, FLOOR + 1.14, fz + 0.36], outline: 1.0 });
  // glowing back panel
  builder.plane(fx1 - fx0, 1.9, M.fridgeGlow, { pos: [(fx0 + fx1) / 2, FLOOR + 1.2, fz + 0.06] });
  // shelves + bottles
  for (let s = 0; s < 4; s++) {
    const y = FLOOR + 0.36 + s * 0.44;
    builder.box(fx1 - fx0, 0.035, 0.5, M.fridgeShelf, { pos: [(fx0 + fx1) / 2, y, fz + 0.3], outline: 0.5 });
    for (let i = 0; i < 20; i++) {
      const bx = fx0 + 0.14 + i * ((fx1 - fx0 - 0.28) / 19);
      const col = productColor(i + s * 3, rng);
      const bh = 0.24 + rng() * 0.08;
      prod(bx, y + bh / 2 + 0.02, fz + 0.3, 0.15, bh, 0.15, col, 0.5);
      // cap
      prod(bx, y + bh + 0.055, fz + 0.3, 0.08, 0.05, 0.08, col, 0.4);
    }
  }
  // fridge door glass + frames
  const fridgeGlass = glassMaterial(0xbfe0ff, [1.6, 1.2]);
  dynamic.glassMats.push(fridgeGlass);
  const doors = 4;
  for (let i = 0; i < doors; i++) {
    const x = fx0 + (i + 0.5) * (fx1 - fx0) / doors;
    builder.add(builder.planeGeo((fx1 - fx0) / doors - 0.06, 1.94), fridgeGlass, {
      pos: [x, FLOOR + 1.2, fz + 0.72], outline: 0,
    });
    builder.box(0.05, 2.0, 0.06, M.metal, { pos: [fx0 + i * (fx1 - fx0) / doors, FLOOR + 1.2, fz + 0.72], outline: 0.6 });
    builder.box(0.7, 0.05, 0.05, M.metal, { pos: [x, FLOOR + 1.1, fz + 0.76], outline: 0.5 });
  }
  builder.box(fx1 - fx0, 0.12, 0.78, M.metal, { pos: [(fx0 + fx1) / 2, FLOOR + 2.32, fz + 0.4], outline: 0.9 });

  // --- back wall right: chilled bento / onigiri case ------------------------
  const bx0 = fx1 + 0.35, bx1 = IX1 - 0.15;
  builder.box(bx1 - bx0, 2.1, 0.66, M.fridgeShelf, { pos: [(bx0 + bx1) / 2, FLOOR + 1.05, fz + 0.33], outline: 1.0 });
  builder.plane(bx1 - bx0, 1.75, M.fridgeGlow, { pos: [(bx0 + bx1) / 2, FLOOR + 1.1, fz + 0.05] });
  for (let s = 0; s < 3; s++) {
    const y = FLOOR + 0.42 + s * 0.56;
    builder.box(bx1 - bx0, 0.04, 0.46, M.fridgeShelf, { pos: [(bx0 + bx1) / 2, y, fz + 0.3], outline: 0.5 });
    for (let i = 0; i < 5; i++) {
      const px = bx0 + 0.22 + i * ((bx1 - bx0 - 0.44) / 4);
      prod(px, y + 0.12, fz + 0.3, 0.3, 0.2, 0.24, i % 2 ? 0xf0e0b8 : 0xe8d8c0, 0.6);
      prod(px, y + 0.2, fz + 0.44, 0.24, 0.05, 0.03, 0xd94f4f, 0.3);
    }
  }
  builder.add(builder.planeGeo(bx1 - bx0 - 0.04, 1.8), fridgeGlass, {
    pos: [(bx0 + bx1) / 2, FLOOR + 1.1, fz + 0.66], outline: 0,
  });

  // --- gondola shelf runs ---------------------------------------------------
  const shelfRun = (x0, z0, z1) => {
    const w = 1.32, len = z1 - z0, cx = x0 + w / 2, cz = (z0 + z1) / 2;
    builder.box(w, 0.09, len, M.shelf, { pos: [cx, FLOOR + 0.09, cz], outline: 0.9 });
    builder.box(w - 0.1, 0.06, len - 0.06, M.shelfEdge, { pos: [cx, FLOOR + 0.2, cz], outline: 0.6 });
    for (let s = 0; s < 4; s++) {
      const y = FLOOR + 0.44 + s * 0.38;
      builder.box(w, 0.035, len, M.shelf, { pos: [cx, y, cz], outline: 0.6 });
      // coloured price rail (the green / blue conbini shelf strips)
      const railCol = s % 2 ? 0x2f9e6a : 0x2f6fe0;
      const rail = toon(railCol, { emissive: new THREE.Color(railCol).multiplyScalar(0.4).getHex() });
      builder.box(0.03, 0.09, len, rail, { pos: [x0 + 0.015, y - 0.05, cz], outline: 0.3 });
      builder.box(0.03, 0.09, len, rail, { pos: [x0 + w - 0.015, y - 0.05, cz], outline: 0.3 });
      // goods on both faces
      const n = Math.floor(len / 0.2);
      for (let i = 0; i < n; i++) {
        const pz = z0 + 0.11 + i * 0.2;
        const c1 = productColor(i + s, rng);
        prod(x0 + 0.26, y + 0.15, pz, 0.26, 0.28, 0.18, c1, 0.5);
        const c2 = productColor(i + s * 2 + 5, rng);
        prod(x0 + w - 0.26, y + 0.16, pz, 0.26, 0.3, 0.18, c2, 0.5);
      }
    }
    builder.box(w, 0.06, len, M.shelfEdge, { pos: [cx, FLOOR + 1.98, cz], outline: 0.9 });
  };
  shelfRun(IX0 + 0.9, IZ0 + 2.1, IZ1 - 1.2);
  shelfRun(IX0 + 3.5, IZ0 + 2.1, IZ1 - 1.2);

  // --- east wall: snacks + instant noodles ----------------------------------
  const ex = IX1 - 0.02;
  builder.box(0.5, 2.4, 4.6, M.shelf, { pos: [ex - 0.26, FLOOR + 1.2, -6.2], outline: 1.0 });
  for (let s = 0; s < 5; s++) {
    const y = FLOOR + 0.42 + s * 0.44;
    builder.box(0.46, 0.035, 4.5, M.shelf, { pos: [ex - 0.26, y, -6.2], outline: 0.5 });
    for (let i = 0; i < 12; i++) {
      const pz = -8.3 + i * 0.36;
      prod(ex - 0.26, y + 0.14, pz, 0.32, 0.24, 0.28, productColor(i + s * 3, rng), 0.5);
    }
  }
  // freezer case on the east wall near the back
  builder.box(0.8, 1.9, 1.5, M.fridgeShelf, { pos: [ex - 0.4, FLOOR + 0.95, -8.1], outline: 1.0 });
  builder.add(builder.planeGeo(1.4, 1.4), fridgeGlass, {
    pos: [ex - 0.81, FLOOR + 1.0, -8.1], rot: [0, -Math.PI / 2, 0], outline: 0,
  });

  // --- magazine rack (front-left, back to the window) -----------------------
  const magX = IX0 + 1.0, magZ = IZ1 - 0.9;
  builder.box(1.5, 1.5, 0.44, M.shelf, { pos: [magX, FLOOR + 0.78, magZ], outline: 1.0 });
  for (let s = 0; s < 3; s++) {
    const y = FLOOR + 0.3 + s * 0.46;
    builder.box(1.44, 0.03, 0.4, M.shelf, { pos: [magX, y, magZ], outline: 0.4 });
    for (let i = 0; i < 6; i++) {
      const px = magX - 0.62 + i * 0.25;
      const c = productColor(i + s * 4 + 2, rng);
      builder.box(0.22, 0.3, 0.03, toon(c, { emissive: new THREE.Color(c).multiplyScalar(0.4).getHex() }), {
        pos: [px, y + 0.17, magZ - 0.16], rot: [-0.22, 0, 0], outline: 0.5,
      });
    }
  }

  // --- register counter -----------------------------------------------------
  const cz = -2.7, cx0 = IX0 + 4.9, cx1 = IX1 - 0.35;
  builder.box(cx1 - cx0, 0.9, 0.95, M.counter, { pos: [(cx0 + cx1) / 2, FLOOR + 0.45, cz], outline: 1.1 });
  builder.box(cx1 - cx0 + 0.1, 0.07, 1.05, M.counterTop, { pos: [(cx0 + cx1) / 2, FLOOR + 0.93, cz], outline: 1.1 });
  // lower shelf behind
  builder.box(cx1 - cx0, 0.05, 0.5, M.counter, { pos: [(cx0 + cx1) / 2, FLOOR + 0.25, cz - 0.75], outline: 0.7 });
  // POS terminal
  builder.box(0.42, 0.1, 0.34, M.metal, { pos: [cx0 + 0.5, FLOOR + 1.0, cz], outline: 0.7 });
  builder.box(0.4, 0.3, 0.06, M.screen, { pos: [cx0 + 0.5, FLOOR + 1.2, cz - 0.06], rot: [-0.28, 0, 0], outline: 0 });
  builder.box(0.36, 0.28, 0.3, M.metalDark, { pos: [cx0 + 1.05, FLOOR + 1.08, cz], outline: 0.8 });
  // coffee machine
  builder.box(0.5, 0.72, 0.5, M.metalDark, { pos: [cx0 + 1.75, FLOOR + 1.3, cz], outline: 1.0 });
  builder.box(0.44, 0.16, 0.06, M.screen, { pos: [cx0 + 1.75, FLOOR + 1.56, cz + 0.26], outline: 0 });
  builder.box(0.3, 0.1, 0.22, M.metal, { pos: [cx0 + 1.75, FLOOR + 1.0, cz + 0.12], outline: 0.6 });
  // hot food case (oden / steamed buns)
  builder.box(0.72, 0.4, 0.52, M.warmGlow, { pos: [cx0 + 2.55, FLOOR + 1.14, cz], outline: 0 });
  builder.box(0.78, 0.06, 0.58, M.metal, { pos: [cx0 + 2.55, FLOOR + 0.94, cz], outline: 0.7 });
  builder.box(0.74, 0.44, 0.04, M.metal, { pos: [cx0 + 2.55, FLOOR + 1.14, cz + 0.28], outline: 0.5 });
  // lottery / flyer stand on the counter end
  builder.box(0.24, 0.42, 0.3, M.metal, { pos: [cx1 - 0.25, FLOOR + 1.18, cz], outline: 0.7 });
  builder.box(0.22, 0.3, 0.03, toon(0xf2f4f8, { emissive: 0x555a66 }), {
    pos: [cx1 - 0.25, FLOOR + 1.28, cz + 0.16], rot: [-0.16, 0, 0], outline: 0.4,
  });

  // --- behind-counter goods wall (cigarettes / bottles) ---------------------
  const gw = IZ1 - 1.0;
  builder.box(cx1 - cx0, 1.9, 0.3, M.shelf, { pos: [(cx0 + cx1) / 2, FLOOR + 1.5, cz - 1.25], outline: 1.0 });
  for (let s = 0; s < 4; s++) {
    const y = FLOOR + 0.72 + s * 0.42;
    builder.box(cx1 - cx0 - 0.05, 0.03, 0.28, M.shelfEdge, { pos: [(cx0 + cx1) / 2, y, cz - 1.24], outline: 0.4 });
    for (let i = 0; i < 14; i++) {
      const px = cx0 + 0.16 + i * ((cx1 - cx0 - 0.32) / 13);
      const c = productColor(i + s * 5 + 1, rng);
      prod(px, y + 0.11, cz - 1.24, 0.16, 0.2, 0.16, c, 0.5);
    }
  }
  void gw;

  // --- ATM in the front-right corner ---------------------------------------
  builder.box(0.9, 1.7, 0.62, M.metal, { pos: [IX1 - 0.55, FLOOR + 0.85, IZ1 - 0.85], outline: 1.1 });
  builder.box(0.66, 0.44, 0.06, M.screen, { pos: [IX1 - 0.55, FLOOR + 1.24, IZ1 - 1.14], rot: [-0.1, 0, 0], outline: 0 });
  builder.box(0.5, 0.2, 0.04, M.metalDark, { pos: [IX1 - 0.55, FLOOR + 0.9, IZ1 - 1.14], outline: 0.5 });

  // --- back room door -------------------------------------------------------
  builder.box(0.95, 2.0, 0.08, M.door, { pos: [IX0 + 0.52, FLOOR + 1.0, IZ0 + 0.06], outline: 1.0 });
  builder.box(0.1, 0.1, 0.06, M.metal, { pos: [IX0 + 0.88, FLOOR + 1.0, IZ0 + 0.13], outline: 0.5 });
  builder.box(0.34, 0.2, 0.04, M.lightPanel, { pos: [IX0 + 0.52, FLOOR + 2.22, IZ0 + 0.08], outline: 0 });

  // --- posters, clock, wall graphics ---------------------------------------
  const posters = [posterTexture(7, 0.58), posterTexture(21, 0.06), posterTexture(35, 0.86)];
  const posterMats = posters.map((t) => glow(0xffffff, 1.05, { map: t }));
  posterMats.forEach((m, i) => {
    builder.plane(0.82, 1.15, m, { pos: [IX0 + 0.03, FLOOR + 1.75, -3.6 - i * 1.3], rot: [0, Math.PI / 2, 0] });
  });
  // ceiling-hung aisle signs
  for (const [x, z] of [[IX0 + 1.5, IZ0 + 3.6], [IX0 + 4.1, IZ0 + 3.6], [IX0 + 6.6, IZ0 + 5.4]]) {
    builder.box(1.1, 0.34, 0.03, M.lightPanelCool, { pos: [x, CEIL - 0.62, z], outline: 0.5 });
    builder.box(0.05, 0.28, 0.05, M.metalDark, { pos: [x, CEIL - 0.42, z], outline: 0 });
  }
  // wall clock
  builder.cyl(0.22, 0.22, 0.06, 14, M.white, { pos: [IX0 + 0.06, FLOOR + 2.4, IZ1 - 2.2], rot: [0, 0, Math.PI / 2], outline: 0.8 });
  builder.cyl(0.19, 0.19, 0.02, 14, toon(0xf8f8fa, { emissive: 0x4a4a52 }), {
    pos: [IX0 + 0.1, FLOOR + 2.4, IZ1 - 2.2], rot: [0, 0, Math.PI / 2], outline: 0,
  });

  // --- entry clutter --------------------------------------------------------
  // promotion island just inside the door
  (() => {
    const ix = 5.6, iz = -1.5;
    builder.box(1.3, 0.5, 0.62, M.shelf, { pos: [ix, FLOOR + 0.25, iz], outline: 1.0 });
    builder.box(1.38, 0.05, 0.68, M.shelfEdge, { pos: [ix, FLOOR + 0.52, iz], outline: 0.7 });
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 2; j++) {
        const c = productColor(i * 2 + j + 3, rng);
        prod(ix - 0.52 + i * 0.26, FLOOR + 0.66, iz - 0.16 + j * 0.32, 0.22, 0.26, 0.26, c, 0.6);
      }
    }
    // small poster board on top of the island
    builder.box(0.5, 0.3, 0.03, glow(0xf2f6ff, 0.85), { pos: [ix + 0.1, FLOOR + 0.86, iz - 0.3], rot: [-0.25, 0, 0], outline: 0.4 });
  })();
  // newspaper / magazine shelf facing the window
  (() => {
    const nx = IX0 + 0.35, nz = IZ1 - 2.9;
    builder.box(0.4, 1.2, 1.3, M.shelf, { pos: [nx, FLOOR + 0.6, nz], outline: 1.0 });
    for (let s = 0; s < 3; s++) {
      builder.box(0.36, 0.03, 1.26, M.shelfEdge, { pos: [nx, FLOOR + 0.34 + s * 0.36, nz], outline: 0.4 });
      for (let i = 0; i < 5; i++) {
        const c = productColor(i + s * 3 + 6, rng);
        builder.box(0.05, 0.26, 0.2, toon(c, { emissive: new THREE.Color(c).multiplyScalar(0.2).getHex() }), {
          pos: [nx + 0.12, FLOOR + 0.5 + s * 0.36, nz - 0.5 + i * 0.25], outline: 0.5,
        });
      }
    }
  })();
  // basket stack
  for (let i = 0; i < 5; i++) {
    builder.box(0.42, 0.1, 0.3, toon(0x3f6fd0, { emissive: 0x1c2f5a }), {
      pos: [IX0 + 0.45, FLOOR + 0.06 + i * 0.1, IZ1 - 1.9], outline: 0.6,
    });
  }
  // umbrella stand just inside the door
  builder.cyl(0.17, 0.14, 0.62, 12, M.metal, { pos: [IX0 + 1.9, FLOOR + 0.31, IZ1 - 1.15], outline: 1.0 });
  for (let i = 0; i < 4; i++) {
    const a = i * 1.5;
    builder.cyl(0.022, 0.022, 0.8, 6, toon(0x6a7484, { emissive: 0x2a3038 }), {
      pos: [IX0 + 1.9 + Math.cos(a) * 0.06, FLOOR + 0.5, IZ1 - 1.15 + Math.sin(a) * 0.06],
      rot: [0.12 * Math.cos(a), 0, 0.12 * Math.sin(a)], outline: 0.5,
    });
  }

  // 6. lights
  const mk = (x, y, z, col, i, d) => {
    const l = new THREE.PointLight(col, i, d, 2.0);
    l.position.set(x, y, z);
    scene.add(l);
    dynamic.lights.push(l);
    return l;
  };
  mk(icx, CEIL - 0.35, icz + 1.0, 0xffd894, 8.5, 16);
  mk(IX0 + 1.6, CEIL - 0.4, IZ0 + 2.4, 0xffe2ae, 5.0, 12);
  mk(IX1 - 1.2, CEIL - 0.4, IZ0 + 2.4, 0xffd894, 5.0, 12);
  mk(IX1 - 1.6, 2.0, cz, 0xffdc9e, 4.0, 8); // counter pool
  mk(2.8, 2.4, FRONT + 0.5, 0xffd9a0, 9, 9); // under the canopy
  mk(9.35, 4.6, 2.35, 0xbcd8ff, 6, 12); // pylon sign spill

  // forecourt light pools
  if (ctx.ground) {
    ctx.ground.addLight([2.8, 2.6, 0.6], [1.0, 0.82, 0.58], 6.5, 1.05);
    ctx.ground.addLight([3.8, 1.6, -1.6], [1.0, 0.88, 0.7], 9.0, 1.35);
    ctx.ground.addLight([6.5, 1.6, 0.4], [1.0, 0.9, 0.74], 7.0, 0.85);
    ctx.ground.addLight([9.35, 3.6, 2.35], [0.62, 0.76, 1.0], 6.0, 0.75);
    ctx.ground.addLight([2.8, 2.9, 1.4], [1.0, 0.86, 0.66], 4.0, 0.6);
    ctx.ground.addLight([-1.5, 1.6, -2.4], [1.0, 0.9, 0.74], 3.6, 0.6); // vending machine
  }

  // 7. animation
  const cam = new THREE.Vector3();
  let doorState = 0;
  let doorTimer = 3.5;

  function update(t, dt, camera) {
    if (camera) camera.getWorldPosition(cam);
    for (const m of dynamic.glassMats) m.uniforms.uTime.value = t;

    // sign flicker: mostly steady with occasional nervous dips
    const f = 1
      - 0.06 * Math.max(0, Math.sin(t * 0.7) * Math.sin(t * 3.1))
      - 0.10 * Math.max(0, Math.sin(t * 11.3) - 0.93) * 6;
    for (const m of dynamic.flickers) m.color.setScalar(clamp(1.35 * f, 0, 2.2));

    // automatic doors open on their own rhythm
    doorTimer -= dt;
    if (doorTimer <= 0) { doorTimer = 11 + Math.random() * 9; doorState = 1; }
    if (ctx.forceDoor) doorState = 1;
    if (doorState > 0) {
      const d = dynamic.doors[0];
      const open = ctx.forceDoor ? 1 : Math.sin(clamp(doorState, 0, 1) * Math.PI);
      d.left.position.x = lerp(d.x0, d.x0 - 0.92, open);
      d.right.position.x = lerp(d.x1, d.x1 + 0.92, open);
      doorState -= dt * 0.42;
      if (doorState < 0) doorState = 0;
    }
  }

  return { group, update, materials: M, glassMat };
}

export { buildStore };

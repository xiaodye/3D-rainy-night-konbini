/*
 * 还原自打包产物 diorama（见 docs/source-restore.md）。
 *
 * 机械转换回源码：原模块结构相同，本文件只是把 `window.__M` 命名空间
 * 接线换成 ES module 的 import/export，渲染逻辑本身未改动。
 *
 * TYPED ✓ — 见 docs/source-restore.md。
 */

import * as THREE from 'three'

import { STORE, COLORS, makeRng, lerp, clamp } from './config'
import { toon, glow, additive, Builder } from './toon'
import type { Vec3 } from './toon'
import type { WetGround } from './ground'

// ---------------------------------------------------------------------------
// 便利店本体：外壳、发光招牌、玻璃店面，
// 以及透过橱窗也能看清的、陈设密集的店内。
// ---------------------------------------------------------------------------

const X0 = STORE.x0, X1 = STORE.x1, Z0 = STORE.z0, Z1 = STORE.z1;
const H = STORE.h;
const WALL = STORE.wallT;
const IX0 = X0 + WALL, IX1 = X1 - WALL;
const IZ0 = Z0 + WALL, IZ1 = Z1 - WALL;
const FLOOR = 0.18;
const CEIL = 2.92;
const FRONT = Z1; // 立面平面
const GY0 = STORE.glassBase; // 0.22
const GY1 = STORE.glassTop; // 2.95

// ---------------------------------------------------------------------------
// 画布绘制工具
// ---------------------------------------------------------------------------
function cvs(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}
const JP = '"Yu Gothic","YuGothic","MS Gothic","Meiryo",sans-serif';
const EN = '"Segoe UI","Helvetica Neue",Arial,sans-serif';

function tex(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** 门头大招牌：左侧品牌图形块，右侧店名 + 24H 徽标。 */
function fasciaTexture(): THREE.CanvasTexture {
  const W = 2048, Hh = 256;
  const [c, g] = cvs(W, Hh);
  const bg = g.createLinearGradient(0, 0, 0, Hh);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.55, '#f2f5fb');
  bg.addColorStop(1, '#dde4f0');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, Hh);

  // 顶部 / 底部的品牌色带
  g.fillStyle = '#2f6fe0'; g.fillRect(0, 0, W, 12);
  g.fillStyle = '#ff8a3d'; g.fillRect(0, Hh - 16, W, 16);

  // 品牌图形
  const cx = 150, cy = Hh / 2, r = 74;
  g.fillStyle = '#2f6fe0';
  roundRect(g, cx - r, cy - r, r * 2, r * 2, 26); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(cx - 46, cy + 40); g.lineTo(cx + 46, cy - 40); g.lineTo(cx + 46, cy - 8);
  g.lineTo(cx - 10, cy + 40); g.closePath(); g.fill();
  g.fillStyle = '#ff8a3d';
  g.beginPath(); g.arc(cx + 34, cy + 30, 20, 0, 6.3); g.fill();

  // 店名字标
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

  // 24H 徽标
  const bx = W - 430;
  g.fillStyle = '#ff8a3d';
  roundRect(g, bx, 44, 360, 168, 26); g.fill();
  g.fillStyle = '#ffffff';
  g.font = `bold 128px ${EN}`;
  g.textAlign = 'center';
  g.fillText('24H', bx + 180, 132);
  g.font = `600 44px ${JP}`;
  g.fillText('年中無休', bx + 180, 190);

  // 灯箱的柔和渐隐
  const vg = g.createRadialGradient(W / 2, Hh / 2, Hh * 0.3, W / 2, Hh / 2, W * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(40,60,110,0.18)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, Hh);
  return tex(c);
}

/** 竖式灯箱招牌（日式街角风格）。 */
function pylonTexture(): THREE.CanvasTexture {
  const W = 256, Hh = 1024;
  const [c, g] = cvs(W, Hh);
  g.fillStyle = '#f7f9fd'; g.fillRect(0, 0, W, Hh);
  g.fillStyle = '#2f6fe0'; g.fillRect(0, 0, W, 18); g.fillRect(0, Hh - 18, W, 18);

  // 品牌图形
  g.fillStyle = '#2f6fe0';
  roundRect(g, 48, 46, 160, 160, 30); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(88, 176); g.lineTo(168, 76); g.lineTo(168, 122); g.lineTo(112, 176); g.closePath(); g.fill();
  g.fillStyle = '#ff8a3d';
  g.beginPath(); g.arc(160, 168, 24, 0, 6.3); g.fill();

  // 竖排片假名
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

function posterTexture(seed: number, hue: number): THREE.CanvasTexture {
  const W = 320, Hh = 448;
  const [c, g] = cvs(W, Hh);
  const rng = makeRng(seed);
  const base = new THREE.Color().setHSL(hue, 0.55, 0.62);
  const bg = g.createLinearGradient(0, 0, W, Hh);
  bg.addColorStop(0, `#${base.clone().offsetHSL(0, 0, 0.22).getHexString()}`);
  bg.addColorStop(1, `#${base.clone().offsetHSL(0.05, 0, -0.16).getHexString()}`);
  g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
  // 抽象图形
  for (let i = 0; i < 5; i++) {
    g.globalAlpha = 0.18 + rng() * 0.3;
    g.fillStyle = i % 2 ? '#ffffff' : `#${base.clone().offsetHSL(0.5, 0.1, 0).getHexString()}`;
    g.beginPath();
    g.arc(rng() * W, rng() * Hh * 0.7, 40 + rng() * 130, 0, 6.3);
    g.fill();
  }
  g.globalAlpha = 1;
  // 标题色条
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

function interiorFloorTexture(): THREE.CanvasTexture {
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
  // 指向收银台的绿色导视箭头
  g.fillStyle = 'rgba(38,150,110,0.5)';
  const arrow = (x: number, y: number, rot: number) => {
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

function productColor(i: number, rng: () => number): number {
  const pal = [
    0xe8402f, 0xf59a1e, 0xf5d33a, 0x36a862, 0x2b7fe0, 0x6b4fd6, 0xd63f92,
    0xf2f0e8, 0x7fd4e8, 0x8a5a3a, 0xf07ba8, 0x3fc8b4, 0xd13a3a, 0xfaf6ea,
    0xb0b8c8, 0xef7f3a,
  ];
  return pal[(i + Math.floor(rng() * pal.length)) % pal.length];
}

// ---------------------------------------------------------------------------
// 玻璃 shader：淡着色、fresnel 边缘、动画式高光、流动的雨水
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

    // 流动的雨：一列列水珠以不同速度向下滑落
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

    // 覆盖整体的缓慢水膜
    float film = 0.05 * (0.5 + 0.5 * sin(uv.x * 9.0 + uTime * 0.7)) * 0.5;

    // 一道柔和的斜向动画式高光
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

function glassMaterial(tint = 0x9fc6e8, scale: [number, number] = [3, 2]): THREE.ShaderMaterial {
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
/** store 模块需要调用方提供的东西 */
export interface StoreCtx {
  ground?: WetGround
  /** 保持自动门敞开（`?door` 调试参数） */
  forceDoor?: boolean
}

/** store 模块在帧间维持的动画状态 */
interface StoreDynamics {
  /** 带雨痕的玻璃 shader，每帧 tick */
  glassMats: THREE.ShaderMaterial[]
  doors: { left: THREE.Object3D; right: THREE.Object3D; x0: number; x1: number }[]
  lights: THREE.PointLight[]
  /** 闪烁的自发光材质（店招、灯箱面） */
  flickers: THREE.MeshBasicMaterial[]
}

/** store 的 group、每帧 tick，以及共享的玻璃材质 */
export interface StoreHandle {
  group: THREE.Group
  update(t: number, dt: number, camera?: THREE.Camera): void
  materials: Record<string, THREE.Material>
  glassMat: THREE.ShaderMaterial
}

function buildStore(builder: Builder, scene: THREE.Scene, ctx: StoreCtx = {}): StoreHandle {
  const rng = makeRng(5150);
  const group = new THREE.Group();
  scene.add(group);
  const dynamic: StoreDynamics = { glassMats: [], doors: [], lights: [], flickers: [] };

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
    // 店内 —— 提高自发光，让店面透过玻璃看起来明亮
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

  // 1. 外壳
  const wallH = H;
  // 后墙
  builder.box(X1 - X0, wallH, WALL, M.wall, { pos: [(X0 + X1) / 2, wallH / 2, Z0 + WALL / 2], outline: 1.1 });
  // 左（西）墙
  builder.box(WALL, wallH, Z1 - Z0, M.wall, { pos: [X0 + WALL / 2, wallH / 2, (Z0 + Z1) / 2], outline: 1.1 });
  // 右（东）墙
  builder.box(WALL, wallH, Z1 - Z0, M.wall, { pos: [X1 - WALL / 2, wallH / 2, (Z0 + Z1) / 2], outline: 1.1 });

  // 玻璃上方的正立面
  const headerY0 = GY1;
  builder.box(X1 - X0, H - headerY0, WALL, M.wall, {
    pos: [(X0 + X1) / 2, (headerY0 + H) / 2, FRONT - WALL / 2], outline: 1.1,
  });
  // 正面的角柱
  builder.box(0.62, headerY0, WALL, M.wall, { pos: [X0 + 0.31, headerY0 / 2, FRONT - WALL / 2], outline: 1.1 });
  builder.box(0.62, headerY0, WALL, M.wall, { pos: [X1 - 0.31, headerY0 / 2, FRONT - WALL / 2], outline: 1.1 });
  // 玻璃下方的矮踢脚
  builder.box(X1 - X0 - 1.24, GY0, WALL + 0.06, M.wallShade, {
    pos: [(X0 + X1) / 2, GY0 / 2, FRONT - WALL / 2 + 0.03], outline: 1.0,
  });

  // 屋面板 + 女儿墙
  builder.box(X1 - X0 + 0.3, 0.22, Z1 - Z0 + 0.3, M.roof, {
    pos: [(X0 + X1) / 2, H - 0.11, (Z0 + Z1) / 2], outline: 1.0,
  });
  // 屋面卷材的接缝
  for (let x = X0 + 1.6; x < X1; x += 2.2) {
    builder.box(0.05, 0.03, Z1 - Z0, M.roofSeam, { pos: [x, H + 0.005, (Z0 + Z1) / 2], outline: 0 });
  }
  const parapet = (w: number, d: number, x: number, z: number) => {
    builder.box(w, 0.34, d, M.wall, { pos: [x, H + 0.17, z], outline: 1.1 });
    builder.box(w + 0.06, 0.06, d + 0.06, M.metalDark, { pos: [x, H + 0.36, z], outline: 0.8 });
  };
  parapet(X1 - X0 + 0.3, 0.22, (X0 + X1) / 2, Z0 - 0.04);
  parapet(0.22, Z1 - Z0 + 0.3, X0 - 0.04, (Z0 + Z1) / 2);
  parapet(0.22, Z1 - Z0 + 0.3, X1 + 0.04, (Z0 + Z1) / 2);
  parapet(X1 - X0 + 0.3, 0.22, (X0 + X1) / 2, Z1 + 0.04);

  // 屋顶杂物
  builder.box(1.1, 0.72, 0.62, M.metal, { pos: [6.9, H + 0.47, -6.4], outline: 1.1 });
  builder.cyl(0.26, 0.26, 0.55, 10, M.metal, { pos: [6.9, H + 0.5, -6.0], rot: [Math.PI / 2, 0, 0], outline: 1.1 });
  builder.box(0.9, 0.6, 0.56, M.metal, { pos: [1.4, H + 0.41, -7.8], outline: 1.1 });
  builder.cyl(0.09, 0.09, 1.3, 8, M.metalDark, { pos: [2.6, H + 0.65, -5.2], outline: 1.0 });
  builder.cyl(0.32, 0.32, 0.14, 10, M.metalDark, { pos: [2.6, H + 1.32, -5.2], outline: 1.0 });
  // 矮水箱、卫星天线与配电箱
  builder.box(0.62, 0.5, 0.62, M.metalDark, { pos: [0.3, H + 0.4, -2.6], outline: 1.0 });
  builder.box(0.68, 0.08, 0.68, M.metal, { pos: [0.3, H + 0.68, -2.6], outline: 0.8 });
  builder.add(new THREE.SphereGeometry(0.42, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.36), M.white, {
    pos: [7.6, H + 0.5, -2.2], rot: [1.1, -0.6, 0], outline: 0.9,
  });
  builder.cyl(0.05, 0.05, 0.5, 8, M.metalDark, { pos: [7.6, H + 0.25, -2.2], outline: 0.6 });
  builder.box(0.5, 0.34, 0.28, M.metal, { pos: [4.9, H + 0.28, -8.4], outline: 0.9 });

  // 2. 招牌
  const fasciaTex = fasciaTexture();
  const signMat = glow(0xffffff, 1.18, { map: fasciaTex });
  dynamic.flickers.push(signMat);
  // 灯箱箱体
  builder.box(X1 - X0 - 0.24, 1.06, 0.30, M.fascia, {
    pos: [(X0 + X1) / 2, 3.56, FRONT + 0.14], outline: 1.0,
  });
  // 发光面
  builder.plane(X1 - X0 - 0.3, 1.0, signMat, { pos: [(X0 + X1) / 2, 3.56, FRONT + 0.30] });
  // 门头下沿的装饰条，带一排小灯
  builder.box(X1 - X0 - 0.3, 0.06, 0.16, M.metalDark, { pos: [(X0 + X1) / 2, 3.0, FRONT + 0.18], outline: 0 });
  for (let x = X0 + 0.7; x < X1 - 0.5; x += 0.62) {
    builder.cyl(0.055, 0.055, 0.03, 8, M.lightPanel, { pos: [x, 2.97, FRONT + 0.16], outline: 0 });
  }

  // 店前场一角的竖式灯箱
  const pylonTex = pylonTexture();
  const pylonFace = glow(0xffffff, 1.22, { map: pylonTex });
  dynamic.flickers.push(pylonFace);
  builder.cyl(0.11, 0.13, 2.0, 10, M.metalDark, { pos: [9.35, 1.0, 2.35], outline: 1.0 });
  builder.box(0.72, 3.3, 0.42, M.fascia, { pos: [9.35, 3.65, 2.35], outline: 1.1 });
  builder.plane(0.66, 3.2, pylonFace, { pos: [9.35, 3.65, 2.35 + 0.215] });
  builder.plane(0.66, 3.2, pylonFace, { pos: [9.35, 3.65, 2.35 - 0.215], rot: [0, Math.PI, 0] });
  builder.plane(0.4, 3.2, pylonFace, { pos: [9.35 + 0.365, 3.65, 2.35], rot: [0, Math.PI / 2, 0] });
  builder.plane(0.4, 3.2, pylonFace, { pos: [9.35 - 0.365, 3.65, 2.35], rot: [0, -Math.PI / 2, 0] });

  // 朝向西侧空地的侧招牌
  builder.box(0.26, 0.9, 3.2, M.fascia, { pos: [X0 - 0.13, 3.55, -4.6], outline: 1.0 });
  builder.plane(3.0, 0.84, signMat, { pos: [X0 - 0.28, 3.55, -4.6], rot: [0, -Math.PI / 2, 0] });

  // 3. 店面玻璃 + 竖框
  const glassMat = glassMaterial(0x9fc6e8, [4, 1.6]);
  dynamic.glassMats.push(glassMat);
  const mull = M.metalDark;
  const mullion = (x: number, w = 0.09) => builder.box(w, GY1 - GY0, 0.12, mull, {
    pos: [x, (GY0 + GY1) / 2, FRONT - 0.06], outline: 0.8,
  });
  // 上下横档
  builder.box(X1 - X0 - 1.0, 0.1, 0.14, mull, { pos: [(X0 + X1) / 2, GY1 + 0.02, FRONT - 0.06], outline: 0.9 });
  builder.box(X1 - X0 - 1.0, 0.08, 0.14, mull, { pos: [(X0 + X1) / 2, GY0 - 0.01, FRONT - 0.06], outline: 0.9 });

  const DOOR_X0 = 1.8, DOOR_X1 = 3.8;
  // 门左侧的固定玻璃
  for (const x of [X0 + 0.62, 0.95, 1.38]) mullion(x);
  mullion(DOOR_X0 - 0.05, 0.11);
  mullion(DOOR_X1 + 0.05, 0.11);
  for (const x of [4.25, 5.3, 6.35, 7.4, 8.05]) mullion(x);
  // 玻璃本体（一整块，靠竖框形成分格）
  builder.add(builder.planeGeo(X1 - X0 - 1.24, GY1 - GY0), glassMat, {
    pos: [(X0 + X1) / 2, (GY0 + GY1) / 2, FRONT - 0.055], outline: 0,
  });

  // 自动移门（动态）
  const doorGlassL = glassMaterial(0x9fc6e8, [1.2, 1.6]);
  const doorGlassR = glassMaterial(0x9fc6e8, [1.2, 1.6]);
  dynamic.glassMats.push(doorGlassL, doorGlassR);
  const doorFrame = (x: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0, FRONT - 0.05);
    group.add(g);
    return g;
  };
  const dl = doorFrame(DOOR_X0 + 0.5);
  const dr = doorFrame(DOOR_X1 - 0.5);
  const doorPanel = (parent: THREE.Object3D, mat: THREE.Material, sign: boolean) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, GY1 - GY0 - 0.06, 0.05), mat);
    m.position.set(0, (GY0 + GY1) / 2, 0);
    parent.add(m);
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.07), M.metalDark);
    f.position.set(0, GY1 - 0.1, 0);
    parent.add(f);
    const f2 = f.clone(); f2.position.y = GY0 + 0.05; parent.add(f2);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.07), M.metalDark);
    rail.position.set(0, (GY0 + GY1) / 2, 0); parent.add(rail);
    // 一小段蓝色贴纸（自动门上的经典标识）
    const decal = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.055), M.brandBlue);
    decal.position.set(0, GY1 - 0.42, 0.03); parent.add(decal);
    void sign;
  };
  doorPanel(dl, doorGlassL, true);
  doorPanel(dr, doorGlassR, false);
  dynamic.doors.push({ left: dl, right: dr, x0: DOOR_X0 + 0.5, x1: DOOR_X1 - 0.5 });

  // 门口的门槛与地垫
  builder.box(2.3, 0.06, 0.5, M.metal, { pos: [2.8, 0.03, FRONT + 0.24], outline: 0.8 });
  builder.box(2.0, 0.03, 0.62, toon(0x2b2f38), { pos: [2.8, 0.055, FRONT + 0.62], outline: 0.6 });

  // 入口雨棚
  builder.box(3.4, 0.14, 1.3, M.fascia, { pos: [2.8, 2.9, FRONT + 0.6], outline: 1.0 });
  builder.box(3.4, 0.06, 0.1, M.metalDark, { pos: [2.8, 2.82, FRONT + 1.2], outline: 0.6 });
  for (const x of [1.7, 2.8, 3.9]) {
    builder.cyl(0.11, 0.11, 0.05, 10, M.lightPanel, { pos: [x, 2.8, FRONT + 0.45], outline: 0 });
  }

  // 4. 店内壳体
  const iw = IX1 - IX0, id = IZ1 - IZ0;
  const icx = (IX0 + IX1) / 2, icz = (IZ0 + IZ1) / 2;
  // 地面
  builder.plate(iw, id, M.floor, { pos: [icx, FLOOR, icz] });
  // 天花板
  builder.plate(iw, id, M.iCeil, { pos: [icx, CEIL, icz], rot: [0, 0, Math.PI] });
  // 店内墙皮（比外壳更亮，让内部有发光感）
  builder.plane(iw, CEIL - FLOOR, M.iWall, { pos: [icx, (FLOOR + CEIL) / 2, IZ0 + 0.02] });
  builder.plane(id, CEIL - FLOOR, M.iWall, { pos: [IX0 + 0.02, (FLOOR + CEIL) / 2, icz], rot: [0, Math.PI / 2, 0] });
  builder.plane(id, CEIL - FLOOR, M.iWallCool, { pos: [IX1 - 0.02, (FLOOR + CEIL) / 2, icz], rot: [0, -Math.PI / 2, 0] });
  // 前墙的内侧（玻璃以上部分）
  builder.plane(iw, H - GY1, M.iWall, { pos: [icx, (GY1 + H) / 2, IZ1 - 0.02], rot: [0, Math.PI, 0] });

  // 天花板 light panels
  for (let x = IX0 + 1.1; x < IX1 - 0.6; x += 2.1) {
    for (let z = IZ0 + 1.2; z < IZ1 - 0.8; z += 2.6) {
      builder.box(1.5, 0.05, 0.34, M.lightPanel, { pos: [x, CEIL - 0.05, z], outline: 0 });
      builder.box(1.6, 0.08, 0.44, M.iCeil, { pos: [x, CEIL - 0.01, z], outline: 0.5 });
    }
  }

  // 5. 店内陈设
  const prod = (
    x: number, y: number, z: number,
    w: number, h: number, d: number,
    col: number, outline = 0.7,
  ) =>
    builder.box(w, h, d, toon(col, { emissive: new THREE.Color(col).multiplyScalar(0.16).getHex() }), {
      pos: [x, y, z], outline,
    });

  // --- 后墙：冷藏饮料柜 ---------------------------------------------------
  const fz = IZ0 + 0.05;
  const fx0 = IX0 + 1.1, fx1 = IX0 + 6.4;
  builder.box(fx1 - fx0 + 0.3, 2.28, 0.72, M.fridgeShelf, { pos: [(fx0 + fx1) / 2, FLOOR + 1.14, fz + 0.36], outline: 1.0 });
  // 发光的背板
  builder.plane(fx1 - fx0, 1.9, M.fridgeGlow, { pos: [(fx0 + fx1) / 2, FLOOR + 1.2, fz + 0.06] });
  // 层板 + 瓶装饮料
  for (let s = 0; s < 4; s++) {
    const y = FLOOR + 0.36 + s * 0.44;
    builder.box(fx1 - fx0, 0.035, 0.5, M.fridgeShelf, { pos: [(fx0 + fx1) / 2, y, fz + 0.3], outline: 0.5 });
    for (let i = 0; i < 20; i++) {
      const bx = fx0 + 0.14 + i * ((fx1 - fx0 - 0.28) / 19);
      const col = productColor(i + s * 3, rng);
      const bh = 0.24 + rng() * 0.08;
      prod(bx, y + bh / 2 + 0.02, fz + 0.3, 0.15, bh, 0.15, col, 0.5);
      // 瓶盖
      prod(bx, y + bh + 0.055, fz + 0.3, 0.08, 0.05, 0.08, col, 0.4);
    }
  }
  // 冷柜门玻璃 + 门框
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

  // --- 后墙右侧：冷藏便当 / 饭团柜 ----------------------------------------
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

  // --- 中央货架排 ---------------------------------------------------------
  const shelfRun = (x0: number, z0: number, z1: number) => {
    const w = 1.32, len = z1 - z0, cx = x0 + w / 2, cz = (z0 + z1) / 2;
    builder.box(w, 0.09, len, M.shelf, { pos: [cx, FLOOR + 0.09, cz], outline: 0.9 });
    builder.box(w - 0.1, 0.06, len - 0.06, M.shelfEdge, { pos: [cx, FLOOR + 0.2, cz], outline: 0.6 });
    for (let s = 0; s < 4; s++) {
      const y = FLOOR + 0.44 + s * 0.38;
      builder.box(w, 0.035, len, M.shelf, { pos: [cx, y, cz], outline: 0.6 });
      // 彩色价签条（便利店里常见的绿 / 蓝货架条）
      const railCol = s % 2 ? 0x2f9e6a : 0x2f6fe0;
      const rail = toon(railCol, { emissive: new THREE.Color(railCol).multiplyScalar(0.4).getHex() });
      builder.box(0.03, 0.09, len, rail, { pos: [x0 + 0.015, y - 0.05, cz], outline: 0.3 });
      builder.box(0.03, 0.09, len, rail, { pos: [x0 + w - 0.015, y - 0.05, cz], outline: 0.3 });
      // 两侧面都摆商品
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

  // --- 东墙：零食 + 方便面 -------------------------------------------------
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
  // 东墙靠里的冷冻柜
  builder.box(0.8, 1.9, 1.5, M.fridgeShelf, { pos: [ex - 0.4, FLOOR + 0.95, -8.1], outline: 1.0 });
  builder.add(builder.planeGeo(1.4, 1.4), fridgeGlass, {
    pos: [ex - 0.81, FLOOR + 1.0, -8.1], rot: [0, -Math.PI / 2, 0], outline: 0,
  });

  // --- 杂志架（左前方，背对橱窗） ------------------------------------------
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

  // --- 收银台 -------------------------------------------------------------
  const cz = -2.7, cx0 = IX0 + 4.9, cx1 = IX1 - 0.35;
  builder.box(cx1 - cx0, 0.9, 0.95, M.counter, { pos: [(cx0 + cx1) / 2, FLOOR + 0.45, cz], outline: 1.1 });
  builder.box(cx1 - cx0 + 0.1, 0.07, 1.05, M.counterTop, { pos: [(cx0 + cx1) / 2, FLOOR + 0.93, cz], outline: 1.1 });
  // 后侧的底层搁板
  builder.box(cx1 - cx0, 0.05, 0.5, M.counter, { pos: [(cx0 + cx1) / 2, FLOOR + 0.25, cz - 0.75], outline: 0.7 });
  // POS 收银机
  builder.box(0.42, 0.1, 0.34, M.metal, { pos: [cx0 + 0.5, FLOOR + 1.0, cz], outline: 0.7 });
  builder.box(0.4, 0.3, 0.06, M.screen, { pos: [cx0 + 0.5, FLOOR + 1.2, cz - 0.06], rot: [-0.28, 0, 0], outline: 0 });
  builder.box(0.36, 0.28, 0.3, M.metalDark, { pos: [cx0 + 1.05, FLOOR + 1.08, cz], outline: 0.8 });
  // 咖啡机
  builder.box(0.5, 0.72, 0.5, M.metalDark, { pos: [cx0 + 1.75, FLOOR + 1.3, cz], outline: 1.0 });
  builder.box(0.44, 0.16, 0.06, M.screen, { pos: [cx0 + 1.75, FLOOR + 1.56, cz + 0.26], outline: 0 });
  builder.box(0.3, 0.1, 0.22, M.metal, { pos: [cx0 + 1.75, FLOOR + 1.0, cz + 0.12], outline: 0.6 });
  // 热食柜（关东煮 / 包子）
  builder.box(0.72, 0.4, 0.52, M.warmGlow, { pos: [cx0 + 2.55, FLOOR + 1.14, cz], outline: 0 });
  builder.box(0.78, 0.06, 0.58, M.metal, { pos: [cx0 + 2.55, FLOOR + 0.94, cz], outline: 0.7 });
  builder.box(0.74, 0.44, 0.04, M.metal, { pos: [cx0 + 2.55, FLOOR + 1.14, cz + 0.28], outline: 0.5 });
  // 台面一端的彩票 / 传单架
  builder.box(0.24, 0.42, 0.3, M.metal, { pos: [cx1 - 0.25, FLOOR + 1.18, cz], outline: 0.7 });
  builder.box(0.22, 0.3, 0.03, toon(0xf2f4f8, { emissive: 0x555a66 }), {
    pos: [cx1 - 0.25, FLOOR + 1.28, cz + 0.16], rot: [-0.16, 0, 0], outline: 0.4,
  });

  // --- 收银台后的商品墙（香烟 / 酒瓶） -------------------------------------
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

  // --- 右前方的 ATM -------------------------------------------------------
  builder.box(0.9, 1.7, 0.62, M.metal, { pos: [IX1 - 0.55, FLOOR + 0.85, IZ1 - 0.85], outline: 1.1 });
  builder.box(0.66, 0.44, 0.06, M.screen, { pos: [IX1 - 0.55, FLOOR + 1.24, IZ1 - 1.14], rot: [-0.1, 0, 0], outline: 0 });
  builder.box(0.5, 0.2, 0.04, M.metalDark, { pos: [IX1 - 0.55, FLOOR + 0.9, IZ1 - 1.14], outline: 0.5 });

  // --- 后场门 ---------------------------------------------------------------
  builder.box(0.95, 2.0, 0.08, M.door, { pos: [IX0 + 0.52, FLOOR + 1.0, IZ0 + 0.06], outline: 1.0 });
  builder.box(0.1, 0.1, 0.06, M.metal, { pos: [IX0 + 0.88, FLOOR + 1.0, IZ0 + 0.13], outline: 0.5 });
  builder.box(0.34, 0.2, 0.04, M.lightPanel, { pos: [IX0 + 0.52, FLOOR + 2.22, IZ0 + 0.08], outline: 0 });

  // --- 海报、挂钟、墙面装饰 -------------------------------------------------
  const posters = [posterTexture(7, 0.58), posterTexture(21, 0.06), posterTexture(35, 0.86)];
  const posterMats = posters.map((t) => glow(0xffffff, 1.05, { map: t }));
  posterMats.forEach((m, i) => {
    builder.plane(0.82, 1.15, m, { pos: [IX0 + 0.03, FLOOR + 1.75, -3.6 - i * 1.3], rot: [0, Math.PI / 2, 0] });
  });
  // 天花板-hung aisle signs
  for (const [x, z] of [[IX0 + 1.5, IZ0 + 3.6], [IX0 + 4.1, IZ0 + 3.6], [IX0 + 6.6, IZ0 + 5.4]]) {
    builder.box(1.1, 0.34, 0.03, M.lightPanelCool, { pos: [x, CEIL - 0.62, z], outline: 0.5 });
    builder.box(0.05, 0.28, 0.05, M.metalDark, { pos: [x, CEIL - 0.42, z], outline: 0 });
  }
  // 挂钟
  builder.cyl(0.22, 0.22, 0.06, 14, M.white, { pos: [IX0 + 0.06, FLOOR + 2.4, IZ1 - 2.2], rot: [0, 0, Math.PI / 2], outline: 0.8 });
  builder.cyl(0.19, 0.19, 0.02, 14, toon(0xf8f8fa, { emissive: 0x4a4a52 }), {
    pos: [IX0 + 0.1, FLOOR + 2.4, IZ1 - 2.2], rot: [0, 0, Math.PI / 2], outline: 0,
  });

  // --- 入口处的陈设 ---------------------------------------------------------
  // 进门处的促销堆头
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
    // 堆头顶部的小海报板
    builder.box(0.5, 0.3, 0.03, glow(0xf2f6ff, 0.85), { pos: [ix + 0.1, FLOOR + 0.86, iz - 0.3], rot: [-0.25, 0, 0], outline: 0.4 });
  })();
  // 面向橱窗的报刊架
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
  // 购物篮叠放
  for (let i = 0; i < 5; i++) {
    builder.box(0.42, 0.1, 0.3, toon(0x3f6fd0, { emissive: 0x1c2f5a }), {
      pos: [IX0 + 0.45, FLOOR + 0.06 + i * 0.1, IZ1 - 1.9], outline: 0.6,
    });
  }
  // 进门处的伞架
  builder.cyl(0.17, 0.14, 0.62, 12, M.metal, { pos: [IX0 + 1.9, FLOOR + 0.31, IZ1 - 1.15], outline: 1.0 });
  for (let i = 0; i < 4; i++) {
    const a = i * 1.5;
    builder.cyl(0.022, 0.022, 0.8, 6, toon(0x6a7484, { emissive: 0x2a3038 }), {
      pos: [IX0 + 1.9 + Math.cos(a) * 0.06, FLOOR + 0.5, IZ1 - 1.15 + Math.sin(a) * 0.06],
      rot: [0.12 * Math.cos(a), 0, 0.12 * Math.sin(a)], outline: 0.5,
    });
  }

  // 6. 灯光
  const mk = (x: number, y: number, z: number, col: number, i: number, d: number) => {
    const l = new THREE.PointLight(col, i, d, 2.0);
    l.position.set(x, y, z);
    scene.add(l);
    dynamic.lights.push(l);
    return l;
  };
  mk(icx, CEIL - 0.35, icz + 1.0, 0xffd894, 8.5, 16);
  mk(IX0 + 1.6, CEIL - 0.4, IZ0 + 2.4, 0xffe2ae, 5.0, 12);
  mk(IX1 - 1.2, CEIL - 0.4, IZ0 + 2.4, 0xffd894, 5.0, 12);
  mk(IX1 - 1.6, 2.0, cz, 0xffdc9e, 4.0, 8); // 收银台光池
  mk(2.8, 2.4, FRONT + 0.5, 0xffd9a0, 9, 9); // 雨棚下
  mk(9.35, 4.6, 2.35, 0xbcd8ff, 6, 12); // 灯箱溢光

  // 店前场的光池
  if (ctx.ground) {
    ctx.ground.addLight([2.8, 2.6, 0.6], [1.0, 0.82, 0.58], 6.5, 1.05);
    ctx.ground.addLight([3.8, 1.6, -1.6], [1.0, 0.88, 0.7], 9.0, 1.35);
    ctx.ground.addLight([6.5, 1.6, 0.4], [1.0, 0.9, 0.74], 7.0, 0.85);
    ctx.ground.addLight([9.35, 3.6, 2.35], [0.62, 0.76, 1.0], 6.0, 0.75);
    ctx.ground.addLight([2.8, 2.9, 1.4], [1.0, 0.86, 0.66], 4.0, 0.6);
    ctx.ground.addLight([-1.5, 1.6, -2.4], [1.0, 0.9, 0.74], 3.6, 0.6); // 自动贩卖机
  }

  // 7. 动画
  const cam = new THREE.Vector3();
  let doorState = 0;
  let doorTimer = 3.5;

  function update(t: number, dt: number, camera?: THREE.Camera): void {
    if (camera) camera.getWorldPosition(cam);
    for (const m of dynamic.glassMats) m.uniforms.uTime.value = t;

    // 招牌闪烁：大部分时间稳定，偶尔神经质地一暗
    const f = 1
      - 0.06 * Math.max(0, Math.sin(t * 0.7) * Math.sin(t * 3.1))
      - 0.10 * Math.max(0, Math.sin(t * 11.3) - 0.93) * 6;
    for (const m of dynamic.flickers) m.color.setScalar(clamp(1.35 * f, 0, 2.2));

    // 自动门按自己的节奏开合
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

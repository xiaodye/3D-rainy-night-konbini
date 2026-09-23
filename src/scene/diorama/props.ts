// @ts-nocheck — pending incremental typing (see docs/source-restore.md)

/*
 * Restored from the bundled diorama (see reference/README.md).
 *
 * Mechanically converted back to source: the original module had the same
 * structure, this file just swaps the `window.__M` namespace wiring for ES
 * module imports/exports. The rendering logic itself is unchanged.
 */

import * as THREE from 'three'

import { COLORS, STREET, WALK, NEIGHBOUR_E, NEIGHBOUR_W, ALLEY_E, makeRng, clamp, lerp } from './config'
import { toon, glow, additive, glowTexture } from './toon'

// ---------------------------------------------------------------------------
// Everything around the store: vending machines, bicycles, poles and wires,
// street lamps, signals, guardrails, signs, bins, the alley and the two
// neighbouring buildings that frame the corner.
// ---------------------------------------------------------------------------

function cvs(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const JP = '"Yu Gothic","YuGothic","MS Gothic","Meiryo",sans-serif';
const EN = '"Segoe UI",Arial,sans-serif';

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// --- vending machine front ---------------------------------------------------
function vendingTexture(accent = '#d93b3b') {
  const W = 256, Hh = 512;
  const [c, g] = cvs(W, Hh);
  g.fillStyle = '#eef1f6'; g.fillRect(0, 0, W, Hh);
  g.fillStyle = accent; g.fillRect(0, 0, W, 92);
  g.fillStyle = '#ffffff';
  g.font = `bold 46px ${JP}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('つめたい', W / 2, 46);
  // product rows behind glass
  const rng = makeRng(31);
  const pal = ['#e8543f', '#f2a03d', '#4fb06d', '#3f8fe8', '#d94f9a', '#5ad0c0', '#f7d94c'];
  for (let r = 0; r < 3; r++) {
    const y = 118 + r * 108;
    g.fillStyle = 'rgba(20,24,32,0.10)';
    g.fillRect(12, y + 76, W - 24, 8);
    for (let i = 0; i < 4; i++) {
      const x = 26 + i * 58;
      g.fillStyle = pal[(i + r * 3) % pal.length];
      roundRect(g, x, y, 44, 74, 8); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(x + 6, y + 14, 32, 12);
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fillRect(x + 6, y + 34, 20, 8);
    }
  }
  // price strip
  g.fillStyle = '#ffffff'; g.fillRect(0, 452, W, 60);
  g.fillStyle = '#1b2b52';
  g.font = `bold 34px ${EN}`;
  g.fillText('¥130', W / 2, 482);
  return tex(c);
}

// --- building facade ---------------------------------------------------------
function facadeTexture({ w = 512, h = 1024, floors = 3, base = '#3a3f4c', win = '#2a2f3c', lit = 0.45, seed = 5, shopfront = false }) {
  const [c, g] = cvs(w, h);
  const rng = makeRng(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  // tile texture
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    g.fillRect(rng() * w, rng() * h, 3, 3);
  }
  const fh = h / floors;
  for (let f = 0; f < floors; f++) {
    const y0 = f * fh;
    // floor separation band
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(0, y0 + fh - 8, w, 8);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(0, y0 + fh - 14, w, 5);
    if (shopfront && f === floors - 1) continue;
    // windows
    const cols = Math.max(2, Math.round(w / 150));
    const ww = (w / cols) * 0.52;
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * (w / cols) - ww / 2;
      const wh = fh * 0.46;
      const wy = y0 + fh * 0.2;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x - 5, wy - 5, ww + 10, wh + 10);
      const on = rng() < lit;
      if (on) {
        const grd = g.createLinearGradient(x, wy, x, wy + wh);
        grd.addColorStop(0, '#ffe4b0');
        grd.addColorStop(1, '#f0b878');
        g.fillStyle = grd;
      } else {
        g.fillStyle = '#232836';
      }
      g.fillRect(x, wy, ww, wh);
      if (on) {
        // curtain / sill silhouette
        g.fillStyle = 'rgba(120,90,60,0.35)';
        g.fillRect(x, wy, ww, wh * (0.18 + rng() * 0.3));
      }
      // frame mullion
      g.fillStyle = 'rgba(20,24,32,0.7)';
      g.fillRect(x + ww / 2 - 2, wy, 4, wh);
      g.fillStyle = 'rgba(150,160,180,0.25)';
      g.fillRect(x - 5, wy + wh + 2, ww + 10, 5);
    }
    // balcony rail on some floors
    if (f % 2 === 1) {
      g.fillStyle = 'rgba(30,34,44,0.75)';
      g.fillRect(0, y0 + fh * 0.72, w, fh * 0.16);
      g.fillStyle = 'rgba(160,170,190,0.3)';
      for (let x = 0; x < w; x += 12) g.fillRect(x, y0 + fh * 0.72, 3, fh * 0.16);
    }
  }
  // drain pipes
  for (const x of [0.06, 0.52, 0.94]) {
    g.fillStyle = 'rgba(24,28,36,0.8)';
    g.fillRect(w * x, 0, 12, h);
    g.fillStyle = 'rgba(140,150,170,0.2)';
    g.fillRect(w * x, 0, 3, h);
  }
  // rain stains
  for (let i = 0; i < 26; i++) {
    const x = rng() * w, ww = 8 + rng() * 40, y = rng() * h * 0.6;
    const grd = g.createLinearGradient(0, y, 0, y + h * 0.5);
    grd.addColorStop(0, 'rgba(0,0,0,0.20)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x, y, ww, h * 0.5);
  }
  return tex(c);
}

// --- signs -------------------------------------------------------------------
function roadSignTexture(text, sub, bg = '#2f6fe0') {
  const W = 512, Hh = 192;
  const [c, g] = cvs(W, Hh);
  g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
  g.strokeStyle = '#ffffff'; g.lineWidth = 8;
  roundRect(g, 10, 10, W - 20, Hh - 20, 16); g.stroke();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold 84px ${JP}`;
  g.fillText(text, W / 2, sub ? Hh * 0.4 : Hh / 2);
  if (sub) { g.font = `500 44px ${EN}`; g.fillText(sub, W / 2, Hh * 0.76); }
  return tex(c);
}

function boardTexture() {
  const W = 512, Hh = 384;
  const [c, g] = cvs(W, Hh);
  g.fillStyle = '#c9c4b4'; g.fillRect(0, 0, W, Hh);
  g.fillStyle = '#8d8778'; g.fillRect(0, 0, W, 26);
  const rng = makeRng(88);
  const cols = ['#f0e8d0', '#e8dcc0', '#f4e8cc'];
  for (let i = 0; i < 5; i++) {
    const x = 24 + (i % 3) * 160, y = 46 + Math.floor(i / 3) * 168;
    g.fillStyle = cols[i % 3];
    g.fillRect(x, y, 140, 150);
    g.fillStyle = `hsl(${Math.floor(rng() * 360)},55%,62%)`;
    g.fillRect(x + 12, y + 14, 116, 54);
    g.fillStyle = 'rgba(60,60,70,0.55)';
    for (let l = 0; l < 4; l++) g.fillRect(x + 12, y + 82 + l * 16, 116 - rng() * 50, 7);
  }
  return tex(c);
}

function shutterTexture() {
  const W = 256, Hh = 256;
  const [c, g] = cvs(W, Hh);
  g.fillStyle = '#4a4f5a'; g.fillRect(0, 0, W, Hh);
  for (let y = 0; y < Hh; y += 12) {
    g.fillStyle = y % 24 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.18)';
    g.fillRect(0, y, W, 8);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 200; i++) g.fillRect(Math.random() * W, Math.random() * Hh, 2, 2);
  return tex(c);
}

// ---------------------------------------------------------------------------
function buildProps(builder, scene, ctx = {}) {
  const rng = makeRng(31415);
  const group = new THREE.Group();
  scene.add(group);
  const dyn = { signals: [], flickers: [], lamps: [] };

  const M = {
    metal: toon(COLORS.metal),
    metalDark: toon(COLORS.metalDark),
    steel: toon(0x8d94a3),
    concrete: toon(0x8f8b84, { ramp: 3 }),
    concreteDark: toon(0x6e6a64, { ramp: 3 }),
    red: toon(COLORS.vendingRed),
    blue: toon(0x2f6fe0),
    white: toon(0xe8ebf0),
    rubber: toon(0x23262e),
    glassDark: toon(0x1d2230),
    foliage: toon(COLORS.foliage),
    foliageLit: toon(COLORS.foliageLit),
    wood: toon(COLORS.wood),
    lampGlow: glow(0xffd9a0, 2.1),
    lampGlowCool: glow(0xcfe4ff, 1.9),
    neon: glow(0xffffff, 1.5),
    binBody: toon(0x4f5666),
  };

  // vending machines
  function vending(x, z, rotY, accent) {
    const t = vendingTexture(accent);
    const face = glow(0xffffff, 1.12, { map: t });
    dyn.flickers.push(face);
    const w = 1.05, d = 0.72, h = 1.92;
    // body
    builder.box(w, h, d, M.white, { pos: [x, h / 2, z], rot: [0, rotY, 0], outline: 1.1 });
    const fwd = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
    const px = x + fwd.x * (d / 2 + 0.012), pz = z + fwd.z * (d / 2 + 0.012);
    builder.plane(w - 0.06, h - 0.08, face, { pos: [px, h / 2 + 0.02, pz], rot: [0, rotY, 0] });
    // base + top cap
    builder.box(w + 0.05, 0.12, d + 0.05, M.metalDark, { pos: [x, 0.06, z], rot: [0, rotY, 0], outline: 0.9 });
    builder.box(w + 0.05, 0.08, d + 0.05, M.metalDark, { pos: [x, h - 0.02, z], rot: [0, rotY, 0], outline: 0.9 });
    // coin slot panel
    const sx = x + fwd.x * (d / 2 + 0.05), sz = z + fwd.z * (d / 2 + 0.05);
    builder.box(0.16, 0.3, 0.06, M.metalDark, { pos: [sx + fwd.z * 0.36, 1.15, sz - fwd.x * 0.36], rot: [0, rotY, 0], outline: 0.7 });
    // glow card
    const card = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.2, h * 1.5), additive(0xfff0d0, 0.7, { map: glowTexture() }));
    card.position.set(x + fwd.x * 0.42, h * 0.5, z + fwd.z * 0.42);
    card.rotation.y = rotY;
    card.renderOrder = 4;
    group.add(card);
    if (ctx.ground) ctx.ground.addLight([x + fwd.x * 0.9, 1.3, z + fwd.z * 0.9], [1.0, 0.9, 0.72], 3.4, 0.55);
  }
  vending(-1.62, -2.6, -Math.PI / 2, '#d93b3b');
  vending(-9.05, -4.6, Math.PI / 2, '#2f6fe0');
  vending(11.9, -0.2, Math.PI, '#27b07a');

  // bicycles
  function bicycle(x, z, rotY, frameCol) {
    const F = toon(frameCol);
    const R = 0.325;
    const cos = Math.cos(rotY), sin = Math.sin(rotY);
    // local (along the frame, up, sideways) -> world
    const P = (dx, dy, dz) => [x + dx * cos + dz * sin, dy, z - dx * sin + dz * cos];
    const WR = [0, rotY, 0]; // wheel plane: axis runs across the frame

    // --- wheels: tyre + rim + spokes, no solid disc -------------------------
    for (const dx of [-0.52, 0.52]) {
      const p = P(dx, R, 0);
      builder.add(builder.torusGeo(R, 0.036, 18, 8), M.rubber, { pos: p, rot: WR, outline: 0.6 });
      builder.add(builder.torusGeo(R - 0.052, 0.018, 18, 6), M.steel, { pos: p, rot: WR, outline: 0.4 });
      builder.box(0.05, 0.05, 0.1, M.steel, { pos: p, rot: WR, outline: 0.4 }); // hub
      for (let s = 0; s < 3; s++) {
        const a = (s / 3) * Math.PI;
        builder.box(R * 1.85, 0.013, 0.013, M.steel, {
          pos: p, rot: [0, rotY, a], outline: 0,
        });
      }
    }

    // --- frame --------------------------------------------------------------
    const tube = (a, b, r = 0.022) => {
      const pa = new THREE.Vector3(...a), pb = new THREE.Vector3(...b);
      const mid = pa.clone().add(pb).multiplyScalar(0.5);
      const len = pa.distanceTo(pb);
      const dir = pb.clone().sub(pa).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const e = new THREE.Euler().setFromQuaternion(quat);
      builder.cyl(r, r, len, 8, F, { pos: [mid.x, mid.y, mid.z], rot: [e.x, e.y, e.z], outline: 0.5 });
    };
    const rear = P(-0.52, R, 0), front = P(0.52, R, 0);
    const crank = P(-0.06, 0.3, 0), seatTop = P(-0.11, 0.72, 0), headTop = P(0.3, 0.78, 0);
    tube(rear, crank, 0.024);        // chain stay
    tube(rear, seatTop, 0.022);      // seat stay
    tube(crank, seatTop, 0.026);     // seat tube
    tube(crank, headTop, 0.026);     // down tube
    tube(seatTop, headTop, 0.024);   // top tube
    tube(headTop, front, 0.022);     // fork
    tube(P(0.3, 0.78, 0), P(0.36, 0.9, 0), 0.02); // stem
    tube(P(-0.52, R, 0), P(-0.52, 0.62, 0), 0.018); // seat post rear
    tube(P(-0.52, 0.62, 0), P(-0.14, 0.62, 0), 0.016); // rear rack

    // handlebar
    builder.cyl(0.017, 0.017, 0.44, 8, M.steel, { pos: P(0.36, 0.9, 0), rot: [Math.PI / 2, 0, rotY], outline: 0.5 });
    for (const dz of [-0.19, 0.19]) {
      builder.cyl(0.025, 0.025, 0.1, 8, M.rubber, { pos: P(0.36, 0.9, dz), rot: [Math.PI / 2, 0, rotY], outline: 0.4 });
    }
    // saddle
    builder.box(0.26, 0.055, 0.11, M.rubber, { pos: P(-0.13, 0.76, 0), rot: [0, rotY, 0], outline: 0.6 });
    builder.cyl(0.02, 0.02, 0.14, 6, M.steel, { pos: P(-0.12, 0.69, 0), outline: 0.4 });
    // front basket (dark body with a wire rim and floor)
    const fenderMat = toon(0x7b828e, { ramp: 3 });
    const bk = P(0.47, 0.58, 0);
    builder.box(0.25, 0.19, 0.21, toon(0x2f353f, { ramp: 2 }), { pos: bk, rot: [0, rotY, 0], outline: 0.4 });
    builder.box(0.27, 0.022, 0.23, fenderMat, { pos: [bk[0], bk[1] + 0.1, bk[2]], rot: [0, rotY, 0], outline: 0.5 });
    builder.box(0.27, 0.022, 0.23, fenderMat, { pos: [bk[0], bk[1] - 0.095, bk[2]], rot: [0, rotY, 0], outline: 0.5 });
    // basket stay to the fork
    builder.cyl(0.014, 0.014, 0.2, 6, M.steel, { pos: P(0.5, 0.44, 0), outline: 0.4 });
    // fenders over both wheels (thin, mid grey, hugging the tyre)
    for (const dx of [-0.52, 0.52]) {
      builder.add(new THREE.TorusGeometry(R + 0.052, 0.011, 6, 14, Math.PI * 1.05), fenderMat, {
        pos: P(dx, R, 0), rot: [0, rotY, 0.28], outline: 0.4,
      });
    }
    // chainring + chain
    builder.box(0.17, 0.17, 0.022, M.steel, { pos: P(-0.06, 0.3, 0.05), rot: [0, rotY, 0], outline: 0.4 });
    builder.box(0.5, 0.022, 0.016, M.metalDark, {
      pos: P(-0.29, 0.31, 0.05), rot: [0, rotY, 0.05], outline: 0.3,
    });
    // pedals + crank
    builder.cyl(0.05, 0.05, 0.06, 8, M.steel, { pos: crank, rot: [0, 0, Math.PI / 2], outline: 0.4 });
    for (const s of [-1, 1]) {
      builder.box(0.1, 0.02, 0.05, M.rubber, {
        pos: P(-0.06 + s * 0.12, 0.3 + s * 0.12, 0.08 * s), rot: [0, rotY, 0], outline: 0.4,
      });
    }
    // kickstand
    builder.cyl(0.015, 0.015, 0.3, 6, M.steel, { pos: P(-0.2, 0.16, 0.13), rot: [0.3, rotY, 0.18], outline: 0.4 });
  }
  bicycle(-2.9, -5.4, 0.32, 0x3d4a63);
  bicycle(-2.75, -6.5, 0.18, 0x6a4a52);
  bicycle(7.15, 2.3, -0.5, 0x2f4a52);

  // bike rack
  for (let i = 0; i < 4; i++) {
    const x = -3.05, z = -5.0 - i * 0.62;
    builder.cyl(0.03, 0.03, 0.62, 8, M.steel, { pos: [x, 0.31, z], outline: 0.6 });
    builder.add(builder.torusGeo(0.16, 0.022, 10, 6, Math.PI), M.steel, {
      pos: [x, 0.62, z], rot: [0, 0, 0], outline: 0.5,
    });
  }

  // bins, umbrella stand, sandwich board
  function bin(x, z, rotY, label) {
    const fwd = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
    builder.box(0.52, 0.78, 0.46, M.binBody, { pos: [x, 0.39, z], rot: [0, rotY, 0], outline: 1.1 });
    // lid with a slot
    builder.box(0.56, 0.12, 0.5, M.metalDark, { pos: [x, 0.84, z], rot: [0, rotY, 0], outline: 0.9 });
    builder.box(0.3, 0.04, 0.12, M.metal, {
      pos: [x + fwd.x * 0.2, 0.9, z + fwd.z * 0.2], rot: [0, rotY, 0], outline: 0.4,
    });
    // recycling label
    builder.box(0.34, 0.24, 0.03, label === 'pet' ? M.blue : M.metal, {
      pos: [x + fwd.x * 0.245, 0.6, z + fwd.z * 0.245], rot: [0, rotY, 0], outline: 0.5,
    });
    // opening
    builder.box(0.3, 0.2, 0.05, M.metalDark, {
      pos: [x + fwd.x * 0.25, 0.38, z + fwd.z * 0.25], rot: [0, rotY, 0], outline: 0.5,
    });
    // feet
    for (const s of [-1, 1]) {
      builder.box(0.08, 0.06, 0.08, M.metalDark, {
        pos: [x + fwd.z * 0.18 * s, 0.03, z - fwd.x * 0.18 * s], rot: [0, rotY, 0], outline: 0.4,
      });
    }
  }
  bin(4.55, 0.15, 0, 'pet');
  bin(5.25, 0.15, 0, 'can');
  bin(-2.5, -0.05, Math.PI / 2, 'pet');

  // umbrella stand outside the door
  builder.cyl(0.2, 0.16, 0.68, 14, M.metal, { pos: [1.15, 0.34, 0.28], outline: 1.1 });
  for (let i = 0; i < 5; i++) {
    const a = i * 1.27;
    const c = toon([0x2f6fe0, 0xd94f9a, 0xe8e2d4, 0x3f8fe8, 0x4fb06d][i]);
    builder.cyl(0.026, 0.026, 0.86, 6, c, {
      pos: [1.15 + Math.cos(a) * 0.08, 0.62, 0.28 + Math.sin(a) * 0.08],
      rot: [0.14 * Math.cos(a), 0, 0.14 * Math.sin(a)], outline: 0.5,
    });
  }

  // A-frame sandwich board
  (() => {
    const x = 6.05, z = 0.5, rot = -0.35;
    builder.box(0.62, 0.9, 0.05, M.white, { pos: [x, 0.52, z], rot: [0.2, rot, 0], outline: 0.9 });
    builder.box(0.62, 0.9, 0.05, M.white, { pos: [x, 0.52, z + 0.02], rot: [-0.2, rot, 0], outline: 0.9 });
    builder.box(0.5, 0.12, 0.03, M.blue, { pos: [x + 0.03, 0.78, z], rot: [0.2, rot, 0], outline: 0.4 });
  })();

  // street lamps, utility poles, wires
  const wireMat = toon(0x151820);
  function wire(a, b, sag = 0.5, r = 0.016) {
    const mid = new THREE.Vector3((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - sag, (a[2] + b[2]) / 2);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(...a), mid, new THREE.Vector3(...b),
    ]);
    const geo = new THREE.TubeGeometry(curve, 14, r, 5, false);
    builder.add(geo, wireMat, { outline: 0.4 });
  }

  function pole(x, z, h = 8.4) {
    builder.cyl(0.13, 0.17, h, 10, M.concrete, { pos: [x, h / 2, z], outline: 1.1 });
    // crossarms
    for (const [y, w] of [[h - 0.55, 1.5], [h - 1.15, 1.2]]) {
      builder.box(w, 0.09, 0.09, M.concreteDark, { pos: [x, y, z], outline: 0.8 });
      for (const dx of [-w / 2 + 0.12, w / 2 - 0.12]) {
        builder.cyl(0.05, 0.05, 0.16, 8, M.steel, { pos: [x + dx, y + 0.14, z], outline: 0.5 });
      }
    }
    // transformer
    builder.cyl(0.24, 0.24, 0.62, 12, M.steel, { pos: [x + 0.34, h - 2.3, z], outline: 1.1 });
    builder.cyl(0.26, 0.26, 0.06, 12, M.metalDark, { pos: [x + 0.34, h - 1.97, z], outline: 0.7 });
    // small lamp arm
    builder.cyl(0.05, 0.05, 0.9, 8, M.metalDark, { pos: [x - 0.45, h - 1.9, z], rot: [0, 0, Math.PI / 2], outline: 0.6 });
    builder.box(0.34, 0.12, 0.24, M.metalDark, { pos: [x - 0.88, h - 2.0, z], outline: 0.8 });
    builder.box(0.3, 0.05, 0.2, M.lampGlow, { pos: [x - 0.88, h - 2.08, z], outline: 0 });
    return { x, z, h };
  }

  const p1 = pole(-10.7, 12.1, 8.8);
  const p2 = pole(1.4, 12.4, 8.4);
  const p3 = pole(-6.9, -11.6, 7.6);
  const p4 = pole(12.5, 4.1, 7.2);
  // wire spans
  wire([p1.x - 0.6, p1.h - 0.55, p1.z], [p2.x - 0.6, p2.h - 0.55, p2.z], 1.5);
  wire([p1.x - 0.6, p1.h - 1.15, p1.z], [p2.x - 0.6, p2.h - 1.15, p2.z], 1.7);
  wire([p1.x + 0.6, p1.h - 0.55, p1.z], [p2.x + 0.6, p2.h - 0.55, p2.z], 1.5);
  wire([p1.x + 0.6, p1.h - 1.15, p1.z], [p2.x + 0.6, p2.h - 1.15, p2.z], 1.7);
  wire([p1.x, p1.h - 2.6, p1.z], [p3.x, p3.h - 1.4, p3.z], 1.9, 0.02);
  wire([p1.x, p1.h - 3.0, p1.z], [p3.x, p3.h - 1.8, p3.z], 2.1, 0.02);
  wire([p4.x, p4.h - 1.1, p4.z], [p2.x + 0.4, p2.h - 1.9, p2.z], 1.3, 0.018);
  wire([p4.x, p4.h - 1.5, p4.z], [p2.x + 0.4, p2.h - 2.3, p2.z], 1.4, 0.018);
  // drop line into the store
  wire([p4.x, p4.h - 1.2, p4.z], [9.0, 4.4, -1.2], 0.5, 0.02);

  // street lamp on the sidewalk
  function streetLamp(x, z, rotY = 0, h = 5.2) {
    builder.cyl(0.09, 0.12, h, 10, M.metalDark, { pos: [x, h / 2, z], outline: 1.1 });
    builder.box(0.4, 0.16, 0.4, M.metalDark, { pos: [x, 0.08, z], outline: 0.9 });
    const armX = Math.sin(rotY), armZ = Math.cos(rotY);
    builder.cyl(0.06, 0.06, 1.0, 8, M.metalDark, {
      pos: [x + armX * 0.5, h - 0.1, z + armZ * 0.5], rot: [0, rotY, Math.PI / 2], outline: 0.7,
    });
    builder.cyl(0.3, 0.16, 0.26, 12, M.metalDark, { pos: [x + armX * 1.0, h - 0.2, z + armZ * 1.0], outline: 1.0 });
    builder.cyl(0.24, 0.24, 0.06, 12, M.lampGlow, { pos: [x + armX * 1.0, h - 0.33, z + armZ * 1.0], outline: 0 });
    // halo
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), additive(0xffd9a0, 0.55, { map: glowTexture() }));
    halo.position.set(x + armX * 1.0, h - 0.4, z + armZ * 1.0);
    halo.renderOrder = 4;
    group.add(halo);
    dyn.lamps.push(halo);
    const l = new THREE.PointLight(0xffd9a0, 9, 13, 2);
    l.position.set(x + armX * 1.0, h - 0.5, z + armZ * 1.0);
    scene.add(l);
    if (ctx.ground) ctx.ground.addLight([x + armX * 1.0, h - 0.4, z + armZ * 1.0], [1.0, 0.84, 0.6], 5.4, 1.0);
  }
  streetLamp(-5.3, 11.7, Math.PI * 0.5);
  streetLamp(-8.0, -8.4, Math.PI * 1.15, 4.6);
  streetLamp(11.4, -6.4, -Math.PI * 0.6, 4.4);
  streetLamp(12.2, 12.0, -Math.PI * 0.35, 5.0);

  // traffic signals
  function signalHead(x, y, z, rotY, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.scale.setScalar(scale);
    group.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.3, 0.22), M.metalDark);
    g.add(body);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.06, 0.3), M.metalDark);
    visor.position.set(0, 0.16, 0.03);
    g.add(visor);
    const cols = [0xff5a4d, 0xffcf4d, 0x62e6a4];
    const lamps = cols.map((c, i) => {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.12), toneMapped: false });
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.098, 14), m);
      l.position.set(-0.24 + i * 0.24, 0, 0.115);
      g.add(l);
      return m;
    });
    dyn.signals.push({ lamps, cols, offset: rng() * 6 });
    return g;
  }
  // junction signal on a pole
  builder.cyl(0.1, 0.12, 5.0, 10, M.metalDark, { pos: [-5.35, 2.5, 10.55], outline: 1.1 });
  signalHead(-5.35, 4.9, 10.3, 0, 1);
  // pedestrian signal
  builder.box(0.26, 0.5, 0.2, M.metalDark, { pos: [-5.35, 3.2, 10.42], outline: 0.9 });
  builder.box(0.18, 0.18, 0.03, glow(0xff5a4d, 1.2), { pos: [-5.35, 3.32, 10.31], outline: 0 });
  builder.box(0.18, 0.18, 0.03, toon(0x1c2028), { pos: [-5.35, 3.08, 10.31], outline: 0 });
  // distant signal at the far end of the main street
  builder.cyl(0.08, 0.1, 4.4, 8, M.metalDark, { pos: [-12.3, 2.2, 5.15], outline: 1.0 });
  signalHead(-12.3, 4.3, 5.4, 0.5, 0.85);

  // guardrail, signs, hydrant, post box, planters
  // guardrail along the south sidewalk
  const gz = 11.55;
  for (let x = -7.4; x <= -0.4; x += 1.4) {
    builder.cyl(0.045, 0.05, 0.86, 8, M.steel, { pos: [x, 0.43, gz], outline: 0.6 });
  }
  for (const y of [0.72, 0.44]) {
    builder.cyl(0.03, 0.03, 7.2, 8, M.steel, { pos: [-3.9, y, gz], rot: [0, 0, Math.PI / 2], outline: 0.5 });
  }
  builder.cyl(0.045, 0.05, 0.86, 8, M.steel, { pos: [-7.4, 0.43, gz], outline: 0.6 });
  builder.cyl(0.045, 0.05, 0.86, 8, M.steel, { pos: [-0.4, 0.43, gz], outline: 0.6 });

  // road name sign on a pole
  (() => {
    const t = roadSignTexture('桜町 3', 'SAKURA-CHO 3', '#2f6fe0');
    builder.cyl(0.05, 0.06, 2.7, 8, M.steel, { pos: [-4.7, 1.35, 11.9], outline: 0.7 });
    builder.plane(1.25, 0.47, glow(0xffffff, 1.0, { map: t }), { pos: [-4.7, 2.45, 11.95] });
    builder.plane(1.25, 0.47, glow(0xffffff, 1.0, { map: t }), { pos: [-4.7, 2.45, 11.85], rot: [0, Math.PI, 0] });
  })();
  // give-way sign at the side street
  (() => {
    const t = roadSignTexture('止まれ', 'STOP', '#c8342f');
    builder.cyl(0.05, 0.06, 2.6, 8, M.steel, { pos: [-5.35, 1.3, 5.6], outline: 0.7 });
    builder.plane(1.0, 0.38, glow(0xffffff, 1.0, { map: t }), { pos: [-5.35, 2.4, 5.65] });
  })();
  // convex traffic mirror at the corner
  (() => {
    builder.cyl(0.05, 0.06, 3.0, 8, M.steel, { pos: [-9.85, 1.5, 3.9], outline: 0.7 });
    builder.add(new THREE.SphereGeometry(0.44, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), toon(0xbfd4e8, { ramp: 3 }), {
      pos: [-9.85, 2.95, 3.9], rot: [Math.PI * 0.62, 0.5, 0], outline: 1.0,
    });
    builder.add(builder.torusGeo(0.44, 0.04, 16, 6), M.metalDark, {
      pos: [-9.85, 2.95, 3.9], rot: [Math.PI * 0.62, 0.5, 0], outline: 0.6,
    });
  })();
  // fire hydrant
  (() => {
    const x = 8.0, z = 11.8;
    builder.cyl(0.14, 0.17, 0.5, 12, toon(0xc23a35), { pos: [x, 0.25, z], outline: 1.0 });
    builder.cyl(0.1, 0.14, 0.22, 12, toon(0xc23a35), { pos: [x, 0.6, z], outline: 1.0 });
    builder.add(builder.sphereGeo(0.11, 12), toon(0xd8483f), { pos: [x, 0.74, z], outline: 1.0 });
    builder.cyl(0.05, 0.05, 0.3, 8, M.metalDark, { pos: [x, 0.45, z], rot: [0, 0, Math.PI / 2], outline: 0.6 });
  })();
  // Japanese post box
  (() => {
    const x = 2.6, z = 12.0;
    builder.cyl(0.19, 0.2, 0.9, 14, toon(0xc8342f), { pos: [x, 0.75, z], outline: 1.1 });
    builder.add(new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xd8483f), {
      pos: [x, 1.2, z], outline: 1.1,
    });
    builder.box(0.3, 0.16, 0.06, toon(0x2a2f3a), { pos: [x, 1.06, z - 0.17], outline: 0.7 });
    builder.cyl(0.05, 0.06, 0.3, 8, M.metalDark, { pos: [x, 0.15, z], outline: 0.6 });
    builder.cyl(0.2, 0.2, 0.04, 14, M.metalDark, { pos: [x, 1.32, z], outline: 0.5 });
  })();
  // planters with clipped shrubs
  for (const [x, z] of [[-8.6, 12.2], [-11.6, 12.2], [-3.1, 12.2]]) {
    builder.box(0.9, 0.42, 0.9, toon(0x6d6a63, { ramp: 3 }), { pos: [x, 0.36, z], outline: 1.0 });
    builder.add(builder.sphereGeo(0.44, 10), M.foliage, { pos: [x, 0.86, z], scale: [1, 0.86, 1], outline: 1.1 });
    builder.add(builder.sphereGeo(0.3, 10), M.foliageLit, { pos: [x + 0.16, 1.02, z - 0.1], outline: 1.0 });
  }

  // bulletin board + neighbour walls
  (() => {
    const t = boardTexture();
    // on the store's west wall, beside the vending machine
    builder.box(1.7, 1.25, 0.09, M.wood, { pos: [-1.12, 1.9, -5.4], rot: [0, -Math.PI / 2, 0], outline: 1.0 });
    builder.plane(1.56, 1.1, glow(0xffffff, 0.92, { map: t }), { pos: [-1.19, 1.9, -5.4], rot: [0, -Math.PI / 2, 0] });
    builder.box(1.8, 0.12, 0.2, M.metalDark, { pos: [-1.14, 2.6, -5.4], rot: [0, -Math.PI / 2, 0], outline: 0.7 });
  })();

  // neighbouring buildings
  function building(box, floors, seed, opts = {}) {
    const { lit = 0.42, base = '#3a3f4c', h = box.h, faces = '+z,-x,+x,-z' } = opts;
    const w = box.x1 - box.x0, d = box.z1 - box.z0;
    const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
    builder.box(w, h, d, toon(0x2c313c, { ramp: 3 }), { pos: [cx, h / 2, cz], outline: 1.2 });
    const list = faces.split(',');
    const tz = list.some((f) => f === '+z' || f === '-z')
      ? facadeTexture({ w: 512, h: 1024, floors, seed, lit, base }) : null;
    const tx = list.some((f) => f === '+x' || f === '-x')
      ? facadeTexture({ w: 512, h: 1024, floors, seed: seed + 3, lit, base }) : null;
    for (const f of list) {
      if (f === '+z') builder.plane(w, h, glow(0xffffff, 0.86, { map: tz }), { pos: [cx, h / 2, box.z1 + 0.01] });
      else if (f === '-z') builder.plane(w, h, glow(0xffffff, 0.86, { map: tz }), { pos: [cx, h / 2, box.z0 - 0.01], rot: [0, Math.PI, 0] });
      else if (f === '+x') builder.plane(d, h, glow(0xffffff, 0.86, { map: tx }), { pos: [box.x1 + 0.01, h / 2, cz], rot: [0, Math.PI / 2, 0] });
      else if (f === '-x') builder.plane(d, h, glow(0xffffff, 0.86, { map: tx }), { pos: [box.x0 - 0.01, h / 2, cz], rot: [0, -Math.PI / 2, 0] });
    }
    // parapet
    builder.box(w + 0.2, 0.28, d + 0.2, toon(0x3a3f4c, { ramp: 3 }), { pos: [cx, h + 0.14, cz], outline: 1.0 });
  }

  // east neighbour (narrow mixed-use block) — its west wall lines the alley
  building({ ...NEIGHBOUR_E, h: NEIGHBOUR_E.h }, 3, 12, { lit: 0.4, base: '#3f4450' });
  // west neighbour (two-storey shop house)
  building({ ...NEIGHBOUR_W, h: NEIGHBOUR_W.h }, 2, 27, { lit: 0.5, base: '#4a443c' });

  // shuttered shopfront on the west neighbour, facing the main street
  (() => {
    const t = shutterTexture();
    builder.plane(2.6, 1.9, toon(0xffffff, { map: t, ramp: 3 }), { pos: [-11.3, 1.15, 4.61] });
    builder.box(2.8, 0.16, 0.24, M.metalDark, { pos: [-11.3, 2.2, 4.55], outline: 0.8 });
    builder.box(2.8, 0.12, 0.3, toon(0x4a3f38, { ramp: 3 }), { pos: [-11.3, 2.4, 4.5], outline: 0.8 });
    // striped awning
    for (let i = 0; i < 8; i++) {
      builder.box(0.34, 0.05, 0.7, i % 2 ? toon(0xb8443f) : toon(0xe4ded0), {
        pos: [-12.4 + i * 0.35, 2.5, 4.85], rot: [0.3, 0, 0], outline: 0.5,
      });
    }
    // wall lamp + small neon
    builder.box(0.1, 0.16, 0.1, M.metalDark, { pos: [-9.7, 2.6, 4.5], outline: 0.6 });
    builder.box(0.08, 0.12, 0.08, glow(0xffcf8a, 1.6), { pos: [-9.7, 2.5, 4.44], outline: 0 });
  })();

  // neon vertical sign on the east neighbour, facing the forecourt
  (() => {
    const t = roadSignTexture('コインランドリー', 'COIN LAUNDRY', '#8b3fd6');
    const mat = glow(0xffffff, 1.5, { map: t });
    dyn.flickers.push(mat);
    builder.box(0.24, 2.3, 0.36, M.metalDark, { pos: [11.4, 4.3, -0.72], outline: 1.0 });
    builder.plane(0.3, 2.2, mat, { pos: [11.4, 4.3, -0.53] });
    if (ctx.ground) ctx.ground.addLight([11.4, 3.6, 0.2], [0.62, 0.4, 1.0], 4.2, 0.55);
  })();

  // pink snack-bar neon on the west neighbour, facing the main street
  (() => {
    const W = 256, Hh = 768;
    const [c, g] = cvs(W, Hh);
    g.fillStyle = '#141018'; g.fillRect(0, 0, W, Hh);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = '#ff4f9a';
    g.shadowBlur = 26;
    g.fillStyle = '#ffb6d8';
    g.font = `bold 96px ${JP}`;
    ['ス', 'ナ', 'ッ', 'ク'].forEach((ch, i) => g.fillText(ch, W / 2, 110 + i * 128));
    g.shadowBlur = 16;
    g.fillStyle = '#ffd9ec';
    g.font = `bold 62px ${JP}`;
    g.fillText('ゆ き', W / 2, Hh - 96);
    const mat = glow(0xffffff, 1.45, { map: tex(c) });
    dyn.flickers.push(mat);
    builder.box(0.22, 1.9, 0.3, M.metalDark, { pos: [-10.6, 3.9, 4.72], outline: 1.0 });
    builder.plane(0.26, 1.8, mat, { pos: [-10.6, 3.9, 4.9] });
    if (ctx.ground) ctx.ground.addLight([-10.6, 3.4, 5.6], [1.0, 0.42, 0.68], 4.4, 0.6);
  })();

  // small cyan shop sign near the side street
  (() => {
    const t = roadSignTexture('クリーニング', 'CLEANING', '#1f8fb8');
    const mat = glow(0xffffff, 1.35, { map: t });
    dyn.flickers.push(mat);
    builder.box(1.5, 0.34, 0.22, M.metalDark, { pos: [-11.2, 3.2, 4.68], outline: 0.9 });
    builder.plane(1.4, 0.28, mat, { pos: [-11.2, 3.2, 4.8] });
  })();

  // AC condensers + pipes on the alley walls
  function acUnit(x, y, z, rotY, w = 0.78) {
    builder.box(w, 0.56, 0.34, toon(0xd8d5cc, { ramp: 3 }), { pos: [x, y, z], rot: [0, rotY, 0], outline: 1.0 });
    builder.cyl(0.19, 0.19, 0.05, 12, toon(0x9a978f, { ramp: 3 }), {
      pos: [x + Math.sin(rotY) * 0.18, y, z + Math.cos(rotY) * 0.18], rot: [Math.PI / 2, 0, rotY], outline: 0.7,
    });
    builder.box(w * 0.9, 0.05, 0.05, M.metalDark, { pos: [x, y - 0.3, z], rot: [0, rotY, 0], outline: 0.5 });
  }
  acUnit(8.55, 1.5, -3.2, Math.PI / 2);
  acUnit(8.55, 2.4, -7.6, Math.PI / 2);
  acUnit(9.85, 1.7, -5.4, -Math.PI / 2);
  acUnit(9.85, 3.9, -9.2, -Math.PI / 2);
  acUnit(9.85, 5.6, -2.4, -Math.PI / 2);
  acUnit(-9.45, 3.2, -6.2, Math.PI / 2);
  acUnit(-9.45, 4.4, -10.4, Math.PI / 2);

  // vertical drain pipes in the alley
  for (const [x, z] of [[8.5, -1.6], [8.5, -8.8], [9.9, -3.8], [9.9, -11.6]]) {
    builder.cyl(0.07, 0.07, 4.4, 8, M.metalDark, { pos: [x, 2.2, z], outline: 0.7 });
    builder.cyl(0.09, 0.09, 0.12, 8, M.metalDark, { pos: [x, 0.2, z], outline: 0.5 });
  }

  // alley clutter: crates, a dumpster, a lantern at the dead end
  builder.box(1.0, 0.62, 0.72, toon(0x3f5a4a, { ramp: 3 }), { pos: [9.3, 0.31, -11.2], outline: 1.1 });
  builder.box(1.04, 0.08, 0.76, M.metalDark, { pos: [9.3, 0.66, -11.2], outline: 0.8 });
  for (let i = 0; i < 3; i++) {
    builder.box(0.42, 0.28, 0.3, toon(0x8a7a5c, { ramp: 3 }), {
      pos: [9.2 + (i % 2) * 0.1, 0.14 + Math.floor(i / 2) * 0.29, -10.2 + (i % 2) * 0.32], outline: 0.8,
    });
  }
  builder.box(0.5, 0.22, 0.1, glow(0xffcf8a, 1.5), { pos: [9.7, 2.9, -12.7], outline: 0 });
  builder.cyl(0.03, 0.03, 0.4, 6, M.metalDark, { pos: [9.7, 3.2, -12.7], outline: 0 });
  if (ctx.ground) ctx.ground.addLight([9.4, 2.6, -12.4], [1.0, 0.76, 0.5], 3.6, 0.6);

  // animation
  function update(t) {
    // traffic signal cycle
    for (const s of dyn.signals) {
      const cyc = (t * 0.32 + s.offset) % 1;
      const phase = cyc < 0.42 ? 0 : cyc < 0.55 ? 1 : 2;
      s.lamps.forEach((m, i) => {
        const on = i === phase;
        const target = new THREE.Color(s.cols[i]).multiplyScalar(on ? 2.1 : 0.10);
        m.color.lerp(target, 0.14);
      });
    }
    // lamp halos breathe a little
    dyn.lamps.forEach((h, i) => {
      h.material.opacity = 0.38 + 0.05 * Math.sin(t * 1.7 + i * 2.1);
    });
    // sign flicker
    for (const m of dyn.flickers) {
      const f = 1 - 0.05 * Math.max(0, Math.sin(t * 5.3 + 1.2) - 0.92) * 8;
      m.color.setScalar(1.4 * f);
    }
  }

  return { group, update, materials: M };
}

export { buildProps };

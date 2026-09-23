/*
 * Restored from the bundled diorama (see reference/README.md).
 *
 * Mechanically converted back to source: the original module had the same
 * structure, this file just swaps the `window.__M` namespace wiring for ES
 * module imports/exports. The rendering logic itself is unchanged.
 *
 * TYPED ✓ — this file has been through the incremental typing pass described in
 * docs/source-restore.md: helpers carry real signatures, data objects are
 * inferred. Use it as the reference for typing the remaining modules.
 */

import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Layout + palette for the rainy-night convenience-store diorama.
// Everything is authored in world units (1 unit ~= 1 meter) on a 26x26 base.
// ---------------------------------------------------------------------------

const BASE = {
  size: 26,
  half: 13,
  thickness: 1.25,
  bevel: 0.24,
  top: 0,
};

// --- streets -----------------------------------------------------------------
const STREET = {
  main: { z0: 4.6, z1: 11.0 }, // runs along X (east-west)
  side: { x0: -9.6, x1: -5.0 }, // narrow side street, runs along Z
  curbH: 0.15,
  curbW: 0.26,
};

const WALK = {
  southZ0: 11.0,
  southZ1: 13.0,
  northZ0: 3.0,
  northZ1: 4.6,
  sideW0: -5.0, // east sidewalk of the side street
  sideW1: -3.6,
  westW0: -13.0, // west sidewalk of the side street
  westW1: -9.6,
};

// --- store -------------------------------------------------------------------
const STORE = {
  x0: -1.0,
  x1: 8.4,
  z0: -9.2,
  z1: -0.6,
  h: 4.3,
  fascia0: 3.05,
  fascia1: 4.05,
  glassBase: 0.22,
  glassTop: 2.95,
  wallT: 0.24,
};

const FORECOURT = { x0: -3.6, x1: 13.0, z0: -0.6, z1: 3.0, y: 0.15 };

const ALLEY_E = { x0: 8.4, x1: 10.0, z0: -13.0, z1: -0.6 };
const NEIGHBOUR_E = { x0: 10.0, x1: 13.0, z0: -13.0, z1: -0.6, h: 7.4 };
const NEIGHBOUR_W = { x0: -13.0, x1: -9.6, z0: -13.0, z1: 4.6, h: 6.1 };

// --- palette -----------------------------------------------------------------
const c = (hex: number): number => hex;
const COLORS = {
  // ground / structure
  asphalt: c(0x2b2f3b),
  asphaltDark: c(0x22252f),
  sidewalk: c(0x565b69),
  sidewalkDark: c(0x464b58),
  curb: c(0x6d7280),
  baseSide: c(0x1a1d27),
  baseTop: c(0x232733),
  paint: c(0xd8dbe2),

  // store exterior
  wall: c(0xd6d0c4),
  wallShade: c(0xb9b3a6),
  wallTrim: c(0x3a4050),
  fascia: c(0xf6f7fb),
  brand: c(0x2f6fe0),
  brandWarm: c(0xff8a3d),
  brandGreen: c(0x27b07a),
  metal: c(0x4a5162),
  metalDark: c(0x2c313d),
  glassTint: c(0x9fc6e8),

  // interior
  floorTile: c(0xd9d2c6),
  floorTile2: c(0xc9c2b6),
  shelf: c(0xe7e9ee),
  shelfEdge: c(0xb9bfcc),
  fridge: c(0xdff0ff),
  warmLight: c(0xfff0cf),
  counter: c(0xdcd6ca),

  // night lighting
  lampWarm: c(0xffcf8a),
  lampCool: c(0xa9c8ff),
  neonPink: c(0xff4f9a),
  neonCyan: c(0x4fdcff),
  neonAmber: c(0xffb347),
  signalRed: c(0xff5a4d),
  signalGreen: c(0x62e6a4),

  // misc props
  vendingRed: c(0xd93b3b),
  vendingBody: c(0xe8ecf2),
  bikeFrame: c(0x38414f),
  foliage: c(0x2f4a38),
  foliageLit: c(0x415e46),
  wood: c(0x7a6350),
  dirt: c(0x4a4550),
};

const OUTLINE = { color: 0x0a0c14, px: 1.95 };

// --- deterministic random ----------------------------------------------------
function makeRng(seed = 1337): () => number {
  let s = seed >>> 0;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** axis-aligned footprint on the ground plane (x/z ranges + sizes) */
export interface Box2 {
  x0: number
  x1: number
  z0: number
  z1: number
  w: number
  d: number
}

// --- tiny helpers ------------------------------------------------------------
const box2 = (x0: number, x1: number, z0: number, z1: number): Box2 => ({
  x0, x1, z0, z1, w: x1 - x0, d: z1 - z0,
});
const inBox = (b: Box2, x: number, z: number): boolean =>
  x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;

export { BASE, STREET, WALK, STORE, FORECOURT, ALLEY_E, NEIGHBOUR_E, NEIGHBOUR_W, COLORS, OUTLINE, makeRng, lerp, clamp, smoothstep, box2, inBox };

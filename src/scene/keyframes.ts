import type { Vec3Like } from './diorama'

/**
 * Camera keyframes for the five narrative acts.
 *
 * Authored in the same spherical system as the bundle's own `fitCamera`
 * (see reference/README.md):
 *     x = tx + sin(az)·cos(el)·dist
 *     y = ty + sin(el)·dist
 *     z = tz + cos(az)·cos(el)·dist
 * so any pose can be reproduced in the upstream demo with
 * `?az=&el=&d=&tx=&ty=&tz=` while calibrating, and the values here are
 * directly interchangeable with that URL form.
 *
 * Interpolating az/el/dist (instead of world positions) makes the camera
 * travel along the orbit around the diorama — cinematic, and it never cuts
 * through the buildings.
 *
 * Scene reference (units ≈ meters, base is 26×26, models on top of it):
 *   store  x[-1.0, 8.4]  z[-9.2, -0.6]  h 4.3   (storefront faces +z at z = -0.6)
 *   forecourt x[-3.6, 13.0] z[-0.6, 3.0]
 *   main street runs along X at z 4.6…11.0 · side street along Z at x -9.6…-5.0
 *   vending machines ≈ (-1.62, -2.6) and (-9.05, -4.6)
 */
export interface Act {
  /** camera look-at point */
  target: Vec3Like
  /** azimuth in degrees */
  az: number
  /** elevation in degrees */
  el: number
  /** distance from target */
  dist: number
}

export interface Pose {
  pos: Vec3Like
  target: Vec3Like
}

export const ACTS: Act[] = [
  // 01 — Arrival: high wide establishing shot of the whole diorama
  { target: { x: 1.4, y: 1.15, z: -1.4 }, az: 23, el: 21, dist: 47 },
  // 02 — Storefront: street level, the glowing shopfront straight on
  { target: { x: 3.2, y: 1.7, z: -0.6 }, az: 5, el: 7.5, dist: 15 },
  // 03 — Through the glass: right up against the window, interior beyond
  { target: { x: 3.4, y: 1.6, z: -1.0 }, az: 2, el: 3, dist: 6 },
  // 04 — Street Corner: around to the side street, signals and vending machines
  { target: { x: -2.5, y: 1.6, z: 0.6 }, az: -28, el: 9, dist: 17 },
  // 05 — Night: pulled back and low, the glowing box in the big dark
  { target: { x: 1.2, y: 2.4, z: -1.6 }, az: 27, el: 6, dist: 33 },
]

const DEG = Math.PI / 180
const smooth = (t: number) => t * t * (3 - 2 * t)

/** az → world position (identical math to the bundle's fitCamera) */
export function poseFrom(act: Act): Pose {
  const az = act.az * DEG
  const el = act.el * DEG
  return {
    pos: {
      x: act.target.x + Math.sin(az) * Math.cos(el) * act.dist,
      y: act.target.y + Math.sin(el) * act.dist,
      z: act.target.z + Math.cos(az) * Math.cos(el) * act.dist,
    },
    target: { ...act.target },
  }
}

/**
 * Unwrap azimuths so a chain of acts never jumps across the ±180° seam.
 * (Not needed for the current set — all |Δaz| < 180° — but this keeps future
 * acts that orbit past the back of the store correct.)
 */
export function unwrapAzimuths(acts: Act[]): Act[] {
  if (acts.length === 0) return acts
  const out: Act[] = [acts[0]]
  for (let i = 1; i < acts.length; i++) {
    const prev = out[i - 1]
    let az = acts[i].az
    while (az - prev.az > 180) az -= 360
    while (az - prev.az < -180) az += 360
    out.push({ ...acts[i], az })
  }
  return out
}

const UNWRAPPED = unwrapAzimuths(ACTS)

/** progress 0..1 → interpolated camera pose (smoothstep between acts) */
export function interpolateActs(progress: number): Pose {
  const p = Math.min(Math.max(progress, 0), 1)
  const t = p * (UNWRAPPED.length - 1)
  const i = Math.min(Math.floor(t), UNWRAPPED.length - 2)
  const f = smooth(t - i)
  const a = UNWRAPPED[i]
  const b = UNWRAPPED[i + 1]

  const mix = (x: number, y: number) => x + (y - x) * f
  const act: Act = {
    target: {
      x: mix(a.target.x, b.target.x),
      y: mix(a.target.y, b.target.y),
      z: mix(a.target.z, b.target.z),
    },
    az: mix(a.az, b.az),
    el: mix(a.el, b.el),
    dist: mix(a.dist, b.dist),
  }
  return poseFrom(act)
}

/** the opening pose — where the camera returns to when idle */
export const OPENING_POSE: Pose = poseFrom(ACTS[0])

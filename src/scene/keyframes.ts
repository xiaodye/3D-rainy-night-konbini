import type { Vec3Like } from './diorama'

/**
 * 五幕叙事的相机关键帧。
 *
 * 使用与场景自身 `fitCamera` 相同的球坐标体系
 * （见 docs/source-restore.md）：
 *     x = tx + sin(az)·cos(el)·dist
 *     y = ty + sin(el)·dist
 *     z = tz + cos(az)·cos(el)·dist
 * 因此校准时任何机位都能用 `?az=&el=&d=&tx=&ty=&tz=` 在上游 demo 里复现，
 * 这里的数值也可与该 URL 形式直接互换。
 *
 * 插值 az/el/dist（而非世界坐标）让相机沿环绕 diorama 的轨道运动 ——
 * 更有电影感，也绝不会穿进建筑。
 *
 * 场景参考（单位 ≈ 米，底座 26×26，模型立在其上）：
 *   store  x[-1.0, 8.4]  z[-9.2, -0.6]  h 4.3   （店面朝 +z，位于 z = -0.6）
 *   前场（forecourt）x[-3.6, 13.0] z[-0.6, 3.0]
 *   主街沿 X 轴，z 4.6…11.0 · 侧街沿 Z 轴，x -9.6…-5.0
 *   自动贩卖机 ≈ (-1.62, -2.6) 与 (-9.05, -4.6)
 */
export interface Act {
  /** 相机的注视点 */
  target: Vec3Like
  /** 方位角（度） */
  az: number
  /** 仰角（度） */
  el: number
  /** 与注视点的距离 */
  dist: number
}

export interface Pose {
  pos: Vec3Like
  target: Vec3Like
}

export const ACTS: Act[] = [
  // 01 — 抵达：高角度广角全景，整座 diorama 尽收眼底
  { target: { x: 1.4, y: 1.15, z: -1.4 }, az: 23, el: 21, dist: 47 },
  // 02 — 店面：街面高度，正对发光的店铺正面
  { target: { x: 3.2, y: 1.7, z: -0.6 }, az: 5, el: 7.5, dist: 15 },
  // 03 — 隔着玻璃：贴近橱窗，店内景深其后
  { target: { x: 3.4, y: 1.6, z: -1.0 }, az: 2, el: 3, dist: 6 },
  // 04 — 街角：绕到侧街，信号灯与自动贩卖机
  { target: { x: -2.5, y: 1.6, z: 0.6 }, az: -28, el: 9, dist: 17 },
  // 05 — 夜色：拉远压低，黑暗里一只发光的小盒子
  { target: { x: 1.2, y: 2.4, z: -1.6 }, az: 27, el: 6, dist: 33 },
]

const DEG = Math.PI / 180
const smooth = (t: number) => t * t * (3 - 2 * t)

/** az → 世界坐标（与场景的 fitCamera 用同一套数学） */
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
 * 解绕方位角，避免连续几幕在 ±180° 接缝处跳变。
 * （当前这套机位用不到 —— 所有 |Δaz| < 180° —— 但将来若有机位绕过店铺背面，
 * 这一步能保证结果正确。）
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

/** progress 0..1 → 插值后的相机机位（幕与幕之间走 smoothstep） */
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

/** 开场机位 —— 空闲时相机回到的位置 */
export const OPENING_POSE: Pose = poseFrom(ACTS[0])

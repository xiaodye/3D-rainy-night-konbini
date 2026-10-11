import { create } from 'zustand'

export type Phase = 'loading' | 'entering' | 'ready'
export type HoverTarget = 'vending' | 'sign' | 'bicycle' | null
/**
 * 'narrative' —— 相机由页面滚动驱动（五幕镜头）
 * 'orbit'     —— 相机归用户：自由旋转 / 缩放 / 平移
 */
export type ViewMode = 'narrative' | 'orbit'
/** 渲染分辨率档位；见 src/scene/diorama/adapter.ts 里的 QUALITY_PRESETS */
export type QualityPreset = 'smooth' | 'balanced' | 'sharp'

interface ExperienceState {
  /** 贯穿 5 幕的滚动进度，0..1 */
  scrollProgress: number
  /** 'loading' -> 'entering'（灯光开场）-> 'ready' */
  phase: Phase
  /** WebGL diorama 渲染出最初几帧后为 true */
  sceneReady: boolean
  /** 水面调参面板是否展开 */
  waterPanelOpen: boolean
  /** 页面当前处于哪种相机模式 */
  viewMode: ViewMode
  /** 渲染分辨率档位（性能 ⇄ 清晰度） */
  qualityPreset: QualityPreset
  hovered: HoverTarget
  isMobile: boolean
  reducedMotion: boolean

  setScrollProgress: (p: number) => void
  setPhase: (p: Phase) => void
  setSceneReady: (v: boolean) => void
  setWaterPanelOpen: (v: boolean) => void
  setViewMode: (m: ViewMode) => void
  setQualityPreset: (q: QualityPreset) => void
  setHovered: (h: HoverTarget) => void
  setQuality: (isMobile: boolean, reducedMotion: boolean) => void
}

export const useExperience = create<ExperienceState>((set) => ({
  scrollProgress: 0,
  phase: 'loading',
  sceneReady: false,
  waterPanelOpen: false,
  viewMode: 'narrative',
  qualityPreset: 'balanced',
  hovered: null,
  isMobile: false,
  reducedMotion: false,

  setScrollProgress: (p) => set({ scrollProgress: p }),
  setPhase: (p) => set({ phase: p }),
  setSceneReady: (v) => set({ sceneReady: v }),
  setWaterPanelOpen: (v) => set({ waterPanelOpen: v }),
  setViewMode: (m) => set({ viewMode: m }),
  setQualityPreset: (q) => set({ qualityPreset: q }),
  setHovered: (h) => set({ hovered: h }),
  setQuality: (isMobile, reducedMotion) => set({ isMobile, reducedMotion }),
}))

/** 开场灯光过渡进度，由 Lighting 经 rAF 驱动（非响应式） */
export const introState = {
  /** 0..1 */
  progress: 0,
  started: false,
}

/** 全局总线：可从任意位置生成水洼涟漪（滴水、雨点落地） */
export const rippleBus = {
  spawn: null as null | ((x: number, z: number, strength?: number) => void),
}

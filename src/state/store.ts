import { create } from 'zustand'

export type Phase = 'loading' | 'entering' | 'ready'
export type HoverTarget = 'vending' | 'sign' | 'bicycle' | null
/**
 * 'narrative' — the camera is driven by page scroll (the five acts)
 * 'orbit'     — the user owns the camera: free rotate / zoom / pan
 */
export type ViewMode = 'narrative' | 'orbit'
/** render resolution preset; see QUALITY_PRESETS in src/scene/diorama.ts */
export type QualityPreset = 'smooth' | 'balanced' | 'sharp'

interface ExperienceState {
  /** 0..1 scroll progress through the 5 scenes */
  scrollProgress: number
  /** 'loading' -> 'entering' (light intro) -> 'ready' */
  phase: Phase
  /** true once the WebGL diorama has rendered its first frames */
  sceneReady: boolean
  /** water-surface tuning panel expanded? */
  waterPanelOpen: boolean
  /** which camera mode the page is in */
  viewMode: ViewMode
  /** render resolution preset (performance ⇄ sharpness) */
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

/** Intro light transition progress, driven by Lighting via rAF (non-reactive) */
export const introState = {
  /** 0..1 */
  progress: 0,
  started: false,
}

/** Global bus for spawning puddle ripples from anywhere (drips, rain hits) */
export const rippleBus = {
  spawn: null as null | ((x: number, z: number, strength?: number) => void),
}

import { useEffect, useRef } from 'react'
import { useExperience } from '../state/store'

/**
 * SceneDriver — bridges the prebuilt diorama bundle (public/diorama.js,
 * exposed on window.__dio) with our scroll narrative.
 *
 * Responsibilities:
 *  - wait for the bundle's `window.__dioReady`
 *  - relax its OrbitControls constraints (default minDistance 15 is too
 *    far for the "through the glass" scene)
 *  - drive camera.position + controls.target through 5 keyframes as the
 *    user scrolls (damped, cinematic)
 *  - at the very top (idle) hand control back to the user for free
 *    orbiting; scrolling re-takes control
 */

interface Keyframe {
  pos: [number, number, number]
  target: [number, number, number]
}

/**
 * Scene scale reference (measured from the bundle):
 *   store center ≈ (0.2, 2.9, 0.3), storefront faces +z
 *   whole block spans x[-21, 26], z[-13, 13], towers up to y≈21.6
 *   the bundle clamps its controls.target to x[-8,8], y[-1.2,7], z[-8,8]
 *
 * Keyframes calibrated against the actual scene (see screenshots):
 * every shot was verified in-browser before being locked in.
 */
const KEYFRAMES: Keyframe[] = [
  // Scene 01 — Arrival: high wide establishing shot of the whole diorama
  { pos: [-24.5, 17.5, 28.5], target: [0, 2.2, 0] },
  // Scene 02 — Storefront: street level, the glowing shopfront straight on
  { pos: [0.6, 2.2, 14.5], target: [0.2, 2.5, 3.0] },
  // Scene 03 — Inside: right up against the glass, shelves visible through it
  { pos: [0.3, 2.05, 11.0], target: [0.2, 2.2, -0.8] },
  // Scene 04 — Street Corner: around to the vending machines / alley side
  { pos: [-13.5, 3.6, 6.5], target: [-3.5, 1.9, -0.6] },
  // Scene 05 — Night: pulled back, lower angle, the glowing box in the dark
  { pos: [-20.0, 5.2, 25.0], target: [0.4, 2.6, 0] },
]

const MIN_DISTANCE = 2
const MAX_DISTANCE = 95

const smooth = (t: number) => t * t * (3 - 2 * t)

export default function SceneDriver() {
  const setSceneReady = useExperience((s) => s.setSceneReady)
  const setQuality = useExperience((s) => s.setQuality)
  const mode = useRef<'scroll' | 'free'>('scroll')

  useEffect(() => {
    let raf = 0
    let disposed = false
    let initialized = false

    // quality flags (mobile / reduced motion) — also used to cap DPR
    const isMobile =
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 900)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setQuality(isMobile, reducedMotion)

    const init = (dio: any) => {
      if (initialized) return
      initialized = true

      // no idle auto-rotation: the narrative owns the camera at rest
      dio.controls.autoRotate = false
      // the bundle default (15) prevents close-ups through the glass
      dio.controls.minDistance = MIN_DISTANCE
      dio.controls.maxDistance = MAX_DISTANCE
      dio.controls.enableDamping = true
      dio.controls.dampingFactor = 0.06
      dio.controls.rotateSpeed = 0.5
      dio.controls.zoomSpeed = 0.8
      // start locked: we glide from the bundle's default view to keyframe 0,
      // then hand control over for free orbiting
      dio.controls.enabled = false

      // cap DPR for performance (bundle renders at full devicePixelRatio)
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2)
      dio.renderer.setPixelRatio(dpr)
      window.dispatchEvent(new Event('resize'))
    }

    const tick = () => {
      if (disposed) return
      const dio = (window as any).__dio

      if (!dio || !(window as any).__dioReady) {
        raf = requestAnimationFrame(tick)
        return
      }
      if (!initialized) {
        init(dio)
        setSceneReady(true)
      }

      const p = useExperience.getState().scrollProgress
      const cam = dio.camera
      const controls = dio.controls
      const dt = 1 / 60
      const damping = 1 - Math.exp(-3.0 * dt)

      // ---- scene index interpolation ----
      const t = Math.min(Math.max(p, 0), 1) * (KEYFRAMES.length - 1)
      const i = Math.min(Math.floor(t), KEYFRAMES.length - 2)
      const f = smooth(t - i)
      const a = KEYFRAMES[i]
      const b = KEYFRAMES[i + 1]
      const px = a.pos[0] + (b.pos[0] - a.pos[0]) * f
      const py = a.pos[1] + (b.pos[1] - a.pos[1]) * f
      const pz = a.pos[2] + (b.pos[2] - a.pos[2]) * f
      const tx = a.target[0] + (b.target[0] - a.target[0]) * f
      const ty = a.target[1] + (b.target[1] - a.target[1]) * f
      const tz = a.target[2] + (b.target[2] - a.target[2]) * f

      if (p < 0.02) {
        // Top of the page: glide back to the opening frame, then hand
        // the camera to the user for free orbiting.
        if (mode.current === 'scroll') {
          const home = KEYFRAMES[0]
          cam.position.lerp({ x: home.pos[0], y: home.pos[1], z: home.pos[2] } as any, damping * 0.6)
          controls.target.lerp({ x: home.target[0], y: home.target[1], z: home.target[2] } as any, damping)
          const dx = cam.position.x - home.pos[0]
          const dy = cam.position.y - home.pos[1]
          const dz = cam.position.z - home.pos[2]
          if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 0.6) {
            mode.current = 'free'
            controls.enabled = true
          }
        }
        // in 'free' mode we leave the camera alone entirely
      } else {
        // Scrolling: narrative owns the camera.
        if (mode.current === 'free') {
          mode.current = 'scroll'
          controls.enabled = false
        }
        cam.position.lerp({ x: px, y: py, z: pz } as any, damping)
        controls.target.lerp({ x: tx, y: ty, z: tz } as any, damping)
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
    }
  }, [setSceneReady, setQuality])

  return null
}

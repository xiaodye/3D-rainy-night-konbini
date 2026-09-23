import { useEffect, useRef } from 'react'
import { useExperience } from '../state/store'
import { getDiorama, hasQueryFlag, type DioramaHandle } from './diorama'
import { interpolateActs, OPENING_POSE } from './keyframes'

/**
 * SceneDriver — bridges the diorama bundle (`/diorama.js`, exposed on
 * `window.__DIORAMA`) with our two camera modes.
 *
 *  narrative mode
 *    page scroll drives five acts; near the top the camera glides home and
 *    then hands over to the user (idle orbiting), and scrolling re-takes it.
 *
 *  orbit mode ("360°")
 *    the user owns the camera completely — rotate / zoom / pan. Page scrolling
 *    is locked so the narrative can't fight the camera, the HTML caption layer
 *    fades out, and the mouse wheel is released to the controls for zooming
 *    instead of scrolling.
 *
 * Wheel rules matter here: OrbitControls calls preventDefault in its wheel
 * handler, which would swallow page scrolling. In narrative mode we stop the
 * event during the capture phase so the page keeps scrolling normally
 * (⌘/Ctrl+wheel still zooms); in orbit mode the page is locked anyway, so the
 * wheel goes straight to the controls.
 */

/** wide limits while the narrative owns the camera */
const NARRATIVE = { minDistance: 0.6, maxDistance: 160, minPolar: 0.05, maxPolar: Math.PI * 0.98 }
/** comfortable limits for the idle free-orbit at the top of the page */
const FREE = { minDistance: 6, maxDistance: 90, minPolar: 0.1, maxPolar: 1.52 }
/** 360° exploration: as much room as feels good without losing the model */
const EXPLORE = { minDistance: 2.5, maxDistance: 120, minPolar: 0.06, maxPolar: 1.6 }

const BOOT_TIMEOUT_MS = 12000

/** module-level guard so React StrictMode's double mount can't double-init */
let didInit = false
let didReportReady = false

function applyProfile(dio: DioramaHandle, profile: typeof NARRATIVE): void {
  const c = dio.controls
  c.minDistance = profile.minDistance
  c.maxDistance = profile.maxDistance
  c.minPolarAngle = profile.minPolar
  c.maxPolarAngle = profile.maxPolar
}

function markBoot(state: string): void {
  document.documentElement.setAttribute('data-diorama-boot', state)
}

export default function SceneDriver() {
  const setSceneReady = useExperience((s) => s.setSceneReady)
  const mode = useRef<'scroll' | 'free'>('scroll')
  const lastTime = useRef(0)
  const savedScrollY = useRef(0)
  const lastViewMode = useRef<'narrative' | 'orbit'>('narrative')

  useEffect(() => {
    const isMobile =
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 900)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    useExperience.getState().setQuality(isMobile, reducedMotion)

    let raf = 0
    let disposed = false
    const startedAt = performance.now()
    let wheelTarget: HTMLCanvasElement | null = null

    /**
     * narrative mode: keep plain wheel for page scrolling by stopping the event
     * before OrbitControls can preventDefault it (⌘/Ctrl+wheel still zooms).
     * orbit mode: the page is locked, so the wheel belongs to the controls.
     */
    const onWheelCapture = (e: WheelEvent) => {
      if (e.metaKey || e.ctrlKey) return
      if (useExperience.getState().viewMode === 'orbit') return
      e.stopImmediatePropagation()
    }

    const init = (dio: DioramaHandle) => {
      if (didInit) return
      didInit = true

      dio.controls.autoRotate = false
      dio.controls.enableDamping = true
      dio.controls.dampingFactor = 0.06
      dio.controls.rotateSpeed = 0.55
      dio.controls.zoomSpeed = 0.8
      dio.controls.panSpeed = 0.6
      applyProfile(dio, NARRATIVE)
      // start locked: the narrative glides to act 01, then hands over
      dio.controls.enabled = false

      // a little more room for the "through the glass" act
      dio.camera.near = 0.6
      dio.camera.updateProjectionMatrix()

      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2)
      dio.renderer.setPixelRatio(dpr)
      if (isMobile) {
        dio.ground.maxSize = 512
        // the bundle sets touch-action:none inline; allow vertical page scroll
        dio.renderer.domElement.style.touchAction = 'pan-y'
      }

      // reduced motion: calmer rain and barely any rain rings
      if (reducedMotion) {
        dio.rain.setAmount(0.35)
        const rip = dio.ground.uniforms.uRipAmp
        if (rip) rip.value = 0.25
      }

      // let the bundle re-run its own resize() (post + reflection target)
      window.dispatchEvent(new Event('resize'))

      wheelTarget = dio.renderer.domElement
      wheelTarget.addEventListener('wheel', onWheelCapture, { capture: true, passive: false })
    }

    /** narrative → 360°: lock the page, fold the captions away, hand over the camera */
    const enterOrbit = (dio: DioramaHandle) => {
      savedScrollY.current = window.scrollY
      document.documentElement.classList.add('is-orbit')
      applyProfile(dio, EXPLORE)
      dio.controls.enabled = true
      dio.renderer.domElement.style.touchAction = 'none'
      mode.current = 'free'
      // the viewport just got wider (scrollbar gone) — let the bundle resize
      window.dispatchEvent(new Event('resize'))
    }

    /** 360° → narrative: restore the page position and let the acts take over */
    const exitOrbit = (dio: DioramaHandle) => {
      document.documentElement.classList.remove('is-orbit')
      window.scrollTo(0, savedScrollY.current)
      mode.current = 'scroll'
      applyProfile(dio, NARRATIVE)
      dio.controls.enabled = false
      if (isMobile) dio.renderer.domElement.style.touchAction = 'pan-y'
      window.dispatchEvent(new Event('resize'))
    }

    const tick = (now: number) => {
      if (disposed) return

      const dio = getDiorama()
      if (!dio) {
        if (now - startedAt > BOOT_TIMEOUT_MS) {
          markBoot('no-diorama')
          console.error('[diorama] boot timeout — window.__DIORAMA never appeared')
          return
        }
        raf = requestAnimationFrame(tick)
        return
      }

      if (!didInit) {
        if (!document.getElementById('scene')) {
          markBoot('no-canvas')
          console.error('[diorama] #scene canvas missing (the bundle looks it up by id)')
          return
        }
        init(dio)
        markBoot('init')
      }

      // honest readiness: we have actually rendered a frame
      const renderedFrame = dio.renderer.info.render.calls > 0
      if (!didReportReady && renderedFrame) {
        didReportReady = true
        document.documentElement.setAttribute('data-diorama-ready', '1')
        setSceneReady(true)
      }

      const state = useExperience.getState()

      // ---- view mode transitions ----
      if (state.viewMode !== lastViewMode.current) {
        if (state.viewMode === 'orbit') enterOrbit(dio)
        else exitOrbit(dio)
        lastViewMode.current = state.viewMode
      }

      // ---- 360°: the user owns the camera, never touch it ----
      if (state.viewMode === 'orbit') {
        lastTime.current = now
        raf = requestAnimationFrame(tick)
        return
      }

      // ---- narrative camera ----
      const dt = lastTime.current ? Math.min((now - lastTime.current) / 1000, 0.1) : 1 / 60
      lastTime.current = now
      const damping = 1 - Math.exp(-3.0 * dt)

      const progress = state.scrollProgress
      const cam = dio.camera
      const controls = dio.controls

      if (progress < 0.02) {
        // idle at the top: glide home, then give the camera to the user
        if (mode.current === 'scroll') {
          cam.position.lerp(OPENING_POSE.pos, damping * 0.6)
          controls.target.lerp(OPENING_POSE.target, damping)
          const dx = cam.position.x - OPENING_POSE.pos.x
          const dy = cam.position.y - OPENING_POSE.pos.y
          const dz = cam.position.z - OPENING_POSE.pos.z
          if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 0.6) {
            mode.current = 'free'
            applyProfile(dio, FREE)
            controls.enabled = true
          }
        }
        // in 'free' mode we leave the camera completely alone
      } else {
        if (mode.current === 'free') {
          mode.current = 'scroll'
          controls.enabled = false
          applyProfile(dio, NARRATIVE)
        }
        const pose = interpolateActs(progress)
        cam.position.lerp(pose.pos, damping)
        controls.target.lerp(pose.target, damping)
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      if (wheelTarget) wheelTarget.removeEventListener('wheel', onWheelCapture, { capture: true })
      document.documentElement.classList.remove('is-orbit')
    }
  }, [setSceneReady])

  return null
}

/** small helper kept for parity with the previous driver */
export const __isSkipIntro = () => hasQueryFlag('skipintro')

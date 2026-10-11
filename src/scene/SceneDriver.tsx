import { useEffect, useRef } from 'react'
import { useExperience } from '../state/store'
import {
  applyQualityPreset,
  getDiorama,
  hasQueryFlag,
  type DioramaHandle,
} from './diorama/adapter'
import { bootDiorama } from './diorama'
import { interpolateActs, OPENING_POSE } from './keyframes'

/**
 * SceneDriver —— 在场景源码（`src/scene/diorama/`，经 `window.__DIORAMA` 暴露）
 * 与我们的两种相机模式之间做桥接。
 *
 *  叙事模式
 *    页面滚动驱动五幕镜头；接近顶部时相机滑回初始机位，
 *    随后把控制权交给用户（自由环绕），一旦继续滚动就重新接管。
 *
 *  360° 模式
 *    相机完全交给用户 —— 旋转 / 缩放 / 平移。此时锁定页面滚动，
 *    避免叙事与相机互相打架；HTML 字幕层淡出，
 *    滚轮也交给 controls 用于缩放而非翻页。
 *
 * 滚轮规则在这里很关键：OrbitControls 会在自己的 wheel 处理器里调用
 * preventDefault，那会吞掉页面滚动。叙事模式下我们在捕获阶段就停掉该事件，
 * 让页面正常滚动（⌘/Ctrl+滚轮仍然缩放）；360° 模式下页面本来就锁定了，
 * 滚轮直接交给 controls。
 */

/** 叙事模式掌控相机时的宽松限制 */
const NARRATIVE = { minDistance: 0.6, maxDistance: 160, minPolar: 0.05, maxPolar: Math.PI * 0.98 }
/** 页面顶部空闲自由环绕时的舒适限制 */
const FREE = { minDistance: 6, maxDistance: 90, minPolar: 0.1, maxPolar: 1.52 }
/** 360° 探索：在不会迷失模型的前提下尽量给足空间 */
const EXPLORE = { minDistance: 2.5, maxDistance: 120, minPolar: 0.06, maxPolar: 1.6 }

/** 模块级守卫：避免 React StrictMode 的双挂载造成重复初始化 */
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
  const lastQuality = useRef(useExperience.getState().qualityPreset)

  useEffect(() => {
    const isMobile =
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 900)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    useExperience.getState().setQuality(isMobile, reducedMotion)

    let raf = 0
    let disposed = false
    let wheelTarget: HTMLCanvasElement | null = null

    /**
     * 叙事模式：在 OrbitControls 来得及 preventDefault 之前停掉事件，
     * 把普通滚轮留给页面滚动（⌘/Ctrl+滚轮仍然缩放）。
     * 360° 模式：页面已锁定，滚轮归 controls。
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
      // 初始为锁定：由叙事滑向第 01 幕，随后交还控制权
      dio.controls.enabled = false

      // 为"贴着玻璃看"那一幕多留一点空间
      dio.camera.near = 0.6
      dio.camera.updateProjectionMatrix()

      /*
       * 阴影只烘焙一次，而非每帧重算。场景里没有任何东西需要实时阴影
       * （自动门是玻璃，几乎不投影），而每帧重渲染一次 2048² 的阴影贴图
       * 是实打实的开销 —— 我们替换掉的那版实现正是这么做的。
       */
      dio.renderer.shadowMap.autoUpdate = false
      dio.renderer.shadowMap.needsUpdate = true

      // 画质档位（分辨率 + 反射 target 尺寸）
      applyQualityPreset(dio, useExperience.getState().qualityPreset, isMobile)
      if (isMobile) {
        // 上游代码内联了 touch-action:none；这里改回允许纵向页面滚动
        dio.renderer.domElement.style.touchAction = 'pan-y'
      }

      // 减弱动效：雨更柔和，雨点涟漪几乎消失
      if (reducedMotion) {
        dio.rain.setAmount(0.35)
        const rip = dio.ground.uniforms.uRipAmp
        if (rip) rip.value = 0.25
      }

      wheelTarget = dio.renderer.domElement
      wheelTarget.addEventListener('wheel', onWheelCapture, { capture: true, passive: false })
    }

    /** 叙事 → 360°：锁定页面、收起字幕、把相机交给用户 */
    const enterOrbit = (dio: DioramaHandle) => {
      savedScrollY.current = window.scrollY
      document.documentElement.classList.add('is-orbit')
      applyProfile(dio, EXPLORE)
      dio.controls.enabled = true
      dio.renderer.domElement.style.touchAction = 'none'
      mode.current = 'free'
      // 视口刚变宽（滚动条消失）—— 让场景重新计算尺寸
      window.dispatchEvent(new Event('resize'))
    }

    /** 360° → 叙事：恢复页面位置，让五幕重新接管 */
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

      // 启动场景一次（幂等、同步）。它按 id 查找 <canvas id="scene">，
      // 因此该元素必须已在 DOM 中 —— 由于这里是挂载后的 React effect 里执行，
      // 条件自然满足。
      let dio = getDiorama()
      if (!dio) {
        if (!document.getElementById('scene')) {
          markBoot('no-canvas')
          console.error('[diorama] #scene canvas missing — the scene looks it up by id')
          return
        }
        try {
          dio = bootDiorama()
        } catch (err) {
          markBoot('boot-error')
          console.error('[diorama] boot failed', err)
          return
        }
      }
      if (!dio) return

      if (!didInit) {
        init(dio)
        markBoot('init')
      }

      // 真实的就绪判定：我们确实渲染出了一帧
      const renderedFrame = dio.renderer.info.render.calls > 0
      if (!didReportReady && renderedFrame) {
        didReportReady = true
        document.documentElement.setAttribute('data-diorama-ready', '1')
        setSceneReady(true)
      }

      const state = useExperience.getState()

      // ---- 画质档位变化（由水面面板驱动） ----
      if (state.qualityPreset !== lastQuality.current) {
        lastQuality.current = state.qualityPreset
        applyQualityPreset(dio, state.qualityPreset, isMobile)
      }

      // ---- 视角模式切换 ----
      if (state.viewMode !== lastViewMode.current) {
        if (state.viewMode === 'orbit') enterOrbit(dio)
        else exitOrbit(dio)
        lastViewMode.current = state.viewMode
      }

      // ---- 360°：相机归用户，绝不去碰 ----
      if (state.viewMode === 'orbit') {
        lastTime.current = now
        raf = requestAnimationFrame(tick)
        return
      }

      // ---- 叙事相机 ----
      const dt = lastTime.current ? Math.min((now - lastTime.current) / 1000, 0.1) : 1 / 60
      lastTime.current = now
      const damping = 1 - Math.exp(-3.0 * dt)

      const progress = state.scrollProgress
      const cam = dio.camera
      const controls = dio.controls

      if (progress < 0.02) {
        // 顶部空闲：滑回初始机位，然后把相机交给用户
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
        // 'free' 模式下完全不干预相机
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

/** 保留的小工具，与之前的 driver 保持接口一致 */
export const __isSkipIntro = () => hasQueryFlag('skipintro')

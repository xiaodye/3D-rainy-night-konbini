import { useEffect, useRef, useState } from 'react'
import { useExperience } from '../state/store'
import { hasQueryFlag } from '../scene/diorama'

/**
 * 极简加载页：深藏青底、"RAINY NIGHT / LOADING 43%"、1px 进度线。没有转圈图标。
 *
 * 进度语义：字体就绪 + `sceneReady`（由 SceneDriver 设置 —— 场景已启动
 * 且确实渲染出了一帧，即 `window.__DIORAMA.renderer.info.render.calls > 0`）
 * + 一个最短展示时长，保证标题能被看清。随后淡出，露出场景。
 *
 * `?skipintro` 把最短停留时间降到 0 —— 跑截图时很方便。
 */
export default function LoadingScreen() {
  const [progress, setProgress] = useState(0)
  const [hidden, setHidden] = useState(false)
  const setPhase = useExperience((s) => s.setPhase)
  const sceneReady = useExperience((s) => s.sceneReady)
  const done = useRef(false)

  useEffect(() => {
    const started = performance.now()
    let raf: number

    // 字体就绪，并带 3 秒硬兜底 —— 绝不卡住开场
    let fontsReady = false
    if (document.fonts) {
      document.fonts.ready.then(() => (fontsReady = true))
      setTimeout(() => (fontsReady = true), 3000)
    } else {
      fontsReady = true
    }

    // 最短停留时间（关乎可读性）；`?skipintro` 会把它压到极短，便于截图
    const minSeconds = hasQueryFlag('skipintro') ? 0.05 : 1.6

    const tick = () => {
      const elapsed = (performance.now() - started) / 1000
      // 约 1.6 秒内缓动到 100，夹杂细微停顿以增加质感
      const t = Math.min(1, elapsed / minSeconds)
      const eased = 1 - Math.pow(1 - t, 2.2)
      const jitter = t < 1 ? Math.sin(elapsed * 9) * 1.5 : 0
      const pct = Math.max(0, Math.min(100, Math.round(eased * 100 + jitter)))

      const ready = useExperience.getState().sceneReady
      if (t >= 1 && fontsReady && ready) {
        if (!done.current) {
          done.current = true
          setProgress(100)
          setTimeout(() => {
            setPhase('ready')
            setHidden(true)
          }, 300)
        }
        return
      }
      setProgress(pct)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [setPhase, sceneReady])

  return (
    <div className={`loading-screen${hidden ? ' hidden' : ''}`} aria-hidden={hidden}>
      <div className="loading-title">RAINY NIGHT</div>
      <div className="loading-bar">
        <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="loading-percent">LOADING {progress}%</div>
    </div>
  )
}

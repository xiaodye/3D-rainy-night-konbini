import { useEffect, useRef, useState } from 'react'
import { useExperience } from '../state/store'

/**
 * Minimal loading screen: deep navy, "RAINY NIGHT / LOADING 43%",
 * 1px progress line. No spinner.
 *
 * Progress semantics: font readiness + the diorama bundle's first
 * rendered frames (window.__dioReady) + a minimum presentation time so
 * the title reads. Then it fades out and the scene is revealed.
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

    // font readiness with a hard 3s fallback — never block the intro
    let fontsReady = false
    if (document.fonts) {
      document.fonts.ready.then(() => (fontsReady = true))
      setTimeout(() => (fontsReady = true), 3000)
    } else {
      fontsReady = true
    }

    const tick = () => {
      const elapsed = (performance.now() - started) / 1000
      // ease toward 100 over ~1.6s, tiny pauses for texture
      const t = Math.min(1, elapsed / 1.6)
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

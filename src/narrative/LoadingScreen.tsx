import { useEffect, useRef, useState } from 'react'
import { useExperience } from '../state/store'

/**
 * Minimal loading screen: deep navy, "RAINY NIGHT / LOADING 43%",
 * 1px progress line. No spinner.
 *
 * Progress semantics (no heavy assets to load): font readiness +
 * first scene compile + a minimum presentation time of ~1.4s so the
 * title reads. On completion the scene enters the staged light intro.
 */
export default function LoadingScreen() {
  const [progress, setProgress] = useState(0)
  const [hidden, setHidden] = useState(false)
  const setPhase = useExperience((s) => s.setPhase)
  const done = useRef(false)

  useEffect(() => {
    const started = performance.now()
    let raf: number

    // font readiness with a hard 3s fallback — never block the intro
    // (offline / slow font loading would otherwise stall at 100% forever)
    let fontsReady = false
    if (document.fonts) {
      document.fonts.ready.then(() => (fontsReady = true))
      setTimeout(() => (fontsReady = true), 3000)
    } else {
      fontsReady = true
    }

    const tick = () => {
      const elapsed = (performance.now() - started) / 1000
      // ease toward 100 over ~1.5s, tiny pauses for texture
      const t = Math.min(1, elapsed / 1.5)
      const eased = 1 - Math.pow(1 - t, 2.2)
      const jitter = t < 1 ? Math.sin(elapsed * 9) * 1.5 : 0
      const pct = Math.max(0, Math.min(100, Math.round(eased * 100 + jitter)))

      if (t >= 1 && fontsReady) {
        if (!done.current) {
          done.current = true
          setProgress(100)
          // hand over to the light intro
          setTimeout(() => {
            setPhase('entering')
            setHidden(true)
          }, 350)
        }
        return
      }
      setProgress(pct)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [setPhase])

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

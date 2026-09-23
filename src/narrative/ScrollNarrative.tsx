import { useEffect, useRef } from 'react'
import { useExperience } from '../state/store'

/**
 * HTML narrative layer — 500vh scroll container over the fixed canvas.
 * Copy is styled like film captions / exhibition notes.
 * Visibility per scene is driven directly by scroll progress in a rAF
 * loop (no React re-render per frame).
 *
 * Scene mapping (scrollProgress 0..1 over 4 viewport-heights of travel):
 *  S1 0.00–0.14  S2 0.18–0.36  S3 0.43–0.61  S4 0.68–0.86  S5 0.92–1
 */

interface SceneSpec {
  el: HTMLDivElement | null
  center: number
  halfWidth: number
}

export default function ScrollNarrative() {
  const containerRef = useRef<HTMLDivElement>(null)
  const blocksRef = useRef<SceneSpec[]>([])

  // register scene blocks
  useEffect(() => {
    const blocks = Array.from(
      containerRef.current?.querySelectorAll<HTMLDivElement>('.narrative-block') ?? [],
    )
    const centers = [0.055, 0.26, 0.51, 0.76, 0.97]
    const widths = [0.075, 0.1, 0.095, 0.1, 0.075]
    blocksRef.current = blocks.map((el, i) => ({
      el,
      center: centers[i] ?? 0.5,
      halfWidth: widths[i] ?? 0.1,
    }))
  }, [])

  // scroll → store + per-block visibility
  useEffect(() => {
    const setScrollProgress = useExperience.getState().setScrollProgress

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const p = max > 0 ? window.scrollY / max : 0
      setScrollProgress(p)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // rAF loop: fade blocks in/out around their center
  useEffect(() => {
    let raf: number
    const update = () => {
      const p = useExperience.getState().scrollProgress
      for (const b of blocksRef.current) {
        if (!b.el) continue
        const d = Math.abs(p - b.center) / b.halfWidth
        const k = d < 1 ? 1 - d * d : 0 // smooth in/out
        const eased = k * k * (3 - 2 * k)
        b.el.style.opacity = String(eased)
        b.el.style.transform = `translateY(${(1 - eased) * 14}px)`
      }
      raf = requestAnimationFrame(update)
    }
    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="narrative" ref={containerRef}>
      {/* S1 — Arrival */}
      <section className="narrative-scene">
        <div className="narrative-block" style={{ right: '7vw', bottom: '12vh', textAlign: 'right' }}>
          <div className="nb-tiny">AFTER RAIN</div>
          <div className="nb-main">
            11:47 PM &nbsp;·&nbsp; TOKYO
            <div className="nb-jp">雨はまだ降っている。</div>
          </div>
        </div>
        <div className="nb-corner" style={{ left: '4vw', top: '6vh' }}>
          03 — KONBINI
          <br />
          35°41' N &nbsp; 139°46' E
        </div>
      </section>

      {/* S2 — Storefront */}
      <section className="narrative-scene">
        <div className="narrative-block" style={{ left: '6vw', top: '16vh' }}>
          <div className="nb-tiny">02 — STOREFRONT</div>
          <div className="nb-main">
            <span className="nb-em">OPEN · 24 HOURS</span>
            <br />
            Even when the street falls silent.
          </div>
        </div>
      </section>

      {/* S3 — Inside */}
      <section className="narrative-scene">
        <div className="narrative-block" style={{ right: '8vw', bottom: '18vh', textAlign: 'right' }}>
          <div className="nb-tiny">03 — INSIDE</div>
          <div className="nb-main">
            Warm light. Cold rain.
            <br />
            Some places feel warmer
            <br />
            when nobody is around.
          </div>
        </div>
      </section>

      {/* S4 — Street Corner */}
      <section className="narrative-scene">
        <div className="narrative-block" style={{ left: '6vw', top: '14vh' }}>
          <div className="nb-tiny">04 — STREET CORNER</div>
          <div className="nb-main">
            11:58 PM
            <br />
            The city is still awake.
            <br />
            <span className="nb-em">Just quieter.</span>
          </div>
        </div>
      </section>

      {/* S5 — Night */}
      <section className="narrative-scene">
        <div
          className="narrative-block"
          style={{ left: '50%', top: '44%', transform: 'translate(-50%, 0)', textAlign: 'center' }}
        >
          <div className="nb-heading">
            A SMALL PLACE
            <br />
            IN A VERY LARGE NIGHT.
          </div>
          <button
            className="explore-again"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            EXPLORE AGAIN
          </button>
        </div>
      </section>

      <ScrollHint />
    </div>
  )
}

/** Faint "SCROLL" hint that disappears once the journey starts */
function ScrollHint() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onScroll = () => {
      if (ref.current) {
        ref.current.style.opacity = window.scrollY < window.innerHeight * 0.2 ? '1' : '0'
      }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div className="scroll-hint" ref={ref}>
      SCROLL
      <span className="hint-line" />
    </div>
  )
}

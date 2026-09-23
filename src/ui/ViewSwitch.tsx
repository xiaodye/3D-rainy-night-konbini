import { useEffect } from 'react'
import { useExperience } from '../state/store'

/**
 * 视角模式切换 — top-right segmented switch between:
 *   「叙事」 the scroll-driven five acts
 *   「360°」 free exploration: drag to rotate, wheel to zoom, right-drag to pan
 *
 * Keyboard: V toggles, Esc leaves 360° (unless the water panel is open, in
 * which case Esc closes that first — it registers its own handler).
 */
export default function ViewSwitch() {
  const sceneReady = useExperience((s) => s.sceneReady)
  const viewMode = useExperience((s) => s.viewMode)
  const setViewMode = useExperience((s) => s.setViewMode)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const state = useExperience.getState()
      if (e.key === 'v' || e.key === 'V') {
        setViewMode(state.viewMode === 'orbit' ? 'narrative' : 'orbit')
      } else if (e.key === 'Escape' && !state.waterPanelOpen && state.viewMode === 'orbit') {
        setViewMode('narrative')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setViewMode])

  if (!sceneReady) return null

  return (
    <div className="view-switch">
      <div className="view-switch-row" role="group" aria-label="视角模式">
        <button
          type="button"
          className={viewMode === 'narrative' ? 'is-on' : undefined}
          aria-pressed={viewMode === 'narrative'}
          onClick={() => setViewMode('narrative')}
        >
          叙事
        </button>
        <span className="vs-sep" aria-hidden="true" />
        <button
          type="button"
          className={viewMode === 'orbit' ? 'is-on' : undefined}
          aria-pressed={viewMode === 'orbit'}
          onClick={() => setViewMode('orbit')}
        >
          360°
        </button>
        <span className="vs-key" aria-hidden="true">
          V
        </span>
      </div>

      {viewMode === 'orbit' && (
        <div className="view-hint">拖拽旋转 · 滚轮缩放 · 右键平移</div>
      )}
    </div>
  )
}

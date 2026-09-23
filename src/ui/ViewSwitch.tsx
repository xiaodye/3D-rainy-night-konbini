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
        <span className="vs-sep" aria-hidden="true" />
        <a
          className="gh-link"
          href="https://github.com/xiaodye/rainy-night-konbini"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub 仓库"
          title="GitHub"
        >
          <svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
        </a>
      </div>

      {viewMode === 'orbit' && (
        <div className="view-hint">拖拽旋转 · 滚轮缩放 · 右键平移</div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { ambience } from "../audio/ambience";
import { useExperience } from '../state/store'
import {
  QUALITY_PRESETS,
  WATER_PARAMS,
  applyWaterParam,
  getDiorama,
  hasQueryFlag,
  readWaterParams,
  type QualityPreset,
  type WaterKey,
} from '../scene/diorama'

/**
 * 水面调参面板 —— 用 React 重写，以便遵循本页的设计语言
 * （安静的电影字幕式排版、发丝级分隔线、不用毛玻璃光效），
 * 而非沿用上游 demo 自带的面板。
 *
 * 分区：
 *  - water：八个参数，与场景的水面 uniform 一一对应
 *  - quality：渲染分辨率档位（场景 fill-rate 受限，所以在某台机器上
 *    是否流畅，基本由这个开关决定）
 *
 * 初始值直接来自场景当前生效的 uniform，因此 `?wave=1.4` 这类 URL 覆盖
 * 依然有效；localStorage 则垫在更下面一层。
 */

const STORAGE_KEY = 'rainy-water-v1'
const QUALITY_KEY = 'rainy-quality-v1'

function readStoredQuality(): QualityPreset | null {
  try {
    const v = localStorage.getItem(QUALITY_KEY)
    if (v === 'smooth' || v === 'balanced' || v === 'sharp') return v
  } catch {
    /* 忽略 */
  }
  return null
}

export default function WaterPanel() {
  const sceneReady = useExperience((s) => s.sceneReady)
  const open = useExperience((s) => s.waterPanelOpen)
  const setOpen = useExperience((s) => s.setWaterPanelOpen)
  const qualityPreset = useExperience((s) => s.qualityPreset)
  const setQualityPreset = useExperience((s) => s.setQualityPreset)
  const [values, setValues] = useState<Record<WaterKey, number> | null>(null)
  const baseline = useRef<Record<WaterKey, number> | null>(null)
  const noPanel = useRef(hasQueryFlag('nopanel'))

  // 场景就绪后再灌入初值
  useEffect(() => {
    if (!sceneReady) return

    // 画质档位：已存储的偏好优先（由 SceneDriver 应用）
    const stored = readStoredQuality()
    if (stored && stored !== useExperience.getState().qualityPreset) {
      setQualityPreset(stored)
    }

    if (values) return
    const dio = getDiorama()
    const initial = readWaterParams(dio)

    // localStorage 补上那些未被 URL 覆盖的参数
    let saved: Partial<Record<WaterKey, number>> | null = null
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    } catch {
      saved = null
    }
    const params = new URLSearchParams(location.search)
    if (saved) {
      for (const spec of WATER_PARAMS) {
        if (!params.has(spec.key) && typeof saved[spec.key] === 'number') {
          initial[spec.key] = saved[spec.key] as number
        }
      }
    }

    baseline.current = readWaterParams(dio)
    for (const spec of WATER_PARAMS) applyWaterParam(dio, spec.key, initial[spec.key])
    setValues(initial)
  }, [sceneReady, values, setQualityPreset])

  const persist = useCallback((next: Record<WaterKey, number>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* 隐私模式 —— 忽略 */
    }
  }, [])

  const handleChange = useCallback((key: WaterKey, value: number) => {
    applyWaterParam(getDiorama(), key, value);
    if (key === "rain") ambience.setRainAmount(value);
    setValues((prev) => {
      if (!prev) return prev
      const next = { ...prev, [key]: value }
      return next
    })
  }, [])

  const handleCommit = useCallback(() => {
    if (values) persist(values)
  }, [values, persist])

  const handleQuality = useCallback(
    (q: QualityPreset) => {
      setQualityPreset(q)
      try {
        localStorage.setItem(QUALITY_KEY, q)
      } catch {
        /* 忽略 */
      }
    },
    [setQualityPreset],
  )

  const handleReset = useCallback(() => {
    const dio = getDiorama()
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(QUALITY_KEY)
    } catch {
      /* 忽略 */
    }
    const base = baseline.current ?? readWaterParams(dio)
    for (const spec of WATER_PARAMS) applyWaterParam(dio, spec.key, base[spec.key])
    setValues({ ...base })
    handleQuality('balanced')
  }, [handleQuality])

  // H 切换开关 / Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'h' || e.key === 'H') {
        setOpen(!useExperience.getState().waterPanelOpen)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  // 叙事一旦开始推进，相机就会离开这个取景 —— 自动收起
  useEffect(() => {
    return useExperience.subscribe((state, prev) => {
      if (state.scrollProgress > 0.2 && prev.scrollProgress <= 0.2 && state.waterPanelOpen) {
        useExperience.getState().setWaterPanelOpen(false)
      }
    })
  }, [])

  if (!values) return null

  return (
    <div className={`water-ui${open ? ' is-open' : ''}${noPanel.current ? ' is-muted' : ''}`}>
      {open ? (
        <div className="water-panel" role="dialog" aria-label="水面调参">
          <div className="water-head">
            <span className="water-title">WATER SURFACE</span>
            <button
              type="button"
              className="water-close"
              onClick={() => setOpen(false)}
              aria-label="收起面板"
            >
              ×
            </button>
          </div>

          <div className="water-rule" />

          <div className="water-rows">
            {WATER_PARAMS.map((spec) => (
              <div className="water-row" key={spec.key}>
                <label htmlFor={`wp-${spec.key}`}>{spec.label}</label>
                <input
                  id={`wp-${spec.key}`}
                  type="range"
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  value={values[spec.key]}
                  onChange={(e) => handleChange(spec.key, parseFloat(e.target.value))}
                  onPointerUp={handleCommit}
                  onKeyUp={handleCommit}
                />
                <output>{values[spec.key].toFixed(spec.dp)}</output>
              </div>
            ))}
          </div>

          <div className="water-rule" />

          <div className="water-quality">
            <span className="water-quality-label">画质</span>
            <div className="water-quality-opts">
              {QUALITY_PRESETS.map((spec) => (
                <button
                  key={spec.key}
                  type="button"
                  className={qualityPreset === spec.key ? 'is-on' : undefined}
                  aria-pressed={qualityPreset === spec.key}
                  onClick={() => handleQuality(spec.key)}
                >
                  {spec.label}
                </button>
              ))}
            </div>
          </div>
          <div className="water-quality-note">画质越低越流畅（分辨率与反射精度）</div>

          <div className="water-rule" />

          <button type="button" className="water-reset" onClick={handleReset}>
            重置
          </button>
          <div className="water-hint">拖拽旋转 · ⌘/Ctrl + 滚轮缩放 · H 收起</div>
        </div>
      ) : (
        <button
          type="button"
          className="water-tab"
          onClick={() => setOpen(true)}
          aria-label="展开水面调参面板"
        >
          水面调参
          <span className="water-tab-key">H</span>
        </button>
      )}
    </div>
  )
}

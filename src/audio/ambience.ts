/**
 * 程序化的雨夜环境音 —— 雨、温暖垫音、远处雷声。
 *
 * 用 Web Audio 实时合成，而不是附带音频文件：没有资源、没有授权问题，
 * 而且雨声还能跟随场景的「雨量」滑块。
 *
 * 分层
 *   雨幕底噪   安静的低通循环噪声 —— 远处那片雨势的底子
 *   雨滴       真正的"雨打水面"声：离散水珠，每一颗都是随机音高
 *              （1.5–4.3 kHz）的短窄带脉冲，随机立体声位置，
 *              每秒调度 15–40 颗，密度跟随雨量。
 *              （只用低通噪声底噪听起来就是风 —— 是这些离散瞬态让它读作雨滴。）
 *   pad        A 小调持续音（A2 E3 A3 C4），轻度失谐，以 20 秒周期的 LFO
 *              呼吸起伏 —— 像店里那台旧音响的底噪
 *   雷声       偶发的低频隆隆，每 20–65 秒随机一次
 *
 * 自动播放策略：浏览器在用户手势之前会拦截音频。`autoStartOnGesture()`
 * 挂在首次 pointer/key 事件上 —— 除非用户明确关掉过（会话内记录），
 * 否则环境音会自行淡入。
 */

export class Ambience {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private rainBedGain: GainNode | null = null
  private dropsGain: GainNode | null = null
  private dropBuffers: AudioBuffer[] = []
  private rainLoopTimer = 0
  private thunderTimer = 0
  private running = false
  /** 用户手动关闭时置位 —— 在他们重新开启之前阻止自动启动 */
  private userMuted = false
  private rainAmount = 1
  private listeners = new Set<() => void>()

  get isRunning(): boolean {
    return this.running
  }

  /** 订阅启动 / 停止；返回取消订阅的函数 */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn())
  }

  async start(): Promise<void> {
    if (this.running) return
    this.userMuted = false
    this.ctx = this.ctx ?? new AudioContext()
    await this.ctx.resume()
    if (!this.master) this.build()

    const t = this.ctx.currentTime
    this.master!.gain.cancelScheduledValues(t)
    this.master!.gain.setValueAtTime(this.master!.gain.value, t)
    this.master!.gain.linearRampToValueAtTime(1, t + 2.5)
    this.running = true
    this.emit()
  }

  stop(): void {
    if (!this.ctx || !this.master || !this.running) return
    const t = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setValueAtTime(this.master.gain.value, t)
    this.master.gain.linearRampToValueAtTime(0, t + 1.2)
    this.running = false
    this.userMuted = true
    window.clearTimeout(this.rainLoopTimer)
    this.emit()
  }

  /** 在首次用户手势（指针 / 键盘）时调用 —— 尊重用户的手动静音 */
  autoStartOnGesture(): void {
    if (this.running || this.userMuted) return
    void this.start().then(() => this.setRainAmount(this.rainAmount))
  }

  /** 雨量滑块值（0–1.5）→ 雨滴密度 + 底噪响度 */
  setRainAmount(v: number): void {
    this.rainAmount = Math.max(0, v)
    if (!this.ctx || !this.rainBedGain || !this.dropsGain) return
    const t = this.ctx.currentTime
    this.rainBedGain.gain.setTargetAtTime(0.04 + 0.05 * Math.min(1.5, this.rainAmount), t, 0.5)
    this.dropsGain.gain.setTargetAtTime(0.32 + 0.2 * Math.min(1, this.rainAmount), t, 0.5)
  }

  // ------------------------------------------------------------------ 音频图

  private build(): void {
    const ctx = this.ctx!
    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    this.master = master

    this.buildDropBuffers(ctx)
    this.buildRainBed(ctx, master)
    this.buildDrops(ctx, master)
    this.buildPad(ctx, master)

    const fire = () => {
      if (!this.running) return
      this.thunderBurst(ctx, master)
      this.thunderTimer = window.setTimeout(fire, 22000 + Math.random() * 42000)
    }
    this.thunderTimer = window.setTimeout(fire, 14000 + Math.random() * 18000)
  }

  /** 预生成的若干 5–15 ms 噪声脉冲 —— 构成一颗水珠的原料 */
  private buildDropBuffers(ctx: AudioContext): void {
    for (let b = 0; b < 8; b++) {
      const len = Math.floor(ctx.sampleRate * (0.005 + Math.random() * 0.01))
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
      this.dropBuffers.push(buffer)
    }
  }

  /** 远处的雨幕 —— 安静、低沉，刚好能把水珠粘成一片 */
  private buildRainBed(ctx: AudioContext, master: GainNode): void {
    const seconds = 3
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    noise.loop = true

    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 150

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    lp.Q.value = 0.4

    this.rainBedGain = ctx.createGain()
    this.rainBedGain.gain.value = 0.09

    noise.connect(hp)
    hp.connect(lp)
    lp.connect(this.rainBedGain)
    this.rainBedGain.connect(master)
    noise.start()

    const drift = ctx.createOscillator()
    drift.frequency.value = 0.07
    const driftGain = ctx.createGain()
    driftGain.gain.value = 200
    drift.connect(driftGain)
    driftGain.connect(lp.frequency)
    drift.start()
  }

  /** 离散水珠：窄带脉冲，随机音高，随机立体声位置 */
  private buildDrops(ctx: AudioContext, master: GainNode): void {
    this.dropsGain = ctx.createGain()
    this.dropsGain.gain.value = 0.4
    this.dropsGain.connect(master)
    this.scheduleDrops()
  }

  private scheduleDrops(): void {
    if (!this.running || !this.ctx || !this.dropsGain) return
    const ctx = this.ctx
    const amount = Math.min(1.5, this.rainAmount || 1)
    const count = Math.max(1, Math.round((1 + Math.random() * 2) * amount))

    for (let i = 0; i < count; i++) {
      const src = ctx.createBufferSource()
      src.buffer = this.dropBuffers[Math.floor(Math.random() * this.dropBuffers.length)]

      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1500 + Math.random() * 2800 // 水珠音高
      bp.Q.value = 5 + Math.random() * 6 // 窄带 → 有音调的"滴"声

      const g = ctx.createGain()
      g.gain.value = 0.5 + Math.random() * 0.5

      const pan = ctx.createStereoPanner()
      pan.pan.value = Math.random() * 1.6 - 0.8 // 雨落在四面八方

      src.connect(bp)
      bp.connect(g)
      g.connect(pan)
      pan.connect(this.dropsGain)
      src.start(ctx.currentTime + Math.random() * 0.05)
    }

    // 下一批：amount 为 1 时每秒约 15–40 颗水珠
    this.rainLoopTimer = window.setTimeout(() => this.scheduleDrops(), 35 + Math.random() * 80)
  }

  /** Am 持续音 —— 温暖、略带忧郁、会呼吸；店面的低鸣 */
  private buildPad(ctx: AudioContext, master: GainNode): void {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 540

    const padGain = ctx.createGain()
    padGain.gain.value = 0.045
    lp.connect(padGain)
    padGain.connect(master)

    const voices: Array<[number, OscillatorType, number]> = [
      [110.0, 'triangle', 0.5],
      [164.81, 'triangle', 0.42],
      [220.0, 'sine', 0.3],
      [261.63, 'sine', 0.18],
    ]
    voices.forEach(([freq, type, level], i) => {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.value = freq
      osc.detune.value = i % 2 === 0 ? -4 : 5
      const g = ctx.createGain()
      g.gain.value = level
      osc.connect(g)
      g.connect(lp)
      osc.start()
    })

    const breathe = ctx.createOscillator()
    breathe.frequency.value = 0.05
    const breatheGain = ctx.createGain()
    breatheGain.gain.value = 0.016
    breathe.connect(breatheGain)
    breatheGain.connect(padGain.gain)
    breathe.start()
  }

  /** 一阵低沉的隆隆：噪声经幂次衰减与缓慢摆动塑形，再做深度低通 */
  private thunderBurst(ctx: AudioContext, master: GainNode): void {
    const dur = 2.6 + Math.random() * 2
    const len = Math.floor(ctx.sampleRate * dur)
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const t = i / len
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.4) * (0.55 + 0.45 * Math.sin(t * 30))
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 110 + Math.random() * 70
    const g = ctx.createGain()
    g.gain.value = 0.09 + Math.random() * 0.08
    src.connect(lp)
    lp.connect(g)
    g.connect(master)
    src.start()
  }
}

/** 模块级单例 —— 整个页面共用一个 audio context */
export const ambience = new Ambience()

/**
 * Procedural night ambience — rain, a warm pad, distant thunder.
 *
 * Synthesised with the Web Audio API instead of shipping an audio file:
 * no assets, no licensing, and the rain can follow the scene's 「雨量」slider.
 *
 * Layers
 *   rain bed    quiet looped noise, low-passed — the distant wash of the storm
 *   raindrops   THE rain-on-water sound: discrete droplets, each a short narrow-
 *               band burst at a random pitch (1.5–4.3 kHz) with random stereo
 *               position, scheduled 15–40 per second. Density follows rain amount.
 *               (A plain low-passed noise bed alone reads as wind — the discrete
 *               transients are what make it read as droplets.)
 *   pad         A-minor drone (A2 E3 A3 C4), slightly detuned, breathing on a
 *               20-second LFO — the storefront's old speaker hum
 *   thunder     occasional low rumble bursts, randomised every 20–65 s
 *
 * Autoplay policy: browsers block audio until a user gesture. `autoStartOnGesture()`
 * is wired to the first pointer/key event — the ambience fades in by itself unless
 * the user explicitly toggled it off (tracked in-session).
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
  /** set when the user toggles off — blocks auto-start until they toggle on again */
  private userMuted = false
  private rainAmount = 1
  private listeners = new Set<() => void>()

  get isRunning(): boolean {
    return this.running
  }

  /** subscribe to start/stop; returns an unsubscribe function */
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

  /** call from the first user gesture (pointer/keyboard) — respects manual mute */
  autoStartOnGesture(): void {
    if (this.running || this.userMuted) return
    void this.start().then(() => this.setRainAmount(this.rainAmount))
  }

  /** rain slider amount (0–1.5) → drop density + bed loudness */
  setRainAmount(v: number): void {
    this.rainAmount = Math.max(0, v)
    if (!this.ctx || !this.rainBedGain || !this.dropsGain) return
    const t = this.ctx.currentTime
    this.rainBedGain.gain.setTargetAtTime(0.04 + 0.05 * Math.min(1.5, this.rainAmount), t, 0.5)
    this.dropsGain.gain.setTargetAtTime(0.32 + 0.2 * Math.min(1, this.rainAmount), t, 0.5)
  }

  // ------------------------------------------------------------------ graph

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

  /** a handful of pre-rendered 5–15 ms noise bursts — the raw material of a droplet */
  private buildDropBuffers(ctx: AudioContext): void {
    for (let b = 0; b < 8; b++) {
      const len = Math.floor(ctx.sampleRate * (0.005 + Math.random() * 0.01))
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
      this.dropBuffers.push(buffer)
    }
  }

  /** the distant wash — quiet, low, just enough to glue the droplets together */
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

  /** discrete droplets: narrow-band bursts, random pitch, random stereo position */
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
      bp.frequency.value = 1500 + Math.random() * 2800 // droplet pitch
      bp.Q.value = 5 + Math.random() * 6 // narrow → tonal "plink"

      const g = ctx.createGain()
      g.gain.value = 0.5 + Math.random() * 0.5

      const pan = ctx.createStereoPanner()
      pan.pan.value = Math.random() * 1.6 - 0.8 // the rain falls all around

      src.connect(bp)
      bp.connect(g)
      g.connect(pan)
      pan.connect(this.dropsGain)
      src.start(ctx.currentTime + Math.random() * 0.05)
    }

    // next batch: ~15–40 droplets per second at amount 1
    this.rainLoopTimer = window.setTimeout(() => this.scheduleDrops(), 35 + Math.random() * 80)
  }

  /** Am drone — warm, melancholic, breathing; the storefront's hum */
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

  /** one low rumble: noise shaped by a power fade + slow wobble, deeply low-passed */
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

/** module-level singleton — one audio context for the page */
export const ambience = new Ambience()

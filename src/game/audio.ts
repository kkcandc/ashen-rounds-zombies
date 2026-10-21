import type { Report } from './balance'

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private drone: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private noise: AudioBuffer | null = null
  private started = false

  resume() {
    if (!this.ctx) this.boot()
    void this.ctx?.resume()
    this.started = true
  }

  private boot() {
    const ctx = new AudioContext()
    const master = ctx.createGain()
    master.gain.value = 0.32
    master.connect(ctx.destination)
    const noiseLen = Math.floor(ctx.sampleRate * 0.4)
    const noise = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1

    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 48
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 140
    const drone = ctx.createGain()
    drone.gain.value = 0.045
    osc.connect(filter)
    filter.connect(drone)
    drone.connect(master)
    osc.start()

    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = 62
    const subG = ctx.createGain()
    subG.gain.value = 0.04
    sub.connect(subG)
    subG.connect(master)
    sub.start()

    this.ctx = ctx
    this.master = master
    this.drone = drone
    this.filter = filter
    this.noise = noise
  }

  mood(round: number, last: boolean, hurt: boolean) {
    if (!this.drone || !this.filter) return
    const tension = Math.min(1, (round - 1) / 18) + (last ? 0.25 : 0)
    this.drone.gain.value = 0.035 + tension * 0.05
    this.filter.frequency.value = 120 + tension * 220 + (hurt ? 80 : 0)
  }

  private envNoise(duration: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass') {
    if (!this.ctx || !this.master || !this.noise || !this.started) return
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    filter.Q.value = q
    const g = ctx.createGain()
    const now = ctx.currentTime
    g.gain.setValueAtTime(gain, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + duration)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(now)
    src.stop(now + duration + 0.02)
  }

  private tone(freq: number, duration: number, gain: number, type: OscillatorType = 'square') {
    if (!this.ctx || !this.master || !this.started) return
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const g = ctx.createGain()
    const now = ctx.currentTime
    g.gain.setValueAtTime(gain, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + duration)
    osc.connect(g)
    g.connect(this.master)
    osc.start(now)
    osc.stop(now + duration + 0.02)
  }

  shot(report: Report) {
    if (report === 'shot') {
      this.envNoise(0.18, 180, 0.7, 0.55, 'lowpass')
      this.tone(90, 0.12, 0.2, 'sawtooth')
      return
    }
    if (report === 'rifle') {
      this.envNoise(0.14, 900, 0.8, 0.28)
      this.tone(140, 0.1, 0.16, 'square')
      return
    }
    if (report === 'heavy') {
      this.envNoise(0.22, 120, 0.6, 0.5, 'lowpass')
      this.tone(70, 0.16, 0.22, 'sawtooth')
      return
    }
    if (report === 'auto') {
      this.envNoise(0.07, 1400, 0.7, 0.16)
      this.tone(180, 0.05, 0.06, 'square')
      return
    }
    this.envNoise(0.09, 1600, 1, 0.22)
    this.tone(220, 0.06, 0.07, 'square')
  }

  dry() {
    this.tone(180, 0.04, 0.05, 'square')
  }

  hit(head: boolean) {
    this.tone(head ? 880 : 420, 0.05, head ? 0.06 : 0.04, 'triangle')
  }

  hurt() {
    this.tone(96, 0.18, 0.12, 'sawtooth')
    this.envNoise(0.12, 200, 0.5, 0.15, 'lowpass')
  }

  buy() {
    this.tone(520, 0.08, 0.06, 'square')
    this.tone(780, 0.1, 0.05, 'square')
  }

  deny() {
    this.tone(110, 0.12, 0.06, 'square')
  }

  round() {
    this.tone(196, 0.18, 0.07, 'triangle')
    this.tone(247, 0.22, 0.05, 'triangle')
    this.tone(294, 0.28, 0.05, 'triangle')
  }

  lull() {
    this.tone(330, 0.16, 0.05, 'sine')
    this.tone(392, 0.22, 0.04, 'sine')
  }

  plank() {
    this.tone(240, 0.05, 0.05, 'square')
  }

  knife(hit: boolean) {
    this.envNoise(0.08, hit ? 600 : 300, 0.6, 0.12)
  }

  vault() {
    this.tone(440, 0.12, 0.05, 'triangle')
    this.tone(660, 0.16, 0.04, 'triangle')
  }

  dead() {
    this.tone(90, 0.4, 0.1, 'sawtooth')
    this.tone(60, 0.6, 0.08, 'sine')
  }

  step() {
    this.envNoise(0.04, 220, 0.4, 0.05, 'lowpass')
  }

  blip() {
    this.tone(640, 0.04, 0.03, 'square')
  }

  reload() {
    this.tone(280, 0.07, 0.045, 'triangle')
    this.envNoise(0.06, 900, 0.6, 0.04)
  }

  seat() {
    this.tone(720, 0.035, 0.05, 'square')
    this.tone(480, 0.06, 0.04, 'triangle')
  }

  groan() {
    this.tone(70 + Math.random() * 30, 0.25, 0.03, 'sawtooth')
  }
}

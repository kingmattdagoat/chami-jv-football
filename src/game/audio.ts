/** Tiny WebAudio synth — no audio files to download. */
export type Sfx =
  | 'snap' | 'throw' | 'catch' | 'tackle' | 'whistle' | 'juke' | 'incomplete' | 'td'
  | 'coin' | 'click' | 'error' | 'flip' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'kick' | 'good' | 'bad'

let ctx: AudioContext | null = null
let enabled = true

export function setSoundEnabled(on: boolean) {
  enabled = on
}

function ac() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.08, delay = 0, slide = 0) {
  const a = ac()
  if (!a) return
  const t = a.currentTime + delay
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noise(dur: number, vol = 0.12, delay = 0) {
  const a = ac()
  if (!a) return
  const len = Math.floor(a.sampleRate * dur)
  const buf = a.createBuffer(1, len, a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = a.createBufferSource()
  const g = a.createGain()
  g.gain.value = vol
  src.buffer = buf
  src.connect(g).connect(a.destination)
  src.start(a.currentTime + delay)
}

export function play(s: Sfx) {
  if (!enabled) return
  try {
    switch (s) {
      case 'snap': return noise(0.05, 0.15)
      case 'throw': return tone(300, 0.25, 'triangle', 0.06, 0, 500)
      case 'catch': return tone(660, 0.08, 'square', 0.06), tone(880, 0.1, 'square', 0.06, 0.07)
      case 'tackle': return noise(0.18, 0.25), tone(90, 0.2, 'sine', 0.2)
      case 'whistle': return tone(2200, 0.25, 'sine', 0.05, 0.05), tone(2350, 0.2, 'sine', 0.04, 0.32)
      case 'juke': return tone(500, 0.08, 'square', 0.05, 0, 400)
      case 'incomplete': return tone(220, 0.25, 'sawtooth', 0.05, 0, -120)
      case 'td': return [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.07, i * 0.12))
      case 'coin': return tone(988, 0.07, 'square', 0.05), tone(1319, 0.16, 'square', 0.05, 0.07)
      case 'click': return tone(700, 0.04, 'square', 0.03)
      case 'error': return tone(160, 0.2, 'square', 0.06), tone(120, 0.25, 'square', 0.06, 0.12)
      case 'flip': return noise(0.06, 0.08), tone(400, 0.08, 'triangle', 0.05, 0, 300)
      case 'rare': return [660, 990].forEach((f, i) => tone(f, 0.15, 'triangle', 0.07, i * 0.09))
      case 'epic': return [523, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.08, i * 0.1))
      case 'legendary': return [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, 'square', 0.06, i * 0.09))
      case 'mythic':
        noise(0.4, 0.2)
        return [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.35, 'square', 0.06, 0.2 + i * 0.08))
      case 'kick': return noise(0.08, 0.2), tone(120, 0.12, 'sine', 0.2)
      case 'good': return [784, 1047].forEach((f, i) => tone(f, 0.2, 'square', 0.06, i * 0.1))
      case 'bad': return tone(300, 0.3, 'sawtooth', 0.05, 0, -200)
    }
  } catch {
    /* audio is optional */
  }
}

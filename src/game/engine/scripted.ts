import type { GameSlots } from '../lineup'
import { clamp } from '../rng'
import type { DefAnim } from './ai'
import { CENTER_Y, FIELD_W, type Popup, type Scene, type SceneEnt } from './scene'
import type { GameState } from './types'

/**
 * Animated playback of a simulated opponent snap. Offense coordinates are from the
 * opponent's perspective (x = yards from their goal line), mirrored for drawing.
 */
type Key = [number, number, number] // t, x, y

interface Actor {
  key: string
  team: 'user' | 'opp'
  number: number | null
  path: Key[]
  down?: number
}

const C = CENTER_Y
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)

function at(path: Key[], t: number): [number, number] {
  if (t <= path[0][0]) return [path[0][1], path[0][2]]
  for (let i = 1; i < path.length; i++) {
    const [t1, x1, y1] = path[i]
    const [t0, x0, y0] = path[i - 1]
    if (t <= t1) {
      const p = ease((t - t0) / Math.max(0.001, t1 - t0))
      return [x0 + (x1 - x0) * p, y0 + (y1 - y0) * p]
    }
  }
  const l = path[path.length - 1]
  return [l[1], l[2]]
}

export class ScriptedPlay {
  t = 0
  end: number
  actors: Actor[] = []
  ball: (t: number) => { x: number; y: number; z: number }
  popups: Popup[] = []
  los: number
  toGo: number
  private fired = new Set<string>()
  onSound: (s: 'snap' | 'throw' | 'catch' | 'tackle' | 'whistle' | 'incomplete' | 'td') => void

  constructor(state: GameState, a: DefAnim, onSound: ScriptedPlay['onSound'] = () => {}) {
    this.onSound = onSound
    const L = state.ballOn
    this.los = L
    this.toGo = state.toGo
    const E = L + a.yards
    const lane = a.laneY
    const P = state.userTeam.players
    const num = (s: GameSlots) => P[s].number
    const oppNum = (k: string) => 10 + ((k.charCodeAt(0) * 7 + k.length * 13) % 80)
    const add = (key: string, team: Actor['team'], path: Key[], number: number | null) => {
      this.actors.push({ key, team, path, number })
    }
    const isRun = a.play === 'run' && a.type !== 'sack'
    const tCatch = 1.5
    let tEnd = 1.6
    if (isRun) tEnd = 1.0 + clamp(Math.abs(a.yards) / 7.5, 0.6, 3.2)
    else if (a.type === 'pass') tEnd = tCatch + clamp((a.yards - a.catchDepth) / 7, 0.3, 3)
    else if (a.type === 'sack') tEnd = 1.7
    else if (a.type === 'int') tEnd = tCatch + 1.1
    else if (a.type === 'fumble') tEnd = 1.0 + clamp(Math.abs(a.yards) / 7.5, 0.6, 3.2)
    this.end = tEnd

    const catchX = L + a.catchDepth
    const rcvStartY = lane < C ? C - 14 : C + 14
    // Opponent offense
    add('QB', 'opp', a.type === 'sack' ? [[0, L - 1.2, C], [0.6, L - 5, C], [tEnd, E, C + 0.5]] : isRun ? [[0, L - 1.2, C], [0.5, L - 2.5, C]] : [[0, L - 1.2, C], [0.6, L - 5, C]], oppNum('QB'))
    add('RB', 'opp', isRun ? [[0, L - 6, C], [0.5, L - 2, C], [tEnd, E, lane]] : [[0, L - 6, C], [0.8, L - 4, C + 3]], oppNum('RB'))
    const target: Key[] = a.type === 'pass' ? [[0, L - 1, rcvStartY], [tCatch, catchX, lane], [tEnd, E, lane + (lane < C ? 2 : -2)]] : [[0, L - 1, rcvStartY], [tCatch, catchX - 0.8, lane]]
    add('WR1', 'opp', isRun ? [[0, L - 1, rcvStartY], [tEnd, L + 6, rcvStartY]] : target, oppNum('WR1'))
    add('WR2', 'opp', [[0, L - 1, FIELD_W - rcvStartY], [tEnd + 0.5, L + 14, FIELD_W - rcvStartY]], oppNum('WR2'))
    add('TE', 'opp', [[0, L - 0.9, C + 3.6], [tEnd, L + 5, C + 6]], oppNum('TE'))
    for (const [i, dy] of [-1.7, 0, 1.7].entries()) add(`OL${i}`, 'opp', [[0, L - 0.8, C + dy], [1, L + 0.4, C + dy]], oppNum(`OL${i}`))

    // Chaminade defense
    const endSpot: [number, number] = a.type === 'sack' ? [E, C + 0.5] : a.type === 'int' ? [catchX - (a.yards > 0 ? 6 : 3), lane] : a.type === 'incomplete' ? [catchX, lane] : [E, isRun ? lane : lane + (lane < C ? 2 : -2)]
    const starts: Array<[GameSlots, number, number]> = [
      ['DL1', L + 1, C - 1.2],
      ['DL2', L + 1, C + 1.2],
      ['LB1', L + 5, C - 3.5],
      ['LB2', L + 5, C + 3.5],
      ['CB1', L + 6, C - 14],
      ['CB2', L + 6, C + 14],
      ['S', L + 13, C],
    ]
    for (const [slot, x, y] of starts) {
      const isHero = slot === a.defender
      let path: Key[]
      if (isHero) {
        if (a.type === 'int') path = [[0, x, y], [tCatch, catchX + 0.3, lane], [tEnd, endSpot[0], endSpot[1]]]
        else if (a.type === 'incomplete') path = [[0, x, y], [tCatch, catchX + 0.6, lane + 0.5]]
        else path = [[0, x, y], [tEnd, endSpot[0] + 0.7, endSpot[1]]]
      } else {
        const k = 0.35 + ((x * 13 + y * 7) % 10) / 25
        path = [[0, x, y], [0.4, x - 0.3, y], [tEnd, x + (endSpot[0] - x) * k, y + (endSpot[1] - y) * k]]
      }
      this.actors.push({ key: slot, team: 'user', path, number: num(slot), down: undefined })
    }

    const qbAt = (t: number) => this.pos('QB', t)
    this.ball = (t: number) => {
      if (isRun) {
        const h = t < 0.5 ? qbAt(t) : this.pos('RB', t)
        return { x: h[0], y: h[1], z: 1 }
      }
      if (a.type === 'sack') {
        const h = qbAt(t)
        return { x: h[0], y: h[1], z: 1 }
      }
      const tThrow = 0.9
      if (t < tThrow) {
        const h = qbAt(t)
        return { x: h[0], y: h[1], z: 1 }
      }
      if (t < tCatch) {
        const p = (t - tThrow) / (tCatch - tThrow)
        const [sx, sy] = qbAt(tThrow)
        const tx = a.type === 'int' ? catchX + 0.3 : catchX
        return { x: sx + (tx - sx) * p, y: sy + (lane - sy) * p, z: 1 + Math.sin(Math.PI * p) * Math.min(8, (tx - sx) * 0.25) }
      }
      if (a.type === 'pass') {
        const h = this.pos('WR1', t)
        return { x: h[0], y: h[1], z: 1 }
      }
      if (a.type === 'int') {
        const h = this.pos(a.defender, t)
        return { x: h[0], y: h[1], z: 1 }
      }
      return { x: catchX + 1.5, y: lane + 1, z: 0.2 }
    }
    this.kind = a.type
    this.tCatch = isRun || a.type === 'sack' ? -1 : tCatch
    this.td = a.yards > 0 && L + a.yards >= 100 && (a.type === 'run' || a.type === 'pass')
    this.heroName = `${P[a.defender].number != null ? `#${P[a.defender].number} ` : ''}${P[a.defender].name.split(' ').slice(-1)[0]}`
  }

  kind: string
  tCatch: number
  td: boolean
  heroName: string

  private pos(key: string, t: number) {
    return at(this.actors.find((x) => x.key === key)!.path, t)
  }

  private once(id: string, fn: () => void) {
    if (this.fired.has(id)) return
    this.fired.add(id)
    fn()
  }

  update(dt: number) {
    if (this.t === 0) this.onSound('snap')
    this.t += dt
    for (const p of this.popups) p.age += dt
    this.popups = this.popups.filter((p) => p.age < 1.3)
    const mx = (x: number) => 110 - x
    const my = (y: number) => FIELD_W - y
    if (this.tCatch > 0 && this.t > 0.9) this.once('throw', () => this.onSound('throw'))
    if (this.tCatch > 0 && this.t > this.tCatch) {
      this.once('catch', () => {
        const b = this.ball(this.tCatch)
        if (this.kind === 'pass') this.onSound('catch')
        if (this.kind === 'incomplete') {
          this.onSound('incomplete')
          this.popups.push({ x: mx(b.x), y: my(b.y) - 2, text: `BROKEN UP · ${this.heroName}`, color: '#9f9', age: 0 })
        }
        if (this.kind === 'int') this.popups.push({ x: mx(b.x), y: my(b.y) - 2, text: `PICKED OFF · ${this.heroName}`, color: '#9f9', age: 0 })
      })
    }
    if (this.t > this.end) {
      this.once('end', () => {
        const b = this.ball(this.end)
        if (this.td) this.onSound('td')
        else if (this.kind !== 'incomplete' && this.kind !== 'int') {
          this.onSound('tackle')
          this.popups.push({ x: mx(b.x), y: my(b.y) - 2, text: this.kind === 'sack' ? `SACK · ${this.heroName}` : this.kind === 'fumble' ? `FUMBLE! · ${this.heroName}` : `TACKLE · ${this.heroName}`, color: this.kind === 'sack' || this.kind === 'fumble' ? '#9f9' : '#fff6dc', age: 0 })
        }
        this.onSound('whistle')
      })
    }
  }

  get done() {
    return this.t > this.end + 1.1
  }

  scene(): Scene {
    const t = Math.min(this.t, this.end)
    const mx = (x: number) => 110 - x
    const my = (y: number) => FIELD_W - y
    const ents: SceneEnt[] = this.actors.map((a) => {
      const [x, y] = at(a.path, t)
      const [px] = at(a.path, Math.max(0, t - 0.05))
      const moving = this.t < this.end && Math.abs(x - px) + 0.0001 > 0.002
      return {
        x: mx(x),
        y: my(y),
        team: a.team,
        number: a.number,
        facing: a.team === 'opp' ? -1 : 1,
        step: this.t * 7 * (moving ? 1 : 0),
        moving,
        carrier: false,
        down: false,
        controlled: false,
      }
    })
    const b = this.ball(t)
    return {
      ents,
      ball: { x: mx(b.x), y: my(b.y), z: b.z },
      losX: mx(this.los),
      firstDownX: this.los + this.toGo < 100 ? mx(this.los + this.toGo) : null,
      focusX: mx(b.x),
      focusY: my(b.y),
      lookAhead: -10,
      aim: null,
      popups: this.popups,
      hint: null,
    }
  }
}

import type { Attrs } from '../cards'
import type { GameSlots } from '../lineup'
import { clamp, defaultRng, gauss, hashStr, mulberry32, type Rng } from '../rng'
import type { Formation } from '../types'
import { RECEIVER_SLOTS, type PlayDef, type Receiver, type RouteId } from './plays'
import { CENTER_Y, FIELD_W, type Popup, type Scene } from './scene'
import type { GameState, PlayOutcome } from './types'

/**
 * Real-time offensive play. Coordinates are "offense yards": x = yards from
 * Chaminade's goal line (0..100, end zones -10..0 and 100..110), y = 0..53.3.
 */
export interface InputState {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  sprint: boolean
  juke: boolean
  pointer: { x: number; y: number } | null
}

interface Ent {
  id: string
  side: 'off' | 'def'
  role: string
  playerId: string | null
  number: number | null
  attrs: Attrs
  x: number
  y: number
  vx: number
  vy: number
  maxSpeed: number
  accel: number
  route: Array<[number, number]>
  routeI: number
  hold: boolean
  cover: string | null
  rush: boolean
  engagedWith: string | null
  engageT: number
  stunT: number
  tackleCd: number
  step: number
  down: boolean
}

type LivePhase = 'presnap' | 'handoff' | 'pocket' | 'air' | 'run' | 'dead'

const C = CENTER_Y

function len(x: number, y: number) {
  return Math.hypot(x, y)
}

function oppAttrs(base: number, role: string, rng: Rng): Attrs {
  const j = () => Math.round(gauss(rng) * 3)
  const b = base + j()
  const p: Record<string, [number, number, number, number]> = {
    // speed, coverage, tackling, strength
    DL: [-8, -15, 2, 6],
    LB: [-2, -4, 3, 1],
    CB: [3, 2, -4, -5],
    S: [1, 2, 0, -2],
  }
  const [sp, cv, tk, st] = p[role.replace(/\d/, '')] ?? [0, 0, 0, 0]
  const c = (v: number) => clamp(Math.round(v), 35, 99)
  return {
    throwAcc: 40, throwPow: 40, accel: c(b + sp), agility: c(b + sp - 2), ballSec: 50, catching: c(b - 10 + cv),
    route: 40, blocking: 40, kickPow: 40, kickAcc: 40,
    speed: c(b + sp + j()), coverage: c(b + cv + j()), tackling: c(b + tk + j()), strength: c(b + st + j()), awareness: c(b + j()),
  }
}

const speedOf = (a: Attrs) => 4.1 + a.speed * 0.042
const accelOf = (a: Attrs) => 7 + a.accel * 0.07

function routePoints(id: RouteId, sx: number, sy: number): { pts: Array<[number, number]>; hold: boolean } {
  const inSign = sy < C ? 1 : -1
  const P = (pairs: Array<[number, number]>) => {
    let x = sx
    let y = sy
    return pairs.map(([dx, dIn]) => {
      x += dx
      y += dIn * inSign
      return [x, clamp(y, 1.5, FIELD_W - 1.5)] as [number, number]
    })
  }
  switch (id) {
    case 'go':
      return { pts: P([[60, 0]]), hold: false }
    case 'slant':
      return { pts: P([[3, 0], [16, 11]]), hold: false }
    case 'curl':
      return { pts: P([[11, 0], [-1.5, 1.5]]), hold: true }
    case 'post':
      return { pts: P([[11, 0], [30, 12]]), hold: false }
    case 'out':
      return { pts: P([[7, 0], [1, -25]]), hold: false }
    case 'flat':
      return { pts: P([[1.5, -6], [4, -22]]), hold: false }
    case 'drag':
      return { pts: P([[2, 1], [3, 32]]), hold: false }
    case 'corner':
      return { pts: P([[10, 0], [22, -14]]), hold: false }
    case 'wheel':
      return { pts: P([[2, -8], [40, -2]]), hold: false }
    case 'screen':
      return { pts: P([[-1.5, 1.5]]), hold: true }
    case 'block':
      return { pts: P([[2.5, 0]]), hold: true }
  }
}

export interface LiveResult {
  outcome: PlayOutcome
}

export class LiveSim {
  phase: LivePhase = 'presnap'
  t = 0
  deadT = 0
  ents: Ent[] = []
  holder: string | null = null
  ball: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }
  flight: { sx: number; sy: number; tx: number; ty: number; t: number; T: number; target: string | null } | null = null
  popups: Popup[] = []
  los: number
  toGo: number
  play: PlayDef
  rng: Rng
  stamina = 1
  jukeT = 0
  jukeCd = 0
  wasPass = false
  caught = false
  receiverId: string | null = null
  scramble = false
  result: PlayOutcome | null = null
  blitz: boolean
  runBonus: number
  onSound: (s: 'snap' | 'throw' | 'catch' | 'tackle' | 'whistle' | 'juke' | 'incomplete' | 'td') => void

  constructor(
    state: GameState,
    play: PlayDef,
    onSound: LiveSim['onSound'] = () => {},
    rng: Rng = defaultRng,
  ) {
    this.play = play
    this.rng = rng
    this.onSound = onSound
    this.los = state.ballOn
    this.toGo = state.toGo
    this.blitz = rng() < (play.kind === 'run' ? 0.15 : 0.22)
    this.runBonus = state.formation === 'pro' ? 1.3 : state.formation === 'shotgun' ? 1.05 : 1
    this.setup(state, state.formation)
  }

  private get(id: string) {
    return this.ents.find((e) => e.id === id)!
  }

  private mk(side: Ent['side'], role: string, x: number, y: number, attrs: Attrs, playerId: string | null, number: number | null): Ent {
    return {
      id: `${side}-${role}`, side, role, playerId, number, attrs, x, y, vx: 0, vy: 0,
      maxSpeed: speedOf(attrs), accel: accelOf(attrs), route: [], routeI: 0, hold: false, cover: null, rush: false,
      engagedWith: null, engageT: 0, stunT: 0, tackleCd: 0, step: 0, down: false,
    }
  }

  private setup(state: GameState, formation: Formation) {
    const L = this.los
    const P = state.userTeam.players
    const add = (slot: GameSlots, x: number, y: number) => {
      const p = P[slot]
      this.ents.push(this.mk('off', slot, x, y, p.attrs, p.playerId, p.number))
    }
    const f = {
      spread: { QB: [-5, 0], RB: [-5, 2.2], WR1: [-1, -15], WR2: [-1, 15], TE: [-1.5, 9] },
      pro: { QB: [-1.2, 0], RB: [-6.5, 0], WR1: [-1, -15], WR2: [-1, 15], TE: [-0.9, 3.6] },
      shotgun: { QB: [-5, 0], RB: [-5, -2.2], WR1: [-1, -13], WR2: [-1, 13], TE: [-1.5, -7.5] },
    }[formation]
    for (const k of ['QB', 'RB', 'WR1', 'WR2', 'TE'] as const) add(k, L + f[k][0], C + f[k][1])
    add('OL1', L - 0.8, C - 1.7)
    add('OL2', L - 0.8, C)
    add('OL3', L - 0.8, C + 1.7)

    const seed = hashStr(state.id + state.log.length)
    const drng = mulberry32(seed)
    const base = state.opp.def
    const dmk = (role: string, x: number, y: number) => {
      const e = this.mk('def', role, Math.min(109, x), y, oppAttrs(base, role, drng), null, 20 + (hashStr(state.opp.id + role) % 79))
      this.ents.push(e)
      return e
    }
    const wr1 = this.get('off-WR1')
    const wr2 = this.get('off-WR2')
    dmk('DL1', L + 1, C - 1.2).rush = true
    dmk('DL2', L + 1, C + 1.2).rush = true
    dmk('LB1', L + 5, C - 3.5).cover = 'off-TE'
    const lb2 = dmk('LB2', L + 5, C + 3.5)
    if (this.blitz) lb2.rush = true
    else lb2.cover = 'off-RB'
    dmk('CB1', L + 6, wr1.y).cover = 'off-WR1'
    dmk('CB2', L + 6, wr2.y).cover = 'off-WR2'
    dmk('S', L + 13, C)

    this.holder = 'off-QB'
    const qb = this.get('off-QB')
    this.ball = { x: qb.x, y: qb.y, z: 1 }
  }

  snap() {
    if (this.phase !== 'presnap') return
    this.onSound('snap')
    this.t = 0
    for (const r of RECEIVER_SLOTS) {
      const e = this.get(`off-${r}`)
      const rid = this.play.routes[r]
      if (!rid) continue
      const rp = routePoints(rid, e.x, e.y)
      e.route = rp.pts
      e.hold = rp.hold
    }
    if (this.play.carrier || this.play.flea) {
      this.phase = 'handoff'
    } else {
      this.phase = 'pocket'
      this.wasPass = true
    }
  }

  get canThrow() {
    return this.phase === 'pocket' && this.holder === 'off-QB'
  }

  get qbPos() {
    const q = this.get('off-QB')
    return { x: q.x, y: q.y }
  }

  maxThrow() {
    return 30 + this.get('off-QB').attrs.throwPow * 0.3
  }

  receiverPos(r: Receiver) {
    const e = this.get(`off-${r}`)
    return { x: e.x + e.vx * 0.6, y: e.y + e.vy * 0.6 }
  }

  throwAt(tx: number, ty: number) {
    if (!this.canThrow) return
    const qb = this.get('off-QB')
    let dx = tx - qb.x
    let dy = ty - qb.y
    const d0 = len(dx, dy)
    if (d0 < 2) return
    const maxD = this.maxThrow()
    if (d0 > maxD) {
      dx *= maxD / d0
      dy *= maxD / d0
    }
    const dist = len(dx, dy)
    const pressure = this.ents.some((e) => e.side === 'def' && e.rush && len(e.x - qb.x, e.y - qb.y) < 2.5)
    const moving = len(qb.vx, qb.vy) > 1.5
    const err = dist * (0.015 + (100 - qb.attrs.throwAcc) * 0.0022) * (pressure ? 1.7 : 1) * (moving ? 1.3 : 1)
    const lx = qb.x + dx + gauss(this.rng) * err
    const ly = qb.y + dy + gauss(this.rng) * err
    const speed = 15 + qb.attrs.throwPow * 0.12
    const T = dist / speed + 0.18
    // The receiver whose path best matches the throw goes up for it.
    let best: Ent | null = null
    let bd = Infinity
    for (const r of RECEIVER_SLOTS) {
      const e = this.get(`off-${r}`)
      if (this.play.routes[r] === 'block' || !this.play.routes[r]) continue
      const d = len(e.x + e.vx * T - lx, e.y + e.vy * T - ly)
      if (d < bd) {
        bd = d
        best = e
      }
    }
    this.flight = { sx: qb.x, sy: qb.y, tx: lx, ty: ly, t: 0, T, target: best && bd < 9 ? best.id : null }
    this.holder = null
    this.phase = 'air'
    this.wasPass = true
    this.onSound('throw')
  }

  /** Throw to a receiver using keyboard shortcuts — leads him automatically. */
  throwToReceiver(r: Receiver) {
    if (!this.canThrow) return
    const e = this.get(`off-${r}`)
    const qb = this.get('off-QB')
    const d = len(e.x - qb.x, e.y - qb.y)
    const T = d / (15 + qb.attrs.throwPow * 0.12) + 0.18
    this.throwAt(e.x + e.vx * T, e.y + e.vy * T)
  }

  startScramble() {
    if (!this.canThrow) return
    this.scramble = true
    this.phase = 'run'
  }

  private steer(e: Ent, tx: number, ty: number, dt: number, speedMul = 1, arrive = true) {
    const dx = tx - e.x
    const dy = ty - e.y
    const d = len(dx, dy)
    const sp = e.maxSpeed * speedMul * (arrive ? Math.min(1, d / 1.2) : 1)
    const dvx = d > 0.01 ? (dx / d) * sp : 0
    const dvy = d > 0.01 ? (dy / d) * sp : 0
    this.accelTo(e, dvx, dvy, dt)
  }

  private accelTo(e: Ent, dvx: number, dvy: number, dt: number) {
    const ax = dvx - e.vx
    const ay = dvy - e.vy
    const a = len(ax, ay)
    const max = e.accel * dt
    if (a > max) {
      e.vx += (ax / a) * max
      e.vy += (ay / a) * max
    } else {
      e.vx = dvx
      e.vy = dvy
    }
  }

  private popup(x: number, y: number, text: string, color = '#fff6dc') {
    this.popups.push({ x, y, text, color, age: 0 })
  }

  update(dt: number, input: InputState) {
    dt = Math.min(dt, 1 / 30)
    for (const p of this.popups) p.age += dt
    this.popups = this.popups.filter((p) => p.age < 1.2)
    if (this.phase === 'presnap') return
    if (this.phase === 'dead') {
      this.deadT += dt
      for (const e of this.ents) {
        e.vx *= 0.85
        e.vy *= 0.85
        e.x += e.vx * dt
        e.y += e.vy * dt
      }
      return
    }
    this.t += dt
    this.jukeT = Math.max(0, this.jukeT - dt)
    this.jukeCd = Math.max(0, this.jukeCd - dt)
    const qb = this.get('off-QB')
    const carrier = this.holder ? this.get(this.holder) : null

    // ---- Offense ----
    for (const e of this.ents.filter((x) => x.side === 'off')) {
      if (e.stunT > 0) {
        e.stunT -= dt
        this.accelTo(e, 0, 0, dt)
        continue
      }
      if (e.engagedWith) {
        e.vx *= 0.5
        e.vy *= 0.5
        continue
      }
      if (e.id === this.holder && (this.phase === 'run' || (this.phase === 'pocket' && e.role === 'QB'))) {
        this.controlCarrier(e, input, dt)
        continue
      }
      if (e.role === 'QB') {
        if (this.phase === 'handoff' && this.play.carrier === 'QB') {
          if (this.t > 0.35) {
            this.holder = 'off-QB'
            this.phase = 'run'
            this.scramble = false
          }
          continue
        }
        const dropX = this.los - Math.max(this.play.drop, 1)
        if (this.phase === 'pocket' || this.phase === 'handoff') this.steer(e, Math.min(e.x, dropX), e.y, dt, 0.7)
        else this.accelTo(e, 0, 0, dt)
        continue
      }
      if (e.role === 'RB' && this.phase === 'handoff' && (this.play.carrier === 'RB' || this.play.flea)) {
        if (this.holder === e.id) {
          this.steer(e, e.x + 3, e.y, dt, 0.7, false)
          continue
        }
        const side = this.play.runStyle === 'outside' ? (qb.y < C ? -1 : 1) : 0
        this.steer(e, qb.x + 0.3, qb.y + side * 1.2, dt, 1, false)
        if (len(e.x - qb.x, e.y - qb.y) < 1.1 || this.t > 0.7) {
          this.holder = e.id
          if (this.play.flea) {
            this.popup(e.x, e.y - 2, 'FAKE!')
          } else this.phase = 'run'
        }
        continue
      }
      if (e.role.startsWith('OL') || (e.hold && e.route.length && this.play.routes[e.role as Receiver] === 'block')) {
        this.blocker(e, dt)
        continue
      }
      if (e.role === 'RB' && this.play.routes.RB === 'block') {
        this.blocker(e, dt)
        continue
      }
      // Receivers run routes; once the ball is caught or run play, they block.
      if (this.phase === 'run' && this.holder !== e.id) {
        this.blocker(e, dt)
        continue
      }
      if (this.phase === 'air' && this.flight?.target === e.id) {
        this.steer(e, this.flight.tx, this.flight.ty, dt, 1, false)
        continue
      }
      if (e.route.length && this.holder !== e.id) this.runRoute(e, dt)
      else this.accelTo(e, 0, 0, dt)
    }

    // ---- Flea flicker pitch-back ----
    if (this.play.flea && this.phase === 'handoff' && this.holder === 'off-RB' && this.t > 1.25) {
      this.holder = 'off-QB'
      this.phase = 'pocket'
      this.wasPass = true
      this.popup(qb.x, qb.y - 2, 'PITCH BACK!', '#ffd54a')
    }

    // ---- Defense ----
    const target = this.holder ? this.get(this.holder) : null
    for (const d of this.ents.filter((x) => x.side === 'def')) {
      d.tackleCd = Math.max(0, d.tackleCd - dt)
      if (d.stunT > 0) {
        d.stunT -= dt
        this.accelTo(d, 0, 0, dt)
        continue
      }
      if (d.engagedWith) {
        d.engageT -= dt
        const b = this.get(d.engagedWith)
        d.vx = 0.3
        d.vy = 0
        if (d.engageT <= 0) {
          b.engagedWith = null
          b.stunT = 0.4
          d.engagedWith = null
        }
        continue
      }
      const bite = this.play.flea && this.t < 1.9 && (d.role.startsWith('LB') || d.role === 'S')
      if (bite) {
        this.steer(d, this.los + 1.5, qb.y + (d.y - qb.y) * 0.5, dt, 0.9)
        continue
      }
      if (this.phase === 'air' && this.flight) {
        const f = this.flight
        const dist = len(d.x - f.tx, d.y - f.ty)
        if (dist < 11 && !d.rush) {
          this.steer(d, f.tx, f.ty, dt, 1, false)
          continue
        }
      }
      const preCatch = this.phase === 'pocket' || this.phase === 'air' || (this.phase === 'handoff' && this.play.flea)
      if (preCatch) {
        if (d.rush) this.rusher(d, qb, dt)
        else if (d.cover) {
          const r = this.get(d.cover)
          const lead = 0.25 + (r.attrs.route - d.attrs.coverage) * -0.004
          const cushion = this.t < 1.2 ? 1.5 : 0.6
          this.steer(d, r.x + r.vx * lead + cushion, r.y + r.vy * lead, dt, 1)
        } else {
          // Deep safety: stay over the top of the deepest receiver.
          let deepest = this.get('off-WR1')
          for (const r of RECEIVER_SLOTS.map((k) => this.get(`off-${k}`))) if (r.x > deepest.x) deepest = r
          this.steer(d, Math.max(this.los + 12, deepest.x + 4), C + (deepest.y - C) * 0.6, dt, 0.9)
        }
      } else if (target) {
        // Pursuit with a lead based on distance.
        const dist = len(target.x - d.x, target.y - d.y)
        const lead = Math.min(0.7, dist / 12)
        this.steer(d, target.x + target.vx * lead, target.y + target.vy * lead, dt, 1, false)
      } else this.accelTo(d, 0, 0, dt)
    }

    // ---- Integrate ----
    for (const e of this.ents) {
      e.x += e.vx * dt
      e.y += e.vy * dt
      e.y = clamp(e.y, -2, FIELD_W + 2)
      e.x = clamp(e.x, -10, 110)
      e.step += len(e.vx, e.vy) * dt
    }

    // ---- Engagements (blocks) ----
    for (const b of this.ents) {
      if (b.side !== 'off' || b.engagedWith || b.stunT > 0 || b.id === this.holder) continue
      const isLine = b.role.startsWith('OL')
      if (!isLine && this.phase !== 'run' && !(b.hold && this.play.routes[b.role as Receiver] === 'block')) continue
      for (const d of this.ents) {
        if (d.side !== 'def' || d.engagedWith || d.stunT > 0) continue
        if (len(b.x - d.x, b.y - d.y) > 1.15) continue
        if (isLine && d.rush && (this.phase === 'pocket' || this.phase === 'air')) continue // pass pro is handled in rusher()
        const runBonus = this.play.kind === 'run' || this.play.carrier ? this.runBonus : 1
        const dur = clamp(0.7 + (b.attrs.blocking - d.attrs.strength) / 28, 0.25, 2.2) * (isLine ? 1 : 0.6) * runBonus
        b.engagedWith = d.id
        d.engagedWith = b.id
        d.engageT = dur
        break
      }
    }

    // ---- Ball ----
    if (this.flight) {
      const f = this.flight
      f.t += dt
      const p = Math.min(1, f.t / f.T)
      this.ball.x = f.sx + (f.tx - f.sx) * p
      this.ball.y = f.sy + (f.ty - f.sy) * p
      this.ball.z = 1 + Math.sin(Math.PI * p) * Math.min(9, len(f.tx - f.sx, f.ty - f.sy) * 0.22)
      if (p >= 1) this.resolveCatch()
    } else if (this.holder) {
      const h = this.get(this.holder)
      this.ball = { x: h.x + 0.3, y: h.y, z: 1 }
    }

    // ---- Tackles / sacks ----
    if (carrier && this.holder === carrier.id && (this.phase === 'run' || this.phase === 'pocket' || this.phase === 'handoff')) {
      this.checkTackles(carrier)
    }

    // ---- Boundaries / scores ----
    const c2 = this.holder ? this.get(this.holder) : null
    if (c2 && this.phase !== 'dead' && (this.phase === 'run' || this.phase === 'pocket' || this.phase === 'handoff')) {
      if (c2.x >= 100 && this.phase === 'run') this.end(c2, 'td')
      else if (c2.y < 0 || c2.y > FIELD_W) this.end(c2, 'oob')
    }
  }


  private controlCarrier(e: Ent, input: InputState, dt: number) {
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0)
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0)
    if (input.pointer && this.phase === 'run') {
      const px = input.pointer.x - e.x
      const py = input.pointer.y - e.y
      if (len(px, py) > 0.6) {
        dx = px
        dy = py
      }
    }
    const isQBPocket = this.phase === 'pocket' && e.role === 'QB'
    if (dx === 0 && dy === 0) {
      if (isQBPocket) {
        const dropX = this.los - Math.max(this.play.drop, 1)
        if (e.x > dropX + 0.2) this.steer(e, dropX, e.y, dt, 0.7)
        else this.accelTo(e, 0, 0, dt)
        return
      }
      dx = 1
      if (this.play.runStyle === 'outside' && this.t < 1.1 && !this.wasPass) dy = e.y < C ? -0.8 : 0.8
    }
    const d = len(dx, dy)
    const sprint = input.sprint && this.stamina > 0.05 && !isQBPocket
    this.stamina = clamp(this.stamina + (sprint ? -0.45 : 0.18) * dt, 0, 1)
    const mul = isQBPocket ? 0.55 : sprint ? 1.2 : 1
    this.accelTo(e, (dx / d) * e.maxSpeed * mul, (dy / d) * e.maxSpeed * mul, dt)
    if (input.juke && this.jukeCd <= 0 && !isQBPocket) {
      const nearest = this.ents.filter((x) => x.side === 'def').sort((a, b) => len(a.x - e.x, a.y - e.y) - len(b.x - e.x, b.y - e.y))[0]
      const away = nearest ? (nearest.y > e.y ? -1 : 1) : 1
      const dir = dy !== 0 ? Math.sign(dy) : away
      e.vy += dir * (3.5 + e.attrs.agility * 0.035)
      this.jukeT = 0.38
      this.jukeCd = 1.0
      this.onSound('juke')
      this.popup(e.x, e.y - 2, 'JUKE!', '#9ff')
    }
    // Leaving the pocket past the line turns the QB into a runner.
    if (isQBPocket && e.x > this.los + 0.3) {
      this.scramble = true
      this.phase = 'run'
    }
  }

  private runRoute(e: Ent, dt: number) {
    const pt = e.route[e.routeI]
    if (!pt) {
      if (e.hold) this.accelTo(e, 0, 0, dt)
      else this.accelTo(e, e.vx, e.vy, dt)
      return
    }
    const routeAccel = 9 + e.attrs.route * 0.09
    const save = e.accel
    e.accel = routeAccel
    this.steer(e, pt[0], pt[1], dt, 1, e.hold && e.routeI === e.route.length - 1)
    e.accel = save
    if (len(pt[0] - e.x, pt[1] - e.y) < 0.8) e.routeI++
  }

  private blocker(e: Ent, dt: number) {
    const carrier = this.holder ? this.get(this.holder) : null
    const qb = this.get('off-QB')
    if ((this.phase === 'pocket' || this.phase === 'air') && e.role.startsWith('OL')) {
      // Pass protection: sit between the nearest rusher and the QB.
      const rushers = this.ents.filter((d) => d.side === 'def' && d.rush)
      const r = rushers.sort((a, b) => len(a.x - e.x, a.y - e.y) - len(b.x - e.x, b.y - e.y))[0]
      if (r) {
        const dx = qb.x - r.x
        const dy = qb.y - r.y
        const d = len(dx, dy) || 1
        this.steer(e, r.x + (dx / d) * 0.9, r.y + (dy / d) * 0.9, dt, 0.8)
      }
      return
    }
    const ref = carrier ?? qb
    const defs = this.ents.filter((d) => d.side === 'def' && !d.engagedWith && d.stunT <= 0)
    const tgt = defs.sort((a, b) => len(a.x - ref.x, a.y - ref.y) - len(b.x - ref.x, b.y - ref.y)).find((d) => len(d.x - e.x, d.y - e.y) < 9)
    if (tgt) this.steer(e, tgt.x - 0.4, tgt.y, dt, 0.85, false)
    else this.steer(e, e.x + 1, e.y, dt, 0.4)
  }

  private rusher(d: Ent, qb: Ent, dt: number) {
    const blockers = this.ents.filter((b) => b.side === 'off' && b.role.startsWith('OL'))
    const nearestOL = blockers.sort((a, b) => len(a.x - d.x, a.y - d.y) - len(b.x - d.x, b.y - d.y))[0]
    const blocked = nearestOL && len(nearestOL.x - d.x, nearestOL.y - d.y) < 1.4
    const qbDist = len(qb.x - d.x, qb.y - d.y)
    if (blocked && qbDist > 1.2) {
      const rate = clamp(1.0 + (d.attrs.strength - nearestOL.attrs.blocking) / 22, 0.35, 2.6)
      const dx = qb.x - d.x
      const dy = qb.y - d.y
      const n = len(dx, dy) || 1
      // Slide around the block toward the QB.
      this.accelTo(d, (dx / n) * rate, (dy / n) * rate + Math.sign(d.y - nearestOL.y || 1) * 0.6, dt * 3)
    } else {
      this.steer(d, qb.x, qb.y, dt, 0.8, false)
    }
  }

  private checkTackles(c: Ent) {
    for (const d of this.ents) {
      if (d.side !== 'def' || d.engagedWith || d.stunT > 0 || d.tackleCd > 0) continue
      if (len(d.x - c.x, d.y - c.y) > 0.9) continue
      const inPocket = this.phase === 'pocket' || this.phase === 'handoff'
      let p = 0.58 + (d.attrs.tackling - (c.attrs.agility + c.attrs.strength) / 2) * 0.012
      if (inPocket) p += 0.18
      if (this.jukeT > 0) p *= 0.35
      p = clamp(p, 0.12, 0.94)
      if (this.rng() < p) {
        this.onSound('tackle')
        if (!inPocket && this.rng() < Math.max(0.004, 0.03 - c.attrs.ballSec * 0.00026)) {
          const lost = this.rng() < 0.55
          this.popup(c.x, c.y - 2, lost ? 'FUMBLE LOST!' : 'FUMBLE — RECOVERED', '#ff6b6b')
          this.end(c, lost ? 'fumble' : 'tackle', d)
        } else this.end(c, 'tackle', d)
        return
      }
      d.stunT = 0.75
      d.tackleCd = 1
      this.popup(c.x, c.y - 2, 'BROKEN TACKLE!', '#ffd54a')
    }
  }

  private resolveCatch() {
    const f = this.flight!
    this.flight = null
    const inBounds = f.ty > 0 && f.ty < FIELD_W && f.tx < 110
    const rcv = f.target ? this.get(f.target) : null
    const dR = rcv ? len(rcv.x - f.tx, rcv.y - f.ty) : Infinity
    let bestD: Ent | null = null
    let dD = Infinity
    for (const d of this.ents) {
      if (d.side !== 'def') continue
      const dist = len(d.x - f.tx, d.y - f.ty)
      if (dist < dD) {
        dD = dist
        bestD = d
      }
    }
    const catchable = rcv && dR <= 1.7 && inBounds
    if (bestD && dD <= 1.3 && (dD < dR || !catchable) && inBounds) {
      const p = clamp(0.18 + bestD.attrs.coverage * 0.0042 - (dD - 0.4) * 0.15, 0.08, 0.6)
      if (this.rng() < p) {
        this.ball = { x: bestD.x, y: bestD.y, z: 1 }
        this.holder = bestD.id
        this.popup(bestD.x, bestD.y - 2, 'INTERCEPTED!', '#ff6b6b')
        this.finish('int', f.tx - this.los, bestD)
        return
      }
    }
    if (catchable && rcv) {
      const contested = dD <= 1.5
      let p = 0.74 + rcv.attrs.catching * 0.0026 - (dR > 1.1 ? 0.12 : 0)
      if (contested) p -= (1.5 - dD) * 0.32 * (bestD ? bestD.attrs.coverage / 80 : 1)
      if (this.rng() < clamp(p, 0.12, 0.98)) {
        this.caught = true
        this.receiverId = rcv.id
        this.holder = rcv.id
        this.phase = 'run'
        this.onSound('catch')
        this.popup(rcv.x, rcv.y - 2, contested ? 'CONTESTED CATCH!' : 'CAUGHT!', '#9f9')
        if (rcv.x >= 100) this.end(rcv, 'td')
        return
      }
      this.popup(f.tx, f.ty - 2, contested ? 'BROKEN UP!' : 'DROPPED!', '#ff6b6b')
    } else this.popup(f.tx, f.ty - 2, inBounds ? 'INCOMPLETE' : 'OUT OF BOUNDS', '#ff6b6b')
    this.onSound('incomplete')
    this.finish('incomplete', 0, null)
  }

  private end(c: Ent, how: 'tackle' | 'oob' | 'td' | 'fumble', by?: Ent) {
    if (this.phase === 'dead') return
    c.down = how === 'tackle' || how === 'fumble'
    const spotX = how === 'td' ? Math.max(100, c.x) : how === 'oob' ? c.x : c.x
    const yards = spotX - this.los
    const isQB = c.role === 'QB'
    const sack = isQB && !this.scramble && (this.phase === 'pocket' || this.phase === 'handoff') && this.play.carrier !== 'QB'
    if (how === 'td') {
      this.onSound('td')
      this.popup(c.x, c.y - 2, 'TOUCHDOWN!', '#ffd54a')
    }
    this.finish(how === 'fumble' ? 'fumble' : sack ? 'sack' : this.caught ? 'pass' : 'run', yards, by ?? null, how === 'oob')
  }

  private finish(type: PlayOutcome['type'], yardsRaw: number, by: Ent | null, oob = false) {
    this.phase = 'dead'
    this.deadT = 0
    this.onSound('whistle')
    const yards = Math.round(yardsRaw)
    const qb = this.get('off-QB')
    const carrier = this.holder ? this.get(this.holder) : null
    const nm = (e: Ent | null) => (e ? `${e.number != null ? `#${e.number} ` : ''}${this.nameOf(e)}` : '')
    const rcv = this.receiverId ? this.get(this.receiverId) : null
    const yd = (n: number) => `${n} yard${Math.abs(n) === 1 ? '' : 's'}`
    let text = ''
    const td = this.los + yards >= 100
    switch (type) {
      case 'pass':
        text = td ? `${nm(qb)} hits ${nm(rcv)} for a ${yards}-yard TOUCHDOWN!` : `${nm(qb)} completes to ${nm(rcv)} for ${yd(yards)}.${oob ? ' Out of bounds.' : ''}`
        break
      case 'run':
        text = td ? `${nm(carrier)} punches it in from ${yards} out — TOUCHDOWN!` : `${nm(carrier)} ${this.scramble ? 'scrambles' : 'runs'} for ${yd(yards)}.${oob ? ' Out of bounds.' : ''}`
        break
      case 'sack':
        text = `SACKED! ${nm(qb)} goes down for a loss of ${-yards}.`
        break
      case 'incomplete':
        text = `${nm(qb)}'s pass falls incomplete.`
        break
      case 'int':
        text = `${nm(qb)} is INTERCEPTED by #${by?.number ?? '?'}!`
        break
      case 'fumble':
        text = `${nm(carrier)} FUMBLES! The defense recovers.`
        break
    }
    this.result = {
      type,
      yards: type === 'incomplete' ? 0 : yards,
      outOfBounds: oob,
      passer: this.wasPass ? (qb.playerId ?? undefined) : undefined,
      target: rcv?.playerId ?? undefined,
      rusher: type === 'run' || type === 'fumble' ? (carrier?.playerId ?? undefined) : undefined,
      returnYards: type === 'int' ? Math.round(this.rng() * 15) : undefined,
      scramble: this.scramble,
      realSeconds: this.t,
      text,
    }
  }

  names: Record<string, string> = {}
  private nameOf(e: Ent) {
    return e.playerId ? (this.names[e.playerId] ?? e.role) : e.role
  }

  get done() {
    return this.phase === 'dead' && this.deadT > 1.1
  }

  hint(): string | null {
    if (this.phase === 'presnap') return 'TAP / SPACE TO SNAP'
    if (this.canThrow) return 'DRAG TO AIM · RELEASE TO THROW · 1-4 QUICK THROW'
    if (this.phase === 'run' && this.t < 3) return 'STEER: ARROWS / HOLD FINGER · SHIFT SPRINT · SPACE JUKE'
    return null
  }

  scene(aim: { x: number; y: number } | null): Scene {
    const holder = this.holder
    const focus = this.flight ? { x: this.ball.x, y: this.ball.y } : holder ? this.get(holder) : this.get('off-QB')
    let aimData: Scene['aim'] = null
    if (aim && this.canThrow) {
      const q = this.get('off-QB')
      const d = len(aim.x - q.x, aim.y - q.y)
      aimData = { fromX: q.x + 10, fromY: q.y, toX: aim.x + 10, toY: aim.y, ok: d <= this.maxThrow() }
    }
    return {
      ents: this.ents.map((e) => ({
        x: e.x + 10,
        y: e.y,
        team: e.side === 'off' ? 'user' : 'opp',
        number: e.number,
        facing: e.side === 'off' ? 1 : -1,
        step: e.step,
        moving: len(e.vx, e.vy) > 0.4,
        carrier: e.id === holder,
        down: e.down,
        controlled: e.id === holder && (this.phase === 'run' || this.phase === 'pocket'),
      })),
      ball: this.phase === 'presnap' ? { x: this.los + 10, y: C, z: 0.5 } : { x: this.ball.x + 10, y: this.ball.y, z: this.ball.z },
      losX: this.los + 10,
      firstDownX: this.los + this.toGo < 100 ? this.los + this.toGo + 10 : null,
      focusX: focus.x + 10,
      focusY: focus.y,
      lookAhead: this.phase === 'pocket' || this.phase === 'presnap' ? 16 : 8,
      aim: aimData,
      popups: this.popups.map((p) => ({ ...p, x: p.x + 10 })),
      hint: this.hint(),
    }
  }
}

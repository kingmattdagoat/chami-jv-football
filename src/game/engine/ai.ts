import { clamp, defaultRng, gauss, type Rng } from '../rng'
import type { GameSlots } from '../lineup'
import { DEF_WEIGHTS, type DefCallId, type OppPlayType } from './plays'
import type { GameState, PlayOutcome } from './types'

type Mod = { yd: number; big: number; sack: number; comp: number; int: number }
const N: Mod = { yd: 0, big: 1, sack: 0, comp: 0, int: 1 }

/** How each defensive call fares against each kind of opponent play. */
const MATRIX: Record<DefCallId, Record<OppPlayType, Mod>> = {
  man: { run: { ...N, yd: 0.5 }, short: { ...N, comp: -0.06 }, deep: { ...N, comp: -0.04, int: 1.2 } },
  zone: { run: { ...N, yd: 1 }, short: { ...N, comp: -0.12, int: 1.4, yd: -1 }, deep: { ...N, comp: -0.05 } },
  blitz: { run: { ...N, yd: -1.5, big: 1.6 }, short: { ...N, sack: 0.14, comp: -0.02, yd: 1.5 }, deep: { ...N, sack: 0.2, comp: 0.1, big: 1.8 } },
  runstop: { run: { ...N, yd: -3, big: 0.4 }, short: { ...N, comp: 0.08, yd: 2 }, deep: { ...N, comp: 0.1, big: 1.6 } },
  prevent: { run: { ...N, yd: 2 }, short: { ...N, comp: 0.1, yd: 1 }, deep: { ...N, comp: -0.2, int: 1.8, big: 0.3 } },
}

const STRATEGY: Record<GameState['defStrategy'], Mod> = {
  aggressive: { yd: 0.3, big: 1.25, sack: 0.04, comp: 0, int: 1.3 },
  balanced: N,
  conservative: { yd: 0.6, big: 0.7, sack: -0.02, comp: 0.03, int: 0.8 },
}

export function chooseOppPlay(s: GameState, rng: Rng = defaultRng): OppPlayType {
  let run = 0.45
  let deep = 0.2
  if (s.toGo <= 3) run = 0.62
  if (s.toGo >= 8 && s.down >= 2) {
    run = 0.25
    deep = 0.32
  }
  if (s.quarter >= 4 && s.score.opp < s.score.user) {
    run = 0.25
    deep = 0.35
  }
  const r = rng()
  return r < run ? 'run' : r < run + deep ? 'deep' : 'short'
}

/** Suggest a defensive call when the user wants the computer to choose. */
export function suggestDefCall(s: GameState, rng: Rng = defaultRng): DefCallId {
  if (s.toGo <= 2) return 'runstop'
  if (s.toGo >= 10 && s.down >= 3) return rng() < 0.5 ? 'zone' : 'prevent'
  const r = rng()
  return r < 0.4 ? 'man' : r < 0.7 ? 'zone' : r < 0.85 ? 'blitz' : 'runstop'
}

function pickDefender(s: GameState, kind: keyof typeof DEF_WEIGHTS, rng: Rng): GameSlots {
  const w = DEF_WEIGHTS[kind].map(([slot, n]) => [slot, n * (s.userTeam.players[slot].attrs.awareness / 75)] as const)
  const total = w.reduce((a, [, n]) => a + n, 0)
  let r = rng() * total
  for (const [slot, n] of w) {
    if (r < n) return slot
    r -= n
  }
  return w[0][0]
}

export interface DefAnim {
  play: OppPlayType
  type: PlayOutcome['type']
  yards: number
  catchDepth: number
  laneY: number
  defender: GameSlots
}

/** Resolve one opponent offensive snap from ratings + the user's defensive call. */
export function simulateOppPlay(s: GameState, call: DefCallId, rng: Rng = defaultRng): { outcome: PlayOutcome; anim: DefAnim } {
  const play = chooseOppPlay(s, rng)
  const m = MATRIX[call][play]
  const st = STRATEGY[s.defStrategy]
  const R = s.userTeam.ratings
  const off = s.opp.off
  const toGoal = 100 - s.ballOn
  const opp = s.opp.abbr
  const pl = s.userTeam.players
  const nm = (slot: GameSlots) => `${pl[slot].number != null ? `#${pl[slot].number} ` : ''}${pl[slot].name}`
  let type: PlayOutcome['type'] = 'run'
  let yards = 0
  let text = ''
  let defender: GameSlots = 'LB1'
  let catchDepth = 0
  const laneY = clamp(26.67 + gauss(rng) * 10, 4, 49)

  if (play === 'run') {
    const d = (off - R.runStop) / 10
    yards = 3.4 + d * 1.3 + m.yd + st.yd + gauss(rng) * 3
    if (rng() < clamp((0.05 + d * 0.02) * m.big * st.big, 0.01, 0.25)) yards += 10 + rng() * 45
    yards = Math.round(clamp(yards, -5, toGoal))
    defender = pickDefender(s, 'run', rng)
    if (rng() < 0.014 + (R.runStop - 75) * 0.0004) {
      type = 'fumble'
      text = `${opp} runs for ${yards}… FUMBLE forced by ${nm(defender)}! Chaminade recovers!`
    } else {
      text = yards >= toGoal ? `${opp} breaks loose for a ${yards}-yard touchdown run!` : `${opp} runs for ${yards} yard${Math.abs(yards) === 1 ? '' : 's'}. Tackle by ${nm(defender)}.`
    }
  } else {
    const d = (off - R.coverage) / 10
    const rush = (R.passRush - off) / 10
    const deep = play === 'deep'
    const sackP = clamp((deep ? 0.08 : 0.05) + rush * 0.02 + m.sack + st.sack, 0.01, 0.45)
    const compP = clamp((deep ? 0.4 : 0.66) + d * 0.06 + m.comp + st.comp, 0.1, 0.9)
    const intP = clamp(((deep ? 0.055 : 0.025) - d * 0.01) * m.int * st.int, 0.005, 0.2)
    const r = rng()
    if (r < sackP) {
      type = 'sack'
      defender = pickDefender(s, 'sack', rng)
      yards = -Math.round(3 + rng() * 6)
      text = `SACK! ${nm(defender)} drops the ${opp} QB for a loss of ${-yards}.`
    } else if (r < sackP + intP) {
      type = 'int'
      defender = pickDefender(s, 'int', rng)
      catchDepth = deep ? 18 + rng() * 15 : 5 + rng() * 6
      yards = Math.round(Math.min(catchDepth, toGoal - 1))
      text = `INTERCEPTED by ${nm(defender)}! Chaminade takes over!`
    } else if (r < sackP + intP + compP) {
      type = 'pass'
      defender = pickDefender(s, 'pass', rng)
      catchDepth = deep ? 16 + rng() * 22 : 4 + rng() * 6 + m.yd
      let yac = Math.max(0, gauss(rng) * 3 + 2)
      if (rng() < clamp((deep ? 0.12 : 0.06) * m.big * st.big + d * 0.02, 0.01, 0.35)) yac += 10 + rng() * 30
      yards = Math.round(clamp(catchDepth + yac + st.yd, -2, toGoal))
      catchDepth = Math.min(catchDepth, yards)
      text = yards >= toGoal ? `${opp} connects for a ${yards}-yard touchdown pass!` : `${opp} completes a pass for ${yards} yards. ${nm(defender)} makes the stop.`
    } else {
      type = 'incomplete'
      defender = pickDefender(s, 'pass', rng)
      catchDepth = deep ? 18 + rng() * 15 : 5 + rng() * 6
      yards = 0
      text = `${opp} pass falls incomplete — broken up by ${nm(defender)}.`
    }
  }

  const outcome: PlayOutcome = {
    type,
    yards,
    tackler: pl[defender].playerId,
    sacker: type === 'sack' ? pl[defender].playerId : undefined,
    interceptor: type === 'int' ? pl[defender].playerId : undefined,
    returnYards: type === 'int' ? Math.round(rng() * 18) : undefined,
    outOfBounds: rng() < 0.15,
    realSeconds: 5,
    text,
  }
  return { outcome, anim: { play, type, yards, catchDepth, laneY, defender } }
}

export type FourthDown = 'go' | 'fg' | 'punt'

export function oppFourthDown(s: GameState, rng: Rng = defaultRng): FourthDown {
  const toGoal = 100 - s.ballOn
  const trailing = s.score.opp < s.score.user
  const late = s.quarter >= 4 && s.clock < 120
  if (s.ot) {
    if (toGoal <= 30 && !(trailing && s.score.user - s.score.opp > 3)) return 'fg'
    return 'go'
  }
  if (late && trailing && s.score.user - s.score.opp > 3) return 'go'
  if (toGoal <= 28) return s.toGo <= 1 && rng() < 0.4 ? 'go' : 'fg'
  if (s.toGo <= 2 && s.ballOn >= 45 && rng() < 0.55) return 'go'
  return 'punt'
}

export function oppFieldGoalMade(s: GameState, rng: Rng = defaultRng) {
  const dist = 100 - s.ballOn + 17
  const p = clamp(0.98 - (dist - 20) * 0.018 + (s.opp.off - 75) * 0.004, 0.05, 0.97)
  return rng() < p
}

export function oppGoesForTwo(s: GameState) {
  const diff = s.score.user - s.score.opp
  return s.quarter >= 4 && (diff === 2 || diff === 5 || diff === -1)
}

export function kickerProfile(s: GameState) {
  const k = s.userTeam.players.K.attrs
  return { power: k.kickPow, accuracy: k.kickAcc, maxRange: Math.round(28 + k.kickPow * 0.28) }
}

/** Kick meter parameters: sweet-spot width shrinks with distance, grows with accuracy. */
export function kickMeter(s: GameState, distance: number) {
  const { accuracy, maxRange } = kickerProfile(s)
  const over = Math.max(0, distance - maxRange)
  const width = clamp(26 + (accuracy - 70) * 0.5 - (distance - 20) * 0.45 - over * 3, 3, 40)
  const speed = clamp(0.9 + (distance - 20) * 0.025, 0.9, 2.4)
  return { width, speed, maxRange }
}

export function puntDistance(power: number, rng: Rng = defaultRng) {
  return clamp(30 + power * 0.13 + gauss(rng) * 5, 22, 60)
}

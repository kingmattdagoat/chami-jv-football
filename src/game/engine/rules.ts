import type { GameTeam } from '../lineup'
import { clamp, defaultRng, type Rng } from '../rng'
import type { DefStrategy, Formation, OffStrategy, StatLine } from '../types'
import type { GameState, OppInfo, PlayOutcome, Side, TeamGameStats } from './types'

export const other = (s: Side): Side => (s === 'user' ? 'opp' : 'user')

export function emptyTeamStats(): TeamGameStats {
  return { passAtt: 0, passComp: 0, passYds: 0, passTD: 0, ints: 0, rushAtt: 0, rushYds: 0, rushTD: 0, sacked: 0, firstDowns: 0, turnovers: 0, fgMade: 0, fgAtt: 0, tds: 0, plays: 0 }
}

export function emptyLine(): StatLine {
  return { gp: 0, passAtt: 0, passComp: 0, passYds: 0, passTD: 0, intThrown: 0, rushAtt: 0, rushYds: 0, rushTD: 0, rec: 0, recYds: 0, recTD: 0, tackles: 0, sacks: 0, defInt: 0 }
}

export interface NewGameParams {
  id: string
  fixtureId: string | null
  stage: GameState['stage']
  home: boolean
  quarterMinutes: number
  userTeam: GameTeam
  opp: OppInfo
  formation: Formation
  offStrategy: OffStrategy
  defStrategy: DefStrategy
}

export function newGame(p: NewGameParams, rng: Rng = defaultRng): GameState {
  const receiver: Side = rng() < 0.5 ? 'user' : 'opp'
  const s: GameState = {
    id: p.id,
    fixtureId: p.fixtureId,
    stage: p.stage,
    home: p.home,
    quarterSeconds: p.quarterMinutes * 60,
    quarter: 1,
    clock: p.quarterMinutes * 60,
    score: { user: 0, opp: 0 },
    possession: receiver,
    ballOn: 25,
    down: 1,
    toGo: 10,
    phase: 'coin',
    firstHalfReceiver: receiver,
    ot: null,
    pat2: false,
    kickMode: null,
    log: [],
    team: { user: emptyTeamStats(), opp: emptyTeamStats() },
    players: {},
    userTeam: p.userTeam,
    opp: p.opp,
    formation: p.formation,
    offStrategy: p.offStrategy,
    defStrategy: p.defStrategy,
    banner: null,
    createdAt: Date.now(),
  }
  log(s, `${receiver === 'user' ? 'Chaminade' : p.opp.name} wins the toss and will receive.`, 'info', receiver)
  return s
}

export function teamName(s: GameState, side: Side) {
  return side === 'user' ? 'Chaminade' : s.opp.name
}

export function log(s: GameState, text: string, kind: GameState['log'][number]['kind'] = 'play', side: Side = s.possession) {
  s.log.unshift({ q: s.quarter, clock: s.clock, text, kind, side })
  if (s.log.length > 120) s.log.length = 120
}

function banner(s: GameState, text: string, kind: NonNullable<GameState['banner']>['kind']) {
  s.banner = { text, kind, n: (s.banner?.n ?? 0) + 1 }
}

export function fmtClock(sec: number) {
  const t = Math.max(0, Math.ceil(sec))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

export function spotText(ballOn: number) {
  const b = Math.round(ballOn)
  if (b === 50) return 'midfield'
  return b < 50 ? `own ${b}` : `opp ${100 - b}`
}

export function downText(s: GameState) {
  const ord = ['1st', '2nd', '3rd', '4th'][s.down - 1] ?? '4th'
  const toGo = s.ballOn + s.toGo >= 100 ? 'Goal' : String(Math.max(1, Math.round(s.toGo)))
  return `${ord} & ${toGo}`
}

function line(s: GameState, id: string | undefined): StatLine | null {
  if (!id) return null
  if (!s.players[id]) s.players[id] = emptyLine()
  return s.players[id]
}

/** Start a possession after a kickoff (or the next OT possession). */
export function kickoff(s: GameState, receiver: Side, rng: Rng = defaultRng, freeKick = false) {
  if (s.ot) return otNext(s)
  s.possession = receiver
  const r = rng()
  s.ballOn = freeKick ? 30 + Math.round(rng() * 10) : r < 0.55 ? 25 : clamp(Math.round(18 + rng() * 20), 10, 45)
  if (r > 0.985 && !freeKick) s.ballOn = 100 // rare kick return TD
  s.down = 1
  s.toGo = 10
  if (s.ballOn >= 100) {
    log(s, `${teamName(s, receiver)} takes the kickoff all the way back! TOUCHDOWN!`, 'score', receiver)
    scoreTD(s, receiver)
    return
  }
  log(s, `${teamName(s, receiver)} ${freeKick ? 'fields the free kick' : 'receives the kickoff'} — ball on the ${spotText(s.ballOn)}.`, 'info', receiver)
  startDrivePhase(s)
}

function startDrivePhase(s: GameState) {
  s.phase = s.possession === 'user' ? 'playcall' : 'defcall'
}

function scoreTD(s: GameState, side: Side) {
  s.score[side] += 6
  s.team[side].tds++
  s.possession = side
  s.ballOn = 97
  s.down = 1
  s.toGo = 3
  banner(s, 'TOUCHDOWN!', side === 'user' ? 'td' : 'bad')
  s.phase = 'pat'
}

/** Hand the ball to the other team at `ballOn` (from the new offense's perspective). */
function turnover(s: GameState, newOff: Side, ballOn: number) {
  if (s.ot) return otNext(s)
  s.possession = newOff
  s.ballOn = clamp(Math.round(ballOn), 1, 99)
  s.down = 1
  s.toGo = Math.min(10, 100 - s.ballOn)
  startDrivePhase(s)
}

function runoff(s: GameState, o: PlayOutcome, off: Side) {
  if (s.ot) return
  const stopped = o.type === 'incomplete' || o.outOfBounds || o.type === 'int' || o.type === 'fumble'
  let base = stopped ? 7 : 26
  if (!stopped && off === 'user') base = s.offStrategy === 'hurry' ? 14 : s.offStrategy === 'control' ? 36 : 26
  if (!stopped && off === 'opp' && s.quarter >= 4 && s.score.opp > s.score.user) base = 36
  s.clock = Math.max(0, s.clock - base - Math.min(12, o.realSeconds))
}

/** Apply the result of a scrimmage play for whichever team has the ball. */
export function applyPlay(s: GameState, o: PlayOutcome) {
  const off = s.possession
  const def = other(off)
  const ts = s.team[off]
  const los = s.ballOn
  const userOff = off === 'user'
  const yards = Math.round(o.yards)

  if (s.pat2) {
    s.pat2 = false
    const good = (o.type === 'run' || o.type === 'pass') && los + yards >= 100
    if (good) {
      s.score[off] += 2
      banner(s, '2-POINT GOOD!', off === 'user' ? 'td' : 'bad')
    } else banner(s, 'NO GOOD', off === 'user' ? 'bad' : 'info')
    log(s, `Two-point try ${good ? 'is GOOD' : 'fails'}. ${o.text}`, 'score', off)
    kickoff(s, def)
    return
  }

  ts.plays++
  const passer = userOff ? line(s, o.passer) : null
  const target = userOff ? line(s, o.target) : null
  const rusher = userOff ? line(s, o.rusher) : null
  const tackler = !userOff ? line(s, o.tackler) : null
  if (tackler && (o.type === 'run' || o.type === 'pass')) tackler.tackles++

  if (o.type === 'pass' || o.type === 'incomplete' || o.type === 'int') {
    ts.passAtt++
    if (passer) passer.passAtt++
  }
  if (o.type === 'pass') {
    ts.passComp++
    ts.passYds += yards
    if (passer) {
      passer.passComp++
      passer.passYds += yards
    }
    if (target) {
      target.rec++
      target.recYds += yards
    }
  }
  if (o.type === 'run') {
    ts.rushAtt++
    ts.rushYds += yards
    if (rusher) {
      rusher.rushAtt++
      rusher.rushYds += yards
    }
  }
  if (o.type === 'sack') {
    ts.sacked++
    if (!userOff) {
      const sk = line(s, o.sacker)
      if (sk) {
        sk.sacks++
        sk.tackles++
      }
    }
  }

  log(s, o.text, o.type === 'int' || o.type === 'fumble' ? 'turnover' : 'play', off)
  runoff(s, o, off)

  if (o.type === 'int') {
    ts.ints++
    ts.turnovers++
    if (passer) passer.intThrown++
    if (!userOff) {
      const it = line(s, o.interceptor)
      if (it) it.defInt++
    }
    banner(s, 'INTERCEPTED!', userOff ? 'bad' : 'turnover')
    const spot = 100 - (los + yards) + (o.returnYards ?? 0)
    if (spot >= 100) {
      log(s, `Pick-six! ${teamName(s, def)} returns it for a touchdown!`, 'score', def)
      s.team[def].tds++
      scoreTD(s, def)
      return
    }
    turnover(s, def, spot)
    return checkClock(s)
  }
  if (o.type === 'fumble') {
    ts.turnovers++
    banner(s, 'FUMBLE!', userOff ? 'bad' : 'turnover')
    turnover(s, def, 100 - (los + yards))
    return checkClock(s)
  }

  const spot = los + yards
  if (spot >= 100 && (o.type === 'run' || o.type === 'pass')) {
    if (o.type === 'run') {
      ts.rushTD++
      if (rusher) rusher.rushTD++
    } else {
      ts.passTD++
      if (passer) passer.passTD++
      if (target) target.recTD++
    }
    scoreTD(s, off)
    return
  }
  if (spot <= 0) {
    s.score[def] += 2
    banner(s, 'SAFETY!', userOff ? 'bad' : 'turnover')
    log(s, `SAFETY! ${teamName(s, def)} gets 2 points.`, 'score', def)
    kickoff(s, def, defaultRng, true)
    return checkClock(s)
  }
  s.ballOn = spot
  if (yards >= s.toGo) {
    ts.firstDowns++
    s.down = 1
    s.toGo = Math.min(10, 100 - spot)
    if (yards >= 1) banner(s, 'FIRST DOWN', userOff ? 'first' : 'info')
  } else {
    s.down++
    s.toGo -= yards
    if (s.down > 4) {
      log(s, `Turnover on downs!`, 'turnover', off)
      banner(s, 'TURNOVER ON DOWNS', userOff ? 'bad' : 'turnover')
      turnover(s, def, 100 - spot)
      return checkClock(s)
    }
  }
  startDrivePhase(s)
  checkClock(s)
}

export function fgDistance(s: GameState) {
  return Math.round(100 - s.ballOn + 17)
}

export function applyFieldGoal(s: GameState, made: boolean) {
  const off = s.possession
  const def = other(off)
  const dist = fgDistance(s)
  s.team[off].fgAtt++
  if (!s.ot) s.clock = Math.max(0, s.clock - 6)
  if (made) {
    s.score[off] += 3
    s.team[off].fgMade++
    banner(s, 'FIELD GOAL!', off === 'user' ? 'td' : 'bad')
    log(s, `${dist}-yard field goal is GOOD for ${teamName(s, off)}.`, 'score', off)
    kickoff(s, def)
  } else {
    banner(s, 'NO GOOD!', off === 'user' ? 'bad' : 'turnover')
    log(s, `${dist}-yard field goal attempt by ${teamName(s, off)} is no good.`, 'play', off)
    turnover(s, def, Math.max(20, 100 - (s.ballOn - 7)))
  }
  checkClock(s)
}

export function applyPunt(s: GameState, distance: number) {
  const off = s.possession
  const def = other(off)
  const land = s.ballOn + Math.round(distance)
  if (!s.ot) s.clock = Math.max(0, s.clock - 10)
  if (land >= 100) {
    log(s, `${teamName(s, off)} punts into the end zone. Touchback.`, 'play', off)
    turnover(s, def, 20)
  } else {
    log(s, `${teamName(s, off)} punts ${Math.round(distance)} yards. ${teamName(s, def)} takes over on the ${spotText(100 - land)}.`, 'play', off)
    turnover(s, def, 100 - land)
  }
  checkClock(s)
}

export function applyExtraPoint(s: GameState, made: boolean) {
  const off = s.possession
  if (made) s.score[off] += 1
  log(s, `Extra point is ${made ? 'GOOD' : 'NO GOOD'}.`, 'score', off)
  if (!made) banner(s, 'XP MISSED', off === 'user' ? 'bad' : 'info')
  kickoff(s, other(off))
  checkClock(s)
}

export function startTwoPoint(s: GameState) {
  s.pat2 = true
  s.ballOn = 97
  s.down = 1
  s.toGo = 3
  log(s, `${teamName(s, s.possession)} is going for two!`, 'info')
  s.phase = s.possession === 'user' ? 'playcall' : 'defcall'
}

function checkClock(s: GameState) {
  if (s.ot || s.phase === 'pat' || s.phase === 'final') return
  if (s.clock > 0) return
  endQuarter(s)
}

export function endQuarter(s: GameState) {
  if (s.quarter === 1 || s.quarter === 3) {
    log(s, `End of the ${s.quarter === 1 ? '1st' : '3rd'} quarter.`, 'info')
    s.quarter++
    s.clock = s.quarterSeconds
    return
  }
  if (s.quarter === 2) {
    log(s, `HALFTIME — Chaminade ${s.score.user}, ${s.opp.name} ${s.score.opp}.`, 'info')
    s.quarter = 3
    s.clock = s.quarterSeconds
    s.phase = 'halftime'
    return
  }
  if (s.score.user === s.score.opp) {
    log(s, `Tied at the end of regulation — OVERTIME!`, 'info')
    banner(s, 'OVERTIME!', 'info')
    const first: Side = Math.random() < 0.5 ? 'user' : 'opp'
    s.quarter = 5
    s.clock = 0
    s.ot = { round: 1, order: [first, other(first)], had: [], current: first }
    startOtPossession(s, first)
    return
  }
  finish(s)
}

function startOtPossession(s: GameState, side: Side) {
  s.ot!.current = side
  s.possession = side
  s.ballOn = 75
  s.down = 1
  s.toGo = 10
  log(s, `OT round ${s.ot!.round}: ${teamName(s, side)} ball at the opponent 25.`, 'info', side)
  startDrivePhase(s)
}

function otNext(s: GameState) {
  const ot = s.ot!
  if (!ot.had.includes(ot.current)) ot.had.push(ot.current)
  if (ot.had.length >= 2) {
    if (s.score.user !== s.score.opp) return finish(s)
    ot.round++
    ot.order = [ot.order[1], ot.order[0]]
    ot.had = []
    return startOtPossession(s, ot.order[0])
  }
  startOtPossession(s, ot.order.find((x) => !ot.had.includes(x))!)
}

function finish(s: GameState) {
  s.phase = 'final'
  s.clock = 0
  const win = s.score.user > s.score.opp
  log(s, `FINAL: Chaminade ${s.score.user}, ${s.opp.name} ${s.score.opp}.`, 'info', win ? 'user' : 'opp')
  banner(s, win ? 'VICTORY!' : 'FINAL', win ? 'td' : 'bad')
}

export function continueAfterHalftime(s: GameState) {
  kickoff(s, other(s.firstHalfReceiver))
}

export function startGameAfterToss(s: GameState) {
  kickoff(s, s.firstHalfReceiver)
}

import { evaluateAchievements } from './achievements'
import { dailyChallenges, todayKey } from './challenges'
import { REWARDS, earn } from './economy'
import { emptyLine } from './engine/rules'
import type { GameState, TeamGameStats } from './engine/types'
import { PLAYER_SLOTS, findCard, resolveTeam } from './lineup'
import { USER_TEAM, createSeason, progressSeason, simScore, standings, userRecord } from './season'
import type { SaveData, StatLine } from './types'

export interface RewardLine {
  label: string
  coins: number
}

export interface GameSummary {
  gameId: string
  fixtureId: string | null
  stage: GameState['stage']
  userScore: number
  oppScore: number
  simulated: boolean
  team: TeamGameStats
  players: Record<string, StatLine>
  starters: string[]
}

function addLine(into: Record<string, StatLine>, id: string, l: StatLine) {
  const cur = into[id] ?? emptyLine()
  for (const k of Object.keys(l) as (keyof StatLine)[]) cur[k] += l[k]
  into[id] = cur
}

export function summaryFromGame(s: GameState): GameSummary {
  return {
    gameId: s.id,
    fixtureId: s.fixtureId,
    stage: s.stage,
    userScore: s.score.user,
    oppScore: s.score.opp,
    simulated: false,
    team: s.team.user,
    players: s.players,
    starters: Object.values(s.userTeam.players).map((p) => p.playerId),
  }
}

/**
 * Settle a finished game exactly once: coins, stats, fitness, season standings,
 * challenges, objectives and achievements. Returns the reward breakdown.
 */
export function settleGame(draft: SaveData, g: GameSummary): RewardLine[] | null {
  const key = `game:${g.gameId}`
  if (draft.claimed[key]) return null
  draft.claimed[key] = Date.now()
  const lines: RewardLine[] = []
  const pay = (coins: number, label: string, k?: string) => {
    if (earn(draft, coins, label, k)) lines.push({ label, coins })
  }
  const win = g.userScore > g.oppScore
  const season = g.fixtureId != null
  const exhibition = !season

  if (g.simulated) pay(REWARDS.simComplete, 'Quick-sim game completed')
  else if (exhibition) pay(REWARDS.exhibitionComplete, 'Exhibition completed')
  else pay(REWARDS.complete, 'Game completed')
  if (win && !g.simulated) pay(exhibition ? REWARDS.exhibitionWin : REWARDS.win, 'Victory bonus')
  if (!g.simulated && g.team.tds > 0) {
    const n = Math.min(REWARDS.maxTdBonus, g.team.tds)
    pay(n * REWARDS.touchdown, `${n} touchdown${n > 1 ? 's' : ''}`)
  }
  if (win && g.stage === 'semi') pay(REWARDS.playoffWin, 'Playoff semifinal win')
  if (win && g.stage === 'final') pay(REWARDS.championship, 'LEAGUE CHAMPIONS!', `champ:${g.fixtureId}`)

  // Career
  const c = draft.career
  c.gamesPlayed++
  c.pointsFor += g.userScore
  c.pointsAgainst += g.oppScore
  c.touchdowns += g.team.tds
  if (win) {
    c.wins++
    c.winStreak++
    c.bestStreak = Math.max(c.bestStreak, c.winStreak)
    if (g.oppScore === 0) c.shutouts++
    if (g.stage === 'final') c.championships++
  } else {
    c.losses++
    c.winStreak = 0
  }

  // Player stats & fitness
  for (const id of g.starters) {
    addLine(draft.careerStats, id, { ...emptyLine(), gp: 1 })
    if (season) addLine(draft.seasonStats, id, { ...emptyLine(), gp: 1 })
  }
  for (const [id, l] of Object.entries(g.players)) {
    addLine(draft.careerStats, id, l)
    if (season) addLine(draft.seasonStats, id, l)
  }
  const starterSet = new Set(g.starters)
  for (const u of draft.roster) {
    const pid = findCard(draft, u)?.playerId
    if (!pid) continue
    const f = draft.fitness[pid] ?? 100
    draft.fitness[pid] = starterSet.has(pid) ? Math.max(40, f - 10) : Math.min(100, f + 25)
  }

  // Season
  if (season) {
    const f = draft.season.fixtures.find((x) => x.id === g.fixtureId)
    if (f && !f.result) {
      const home = f.home === USER_TEAM
      f.result = { home: home ? g.userScore : g.oppScore, away: home ? g.oppScore : g.userScore, simulated: g.simulated }
    }
    progressSeason(draft, resolveTeam(draft, false).ratings.overall)
    seasonObjectives(draft).forEach((o) => {
      if (o.done) pay(o.reward, `Season goal: ${o.name}`, o.key)
    })
    finalizeSeason(draft)
  }

  // Daily practice challenges (played games only)
  if (!g.simulated) {
    const date = todayKey()
    if (draft.daily.date !== date) draft.daily = { date, done: [] }
    const ctx = { win, userScore: g.userScore, oppScore: g.oppScore, team: g.team, players: g.players }
    for (const ch of dailyChallenges(date)) {
      if (draft.daily.done.includes(ch.id) || !ch.check(ctx)) continue
      draft.daily.done.push(ch.id)
      pay(ch.reward, `Daily challenge: ${ch.name}`, `daily:${date}:${ch.id}`)
    }
  }

  for (const a of evaluateAchievements(draft)) lines.push({ label: `Achievement: ${a.name}`, coins: a.reward })
  draft.activeGame = null
  return lines
}

export function seasonObjectives(save: SaveData) {
  const s = save.season
  const rec = userRecord(s)
  const tds = Object.values(save.seasonStats).reduce((n, l) => n + l.rushTD + l.recTD, 0)
  const inPlayoffs = s.fixtures.some((f) => f.stage === 'semi' && (f.home === USER_TEAM || f.away === USER_TEAM))
  const regLosses = s.fixtures.filter((f) => f.stage === 'regular' && f.result && (f.home === USER_TEAM ? f.result.home < f.result.away : f.away === USER_TEAM && f.result.away < f.result.home)).length
  const regDone = s.phase !== 'regular'
  const objs = [
    { id: 'wins4', name: 'Win 4 games', reward: 1000, progress: `${Math.min(rec.w, 4)}/4`, done: rec.w >= 4 },
    { id: 'tds20', name: 'Score 20 offensive TDs', reward: 1000, progress: `${Math.min(tds, 20)}/20`, done: tds >= 20 },
    { id: 'playoffs', name: 'Make the playoffs', reward: 1500, progress: inPlayoffs ? 'Qualified' : regDone ? 'Missed' : 'In progress', done: inPlayoffs },
    { id: 'unbeaten', name: 'Go unbeaten in the regular season', reward: 3000, progress: regLosses ? 'Lost a game' : regDone ? 'Perfect!' : 'Alive', done: regDone && regLosses === 0 },
  ]
  return objs.map((o) => ({ ...o, key: `obj:s${s.number}:${o.id}`, claimed: Boolean(save.claimed[`obj:s${s.number}:${o.id}`]) }))
}

function finalizeSeason(draft: SaveData) {
  const s = draft.season
  const key = `season-done:${s.number}`
  if (s.phase !== 'complete' || draft.claimed[key]) return
  draft.claimed[key] = Date.now()
  const rec = userRecord(s)
  const st = standings(s)
  const userRows = st.find((r) => r.team === USER_TEAM)!
  draft.seasonHistory.unshift({
    number: s.number,
    year: s.year,
    wins: rec.w,
    losses: rec.l,
    pointsFor: userRows.pf,
    pointsAgainst: userRows.pa,
    rank: st.findIndex((r) => r.team === USER_TEAM) + 1,
    champion: s.champion === USER_TEAM,
    championName: s.champion ?? '',
    awards: s.awards,
  })
}

/** Quick-sim the user's next fixture from ratings (reduced coins, never automatic). */
export function quickSim(draft: SaveData, fixtureId: string): RewardLine[] | null {
  const f = draft.season.fixtures.find((x) => x.id === fixtureId)
  if (!f || f.result) return null
  const ovr = resolveTeam(draft).ratings.overall
  const r = simScore(f.home, f.away, ovr)
  const home = f.home === USER_TEAM
  const us = home ? r.home : r.away
  const them = home ? r.away : r.home
  const tds = Math.floor(us / 7)
  return settleGame(draft, {
    gameId: `sim-${f.id}`,
    fixtureId: f.id,
    stage: f.stage,
    userScore: us,
    oppScore: them,
    simulated: true,
    team: { passAtt: 0, passComp: 0, passYds: 0, passTD: 0, ints: 0, rushAtt: 0, rushYds: 0, rushTD: 0, sacked: 0, firstDowns: 0, turnovers: 0, fgMade: 0, fgAtt: 0, tds, plays: 0 },
    players: {},
    starters: PLAYER_SLOTS.map((s) => findCard(draft, draft.lineup[s.id])?.playerId).filter(Boolean) as string[],
  })
}

export function startNewSeason(draft: SaveData): boolean {
  if (draft.season.phase !== 'complete') return false
  draft.season = createSeason(draft.season.number + 1, draft.season.year + 1)
  draft.seasonStats = {}
  draft.fitness = {}
  draft.activeGame = null
  return true
}

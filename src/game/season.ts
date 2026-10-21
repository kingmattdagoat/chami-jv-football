import { getPlayer } from './data/roster'
import { CHAMINADE, LEAGUE_IDS, getTeam } from './data/teams'
import { clamp, defaultRng, gauss, type Rng } from './rng'
import type { Fixture, SaveData, SeasonAwards, SeasonState, StatLine } from './types'

export const USER_TEAM = CHAMINADE.id

/** Round-robin schedule (circle method) — every league team plays each other once. */
export function createSeason(number: number, year: number): SeasonState {
  const teams = [...LEAGUE_IDS]
  const n = teams.length
  const fixtures: Fixture[] = []
  const rot = teams.slice(1)
  for (let w = 0; w < n - 1; w++) {
    const round = [teams[0], ...rot]
    for (let i = 0; i < n / 2; i++) {
      const a = round[i]
      const b = round[n - 1 - i]
      const swap = (w + i) % 2 === 1
      const home = swap ? b : a
      const away = swap ? a : b
      fixtures.push({ id: `s${number}-w${w + 1}-${home}-${away}`, week: w + 1, home, away, stage: 'regular' })
    }
    rot.unshift(rot.pop()!)
  }
  return { number, year, teams, fixtures, phase: 'regular' }
}

export function userFixtures(season: SeasonState) {
  return season.fixtures.filter((f) => f.home === USER_TEAM || f.away === USER_TEAM)
}

export function nextUserFixture(season: SeasonState): Fixture | undefined {
  return userFixtures(season)
    .filter((f) => !f.result)
    .sort((a, b) => a.week - b.week)[0]
}

export interface StandingRow {
  team: string
  w: number
  l: number
  pf: number
  pa: number
}

export function standings(season: SeasonState): StandingRow[] {
  const rows = new Map<string, StandingRow>(season.teams.map((t) => [t, { team: t, w: 0, l: 0, pf: 0, pa: 0 }]))
  for (const f of season.fixtures) {
    if (f.stage !== 'regular' || !f.result) continue
    const h = rows.get(f.home)!
    const a = rows.get(f.away)!
    h.pf += f.result.home
    h.pa += f.result.away
    a.pf += f.result.away
    a.pa += f.result.home
    if (f.result.home > f.result.away) {
      h.w++
      a.l++
    } else {
      a.w++
      h.l++
    }
  }
  return [...rows.values()].sort((x, y) => y.w - x.w || y.pf - y.pa - (x.pf - x.pa) || y.pf - x.pf)
}

function footballScore(expected: number, rng: Rng) {
  const pts = clamp(Math.round(expected + gauss(rng) * 9), 0, 63)
  const tds = Math.floor(pts / 7)
  const fgs = Math.round((pts - tds * 7) / 3)
  return tds * 7 + fgs * 3
}

export function teamStrength(id: string, userOverall: number) {
  if (id === USER_TEAM) return { off: userOverall, def: userOverall }
  const t = getTeam(id)
  return { off: t.offense, def: t.defense }
}

/** Quick simulation of a single game from team ratings. */
export function simScore(home: string, away: string, userOverall: number, rng: Rng = defaultRng) {
  const h = teamStrength(home, userOverall)
  const a = teamStrength(away, userOverall)
  let hs = footballScore(21 + (h.off - a.def) * 0.9 + 1.5, rng)
  let as = footballScore(21 + (a.off - h.def) * 0.9, rng)
  if (hs === as) {
    if (rng() < 0.5 + (h.off - a.off) * 0.02) hs += 3
    else as += 3
  }
  return { home: hs, away: as }
}

function winner(f: Fixture) {
  if (!f.result) return null
  return f.result.home > f.result.away ? f.home : f.away
}

/**
 * Advance the league as far as possible without playing the user's next game:
 * simulate other matchups in completed weeks, seed playoffs, crown a champion.
 */
export function progressSeason(draft: SaveData, userOverall: number, rng: Rng = defaultRng) {
  const s = draft.season
  for (let guard = 0; guard < 20; guard++) {
    const next = nextUserFixture(s)
    const openWeeks = s.fixtures.filter((f) => !f.result).map((f) => f.week)
    if (openWeeks.length === 0) {
      if (!advanceStage(s)) break
      continue
    }
    const week = Math.min(...openWeeks)
    if (next && next.week === week) {
      // Sim everything else in this week only once the user's game is done.
      break
    }
    for (const f of s.fixtures) {
      if (f.week === week && !f.result) f.result = { ...simScore(f.home, f.away, userOverall, rng), simulated: true }
    }
  }
  if (s.phase === 'complete' && !s.awards) {
    s.awards = computeAwards(draft.seasonStats)
  }
}

function advanceStage(s: SeasonState): boolean {
  if (s.phase === 'regular') {
    const top = standings(s).slice(0, 4).map((r) => r.team)
    const wk = Math.max(...s.fixtures.map((f) => f.week)) + 1
    s.fixtures.push(
      { id: `s${s.number}-semi1`, week: wk, home: top[0], away: top[3], stage: 'semi' },
      { id: `s${s.number}-semi2`, week: wk, home: top[1], away: top[2], stage: 'semi' },
    )
    s.phase = 'playoffs'
    return true
  }
  if (s.phase === 'playoffs') {
    const final = s.fixtures.find((f) => f.stage === 'final')
    if (!final) {
      const semis = s.fixtures.filter((f) => f.stage === 'semi')
      const wk = semis[0].week + 1
      s.fixtures.push({ id: `s${s.number}-final`, week: wk, home: winner(semis[0])!, away: winner(semis[1])!, stage: 'final' })
      return true
    }
    s.champion = winner(final)!
    s.phase = 'complete'
    return false
  }
  return false
}

function score(l: StatLine, mode: 'all' | 'off' | 'def') {
  const off = l.passYds * 0.04 + l.rushYds * 0.1 + l.recYds * 0.1 + (l.passTD + l.rushTD + l.recTD) * 6 - l.intThrown * 3
  const def = l.tackles * 1 + l.sacks * 4 + l.defInt * 6
  return mode === 'off' ? off : mode === 'def' ? def : off + def
}

function statLineText(l: StatLine) {
  const parts: string[] = []
  if (l.passYds) parts.push(`${l.passYds} pass yds, ${l.passTD} TD`)
  if (l.rushYds) parts.push(`${l.rushYds} rush yds, ${l.rushTD} TD`)
  if (l.recYds) parts.push(`${l.rec} rec, ${l.recYds} yds, ${l.recTD} TD`)
  if (l.tackles || l.sacks || l.defInt) parts.push(`${l.tackles} tkl, ${l.sacks} sacks, ${l.defInt} INT`)
  return parts.join(' · ') || 'No stats'
}

export function computeAwards(stats: Record<string, StatLine>): SeasonAwards {
  const entries = Object.entries(stats).filter(([id]) => getPlayer(id)?.kind === 'player')
  const best = (mode: 'all' | 'off' | 'def') => {
    const top = [...entries].sort((a, b) => score(b[1], mode) - score(a[1], mode))[0]
    return top && score(top[1], mode) > 0 ? { playerId: top[0], line: statLineText(top[1]) } : undefined
  }
  return { mvp: best('all'), opoy: best('off'), dpoy: best('def') }
}

export function userRecord(season: SeasonState) {
  let w = 0
  let l = 0
  for (const f of userFixtures(season)) {
    if (!f.result) continue
    const us = f.home === USER_TEAM ? f.result.home : f.result.away
    const them = f.home === USER_TEAM ? f.result.away : f.result.home
    if (us > them) w++
    else l++
  }
  return { w, l }
}

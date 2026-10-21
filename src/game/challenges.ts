import { hashStr, mulberry32 } from './rng'
import type { StatLine } from './types'
import type { TeamGameStats } from './engine/types'

export interface ChallengeCtx {
  win: boolean
  userScore: number
  oppScore: number
  team: TeamGameStats
  players: Record<string, StatLine>
}

export interface ChallengeDef {
  id: string
  name: string
  reward: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  check: (c: ChallengeCtx) => boolean
}

const sum = (c: ChallengeCtx, k: keyof StatLine) => Object.values(c.players).reduce((s, l) => s + l[k], 0)

export const CHALLENGE_POOL: ChallengeDef[] = [
  { id: 'pass150', name: 'Throw for 150+ yards in a game', reward: 400, difficulty: 'Medium', check: (c) => c.team.passYds >= 150 },
  { id: 'rush80', name: 'Rush for 80+ yards in a game', reward: 400, difficulty: 'Medium', check: (c) => c.team.rushYds >= 80 },
  { id: 'td3', name: 'Score 3+ offensive touchdowns', reward: 500, difficulty: 'Medium', check: (c) => c.team.passTD + c.team.rushTD >= 3 },
  { id: 'win', name: 'Win a game', reward: 350, difficulty: 'Easy', check: (c) => c.win },
  { id: 'sack2', name: 'Record 2+ sacks on defense', reward: 450, difficulty: 'Medium', check: (c) => sum(c, 'sacks') >= 2 },
  { id: 'int1', name: 'Intercept a pass on defense', reward: 400, difficulty: 'Medium', check: (c) => sum(c, 'defInt') >= 1 },
  { id: 'hold7', name: 'Allow 7 points or fewer', reward: 700, difficulty: 'Hard', check: (c) => c.oppScore <= 7 },
  { id: 'clean', name: 'Win without throwing an interception', reward: 500, difficulty: 'Medium', check: (c) => c.win && c.team.ints === 0 },
  { id: 'fg', name: 'Make a field goal', reward: 300, difficulty: 'Easy', check: (c) => c.team.fgMade >= 1 },
  { id: 'td1', name: 'Score a touchdown', reward: 200, difficulty: 'Easy', check: (c) => c.team.tds >= 1 },
  { id: 'blowout', name: 'Win by 21+ points', reward: 900, difficulty: 'Hard', check: (c) => c.userScore - c.oppScore >= 21 },
]

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Three daily practice challenges, the same for everyone on a given date. */
export function dailyChallenges(date = todayKey()): ChallengeDef[] {
  const rng = mulberry32(hashStr(`daily-${date}`))
  const pool = [...CHALLENGE_POOL]
  const out: ChallengeDef[] = []
  while (out.length < 3) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  return out
}

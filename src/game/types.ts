import type { PulledCard } from './packs'
import type { GameState } from './engine/types'

export interface CardInstance {
  uid: string
  playerId: string
  level: number
  locked: boolean
  favorite: boolean
  acquiredAt: number
  source: string
}

export type OffSlot = 'QB' | 'RB' | 'WR1' | 'WR2' | 'TE' | 'OL1' | 'OL2' | 'OL3'
export type DefSlot = 'DL1' | 'DL2' | 'LB1' | 'LB2' | 'CB1' | 'CB2' | 'S'
export type CoachSlot = 'HC' | 'OC' | 'OLC' | 'DLC' | 'DBC'
export type SlotId = OffSlot | DefSlot | 'K' | CoachSlot

export type Difficulty = 'rookie' | 'varsity' | 'allstate'
export type Formation = 'spread' | 'pro' | 'shotgun'
export type OffStrategy = 'hurry' | 'balanced' | 'control'
export type DefStrategy = 'aggressive' | 'balanced' | 'conservative'

export interface Settings {
  quarterMinutes: 2 | 4 | 6
  difficulty: Difficulty
  sound: boolean
  autoDefense: boolean
}

export interface Tx {
  id: string
  ts: number
  amount: number
  reason: string
  balance: number
}

export interface StatLine {
  gp: number
  passAtt: number
  passComp: number
  passYds: number
  passTD: number
  intThrown: number
  rushAtt: number
  rushYds: number
  rushTD: number
  rec: number
  recYds: number
  recTD: number
  tackles: number
  sacks: number
  defInt: number
}

export interface Fixture {
  id: string
  week: number
  home: string
  away: string
  stage: 'regular' | 'semi' | 'final'
  result?: { home: number; away: number; simulated: boolean }
}

export interface SeasonState {
  number: number
  year: number
  teams: string[]
  fixtures: Fixture[]
  phase: 'regular' | 'playoffs' | 'complete'
  champion?: string
  awards?: SeasonAwards
}

export interface SeasonAwards {
  mvp?: { playerId: string; line: string }
  opoy?: { playerId: string; line: string }
  dpoy?: { playerId: string; line: string }
}

export interface SeasonSummary {
  number: number
  year: number
  wins: number
  losses: number
  pointsFor: number
  pointsAgainst: number
  rank: number
  champion: boolean
  championName: string
  awards?: SeasonAwards
}

export interface Career {
  gamesPlayed: number
  wins: number
  losses: number
  championships: number
  touchdowns: number
  pointsFor: number
  pointsAgainst: number
  winStreak: number
  bestStreak: number
  shutouts: number
  packsOpened: number
  bestPull: string | null
}

export interface PendingPack {
  id: string
  packId: string
  cards: PulledCard[]
  createdAt: number
}

export interface SaveData {
  version: number
  createdAt: number
  coins: number
  cards: CardInstance[]
  roster: string[]
  lineup: Partial<Record<SlotId, string>>
  fitness: Record<string, number>
  formation: Formation
  offStrategy: OffStrategy
  defStrategy: DefStrategy
  settings: Settings
  transactions: Tx[]
  claimed: Record<string, number>
  achievements: Record<string, number>
  daily: { date: string; done: string[] }
  season: SeasonState
  seasonHistory: SeasonSummary[]
  career: Career
  careerStats: Record<string, StatLine>
  seasonStats: Record<string, StatLine>
  pendingPack: PendingPack | null
  activeGame: GameState | null
}

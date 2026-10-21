import type { GameTeam } from '../lineup'
import type { DefStrategy, Formation, OffStrategy, StatLine } from '../types'

export type Side = 'user' | 'opp'

export type Phase = 'coin' | 'playcall' | 'live' | 'defcall' | 'defanim' | 'kick' | 'pat' | 'halftime' | 'final'

export interface LogEntry {
  q: number
  clock: number
  text: string
  kind: 'play' | 'score' | 'turnover' | 'info'
  side: Side
}

export interface TeamGameStats {
  passAtt: number
  passComp: number
  passYds: number
  passTD: number
  ints: number
  rushAtt: number
  rushYds: number
  rushTD: number
  sacked: number
  firstDowns: number
  turnovers: number
  fgMade: number
  fgAtt: number
  tds: number
  plays: number
}

export interface OppInfo {
  id: string
  name: string
  abbr: string
  mascot: string
  primary: string
  secondary: string
  off: number
  def: number
}

export interface GameState {
  id: string
  fixtureId: string | null
  stage: 'exhibition' | 'regular' | 'semi' | 'final'
  home: boolean
  quarterSeconds: number
  quarter: number
  clock: number
  score: Record<Side, number>
  possession: Side
  ballOn: number
  down: number
  toGo: number
  phase: Phase
  firstHalfReceiver: Side
  ot: { round: number; order: Side[]; had: Side[]; current: Side } | null
  pat2: boolean
  kickMode: 'fg' | 'xp' | null
  log: LogEntry[]
  team: Record<Side, TeamGameStats>
  players: Record<string, StatLine>
  userTeam: GameTeam
  opp: OppInfo
  formation: Formation
  offStrategy: OffStrategy
  defStrategy: DefStrategy
  banner: { text: string; kind: 'td' | 'turnover' | 'first' | 'info' | 'bad'; n: number } | null
  createdAt: number
}

export type OutcomeType = 'run' | 'pass' | 'sack' | 'incomplete' | 'int' | 'fumble'

export interface PlayOutcome {
  type: OutcomeType
  /** Net yards from line of scrimmage to where the play ended (or ball was intercepted / fumbled). */
  yards: number
  outOfBounds?: boolean
  /** For interceptions: yards returned toward the new offense's goal. */
  returnYards?: number
  passer?: string
  target?: string
  rusher?: string
  /** User defender credited (opponent possession). */
  tackler?: string
  sacker?: string
  interceptor?: string
  scramble?: boolean
  realSeconds: number
  text: string
}

/**
 * CHAMINADE JV ROSTER — single source of truth for real players.
 *
 * To update the roster, edit the ROSTER_SOURCE lines below. Format per line:
 *   POSITIONS | HEIGHT | NUMBER | NAME | GRADE | HOMETOWN | OVERALL
 * Use "?" for any value that is not publicly verified (shown as "Unavailable").
 * Overall ratings are game ratings supplied by the team, not real statistics.
 * Rarity tiers are derived automatically from the overall ranking (see cards.ts).
 */
export type Pos = 'QB' | 'RB' | 'WR' | 'TE' | 'OL' | 'DL' | 'LB' | 'CB' | 'S' | 'K'

export type CoachRole = 'HC' | 'OC' | 'OLC' | 'DLC' | 'DBC'

export interface PlayerDef {
  id: string
  kind: 'player' | 'coach' | 'test'
  name: string
  number: number | null
  listedPos: string
  positions: Pos[]
  height: string | null
  grade: string | null
  hometown: string | null
  overall: number
  coachRole?: CoachRole
}

const ROSTER_SOURCE = `
WR/DB | 5'11" | 1 | Joseph Lentini | Sophomore | Merrick | 95
DB | 5'6" | 2 | Dennis Williams | Sophomore | Garden City | 78
DB | 5'8" | 3 | Marino Sorbara | ? | Rockville Centre | 83
WR | 5'9" | 4 | Lucas Acheson | Sophomore | Rockville Centre | 81
DB | ? | 5 | George Lekanides | Sophomore | Garden City | 60
WR | 5'8" | 6 | Andrew Fiebelkorn | Sophomore | Floral Park | 79
QB/DB | 6'2" | 7 | Dylan Dogmanits | Sophomore | Amityville | 97
RB/DB | 5'11" | 8 | Ryan Milone-Cantillo | Sophomore | Massapequa | 94
DL/LB | 6'1" | 9 | Thomas Keane | Sophomore | Merrick | 86
WR/DB | 5'9" | 10 | Gianluca Petito | Sophomore | Glen Cove | 67
RB | 5'11" | 11 | Mason Yarocki | Sophomore | Bayville | 80
QB | 5'10" | 12 | Mario Cimino | Sophomore | Williston Park | 92
DB | 5'8" | 14 | Jake Middlebrook | Sophomore | Port Washington | 70
TE | 5'10" | 16 | Thomas Saville | Sophomore | Oyster Bay Cove | 79
WR/DB | 5'7" | 17 | Liam Schmid | Sophomore | North Merrick | 69
K/WR | 6'1" | 18 | Luca Passavia | Sophomore | Lloyd Harbor | 88
RB/DL | 5'10" | 20 | Elijah Vineyard | Freshman | West Hempstead | 82
LB | 5'5" | 21 | Aidan Christmas | Sophomore | Long Beach | 76
LB | 5'9" | 22 | Jack Devlin | Sophomore | Wantagh | 94
DB | 6'0" | 23 | Luke Savio | Sophomore | Garden City | 74
LB | 5'9" | 24 | Demetrios Vorvolakos | Sophomore | Jamaica | 68
DB | 5'11" | 25 | Charles Mendreski | Sophomore | Huntington | 65
DB/WR | 6'0" | 26 | Christian Ferrari | Sophomore | Garden City | 92
DB | 5'10" | 27 | Christopher Meyer | Sophomore | Huntington | 76
DB | 5'9" | 28 | Nate Gray | Sophomore | Point Lookout | 90
DB | 5'9" | 32 | John DiDomenico | Sophomore | Seaford | 70
LB | 6'0" | 35 | Ryan Gallagher | Sophomore | Floral Park | 97
DB | 5'9" | 38 | James Wenk | Sophomore | Garden City | 69
TE | 5'7" | 44 | Luka Tomaszewski | Sophomore | Albertson | 87
DE | 6'2" | 47 | Damien O'Rourke | Sophomore | Northport | 83
DL | 5'10" | 48 | William Supper | Sophomore | Garden City | 82
DL | 5'10" | 49 | Jacob Rodriguez | Sophomore | Malverne | 77
DL | 5'10" | 51 | Kieran Bella | Sophomore | East Atlantic Beach | 76
LB | 5'10" | 52 | Michael Manley | Sophomore | Garden City | 74
LB | 5'8" | 54 | Rocco Fargnoli | Sophomore | North Bellmore | 89
OL/DL | 6'0" | 55 | Ryan Bardak | Sophomore | Wantagh | 88
OL | 6'1" | 56 | Phinehas Cullen | Sophomore | Babylon | 96
OL | 5'11" | 58 | Jake Obermueller | Sophomore | Rockville Centre | 70
C | 6'1" | 61 | Donovan Carroll | Sophomore | Garden City | 81
OL | 5'8" | 62 | Vincent Montanaro | Sophomore | New Hyde Park | 50
DL | 5'10" | 64 | Henry Parrone | Sophomore | Huntington Station | 74
OL | 6'2" | 65 | Justin Durnan | Sophomore | Rockville Centre | 82
OL | 5'9" | 68 | Kieran Arora | Sophomore | Seaford | 67
OL/DL | 5'11" | 70 | Eamon Miller | Freshman | Garden City | 90
WR | 5'8" | 71 | Nicholas Dagliolo | Sophomore | Massapequa | 71
OL/DL/WR | 5'11" | 72 | Lucas Conaty | Sophomore | Seaford | 99
OL/DL | 5'9" | 73 | Tyler Stehn | Sophomore | Massapequa | 79
OL/DL | 6'2" | 74 | Jeffrey Witten | Sophomore | Rockville Centre | 78
C | 6'0" | 75 | Felix Bravo | Sophomore | Oceanside | 81
OL | 5'11" | 77 | William Rich | Sophomore | Rockville Centre | 63
TE/LB | 5'10" | 81 | Daniel Rubenacker | Sophomore | Centerport | 74
OL | 6'0" | 82 | Henry DeCamp | Sophomore | Rockville Centre | 68
TE | 6'3" | 87 | Matthew Hudak | Sophomore | Glen Cove | 89
DL | 6'0" | 90 | Vincent Stewart | Sophomore | Oyster Bay | 83
`

/** Coaching staff — all Mythic. Coaches give team-wide boosts when assigned. */
const COACH_SOURCE: Array<[CoachRole, string, string]> = [
  ['HC', 'John Rossillo', 'JV Head Coach'],
  ['OC', 'MattySwish', 'JV Offensive Coach'],
  ['OLC', 'Marc Hudak', 'JV O-Line Coach'],
  ['DLC', 'Paul Micelli', 'JV D-Line Coach'],
  ['DBC', 'Michael Bertolini', 'JV DB Coach'],
]

const POS_MAP: Record<string, Pos[]> = {
  QB: ['QB'],
  RB: ['RB'],
  WR: ['WR'],
  TE: ['TE'],
  OL: ['OL'],
  C: ['OL'],
  DL: ['DL'],
  DE: ['DL'],
  LB: ['LB'],
  DB: ['CB', 'S'],
  CB: ['CB'],
  S: ['S'],
  K: ['K'],
}

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function parseRoster(src: string): PlayerDef[] {
  return src
    .trim()
    .split('\n')
    .map((line) => line.split('|').map((x) => x.trim()))
    .map(([pos, height, num, name, grade, town, ovr]) => {
      const positions = Array.from(
        new Set(pos.split('/').flatMap((p) => POS_MAP[p] ?? [])),
      )
      const unk = (v: string) => (v === '?' || v === '' ? null : v)
      return {
        id: `chm-${num}-${slug(name)}`,
        kind: 'player' as const,
        name,
        number: unk(num) ? Number(num) : null,
        listedPos: pos,
        positions,
        height: unk(height),
        grade: unk(grade),
        hometown: unk(town),
        overall: Math.max(40, Math.min(99, Number(ovr))),
      }
    })
}

export const REAL_PLAYERS: PlayerDef[] = parseRoster(ROSTER_SOURCE)

export const COACHES: PlayerDef[] = COACH_SOURCE.map(([role, name, title]) => ({
  id: `coach-${slug(name)}`,
  kind: 'coach',
  name,
  number: null,
  listedPos: title,
  positions: [],
  height: null,
  grade: null,
  hometown: null,
  overall: 99,
  coachRole: role,
}))

/**
 * Fictional walk-on test players. They are NOT real people, are never in packs,
 * and automatically fill any empty lineup slot so a game is always playable.
 */
export const WALK_ONS: PlayerDef[] = (
  ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'] as Pos[]
).map((p) => ({
  id: `walkon-${p}`,
  kind: 'test',
  name: `Walk-On ${p}`,
  number: null,
  listedPos: p,
  positions: [p],
  height: null,
  grade: null,
  hometown: null,
  overall: 60,
}))

export const COLLECTIBLES: PlayerDef[] = [...REAL_PLAYERS, ...COACHES]

const BY_ID = new Map<string, PlayerDef>(
  [...COLLECTIBLES, ...WALK_ONS].map((p) => [p.id, p]),
)

export function getPlayer(id: string): PlayerDef | undefined {
  return BY_ID.get(id)
}

export const COACH_BOOSTS: Record<CoachRole, { label: string; text: string }> = {
  HC: { label: 'Head Coach', text: '+2 to every starter' },
  OC: { label: 'Offensive Coach', text: '+4 passing & route running' },
  OLC: { label: 'O-Line Coach', text: '+5 blocking' },
  DLC: { label: 'D-Line Coach', text: '+5 pass rush & run stop' },
  DBC: { label: 'DB Coach', text: '+5 coverage' },
}

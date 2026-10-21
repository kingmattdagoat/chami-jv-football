/**
 * League teams. Opponent names are New York Catholic High School Football League
 * programs; their JV rosters are not public, so every opponent uses FICTIONAL
 * game ratings and generic numbered players. Colors are game colors only.
 * Edit ratings here to rebalance the league.
 */
export interface TeamDef {
  id: string
  school: string
  short: string
  mascot: string
  abbr: string
  primary: string
  secondary: string
  offense: number
  defense: number
}

export const CHAMINADE: TeamDef = {
  id: 'chaminade',
  school: 'Chaminade',
  short: 'Chaminade',
  mascot: 'Flyers',
  abbr: 'CHAM',
  primary: '#9e1b32',
  secondary: '#e8b923',
  offense: 0,
  defense: 0,
}

export const OPPONENTS: TeamDef[] = [
  { id: 'st-anthonys', school: "St. Anthony's", short: "St. Anthony's", mascot: 'Friars', abbr: 'STA', primary: '#2f6b3a', secondary: '#f0c419', offense: 84, defense: 85 },
  { id: 'holy-trinity', school: 'Holy Trinity', short: 'Holy Trinity', mascot: 'Titans', abbr: 'HT', primary: '#1d3f8f', secondary: '#c8ccd4', offense: 76, defense: 77 },
  { id: 'kellenberg', school: 'Kellenberg Memorial', short: 'Kellenberg', mascot: 'Firebirds', abbr: 'KEL', primary: '#1f2a6b', secondary: '#e04a2f', offense: 80, defense: 79 },
  { id: 'sjbts', school: 'St. Joseph by-the-Sea', short: 'St. Joseph', mascot: 'Vikings', abbr: 'SJS', primary: '#0f5c8f', secondary: '#f2f2f2', offense: 74, defense: 73 },
  { id: 'iona-prep', school: 'Iona Prep', short: 'Iona Prep', mascot: 'Gaels', abbr: 'IONA', primary: '#7a1424', secondary: '#f2d36b', offense: 78, defense: 80 },
  { id: 'stepinac', school: 'Archbishop Stepinac', short: 'Stepinac', mascot: 'Crusaders', abbr: 'STEP', primary: '#13306b', secondary: '#f5f5f5', offense: 83, defense: 82 },
  { id: 'farrell', school: 'Monsignor Farrell', short: 'Farrell', mascot: 'Lions', abbr: 'MF', primary: '#173e7a', secondary: '#f0c419', offense: 77, defense: 76 },
  { id: 'fordham-prep', school: 'Fordham Prep', short: 'Fordham Prep', mascot: 'Rams', abbr: 'FP', primary: '#6b1a2b', secondary: '#ffffff', offense: 72, defense: 74 },
  { id: 'cardinal-hayes', school: 'Cardinal Hayes', short: 'Cardinal Hayes', mascot: 'Cardinals', abbr: 'CH', primary: '#a31621', secondary: '#f5f5f5', offense: 73, defense: 71 },
  { id: 'xaverian', school: 'Xaverian', short: 'Xaverian', mascot: 'Clippers', abbr: 'XAV', primary: '#14284b', secondary: '#c9a227', offense: 75, defense: 75 },
  { id: 'st-francis-prep', school: 'St. Francis Prep', short: 'SFP', mascot: 'Terriers', abbr: 'SFP', primary: '#0c4f2d', secondary: '#f4f4f4', offense: 70, defense: 69 },
  { id: 'holy-cross', school: 'Holy Cross', short: 'Holy Cross', mascot: 'Knights', abbr: 'HC', primary: '#2b3990', secondary: '#f6c700', offense: 68, defense: 70 },
]

/** The seven programs that make up the season league with Chaminade. */
export const LEAGUE_IDS = [
  'chaminade',
  'st-anthonys',
  'holy-trinity',
  'kellenberg',
  'sjbts',
  'iona-prep',
  'stepinac',
  'farrell',
]

const ALL = new Map<string, TeamDef>([CHAMINADE, ...OPPONENTS].map((t) => [t.id, t]))

export function getTeam(id: string): TeamDef {
  return ALL.get(id) ?? OPPONENTS[0]
}

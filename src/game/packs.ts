import { POOL_BY_RARITY, RARITIES, rarityRank, type Rarity } from './cards'
import { defaultRng, type Rng } from './rng'

/**
 * Odds are stored in basis points (1/100th of a percent) so each table sums to
 * exactly 10000 = 100.00% without floating-point drift.
 */
export type OddsTable = Record<Rarity, number>

export interface PackDef {
  id: string
  name: string
  price: number
  cards: number
  blurb: string
  odds: OddsTable
  guarantee?: Rarity
  accent: string
}

export const STANDARD_ODDS: OddsTable = {
  common: 5000,
  uncommon: 2500,
  rare: 1500,
  epic: 700,
  legendary: 250,
  mythic: 50,
}

export const PACKS: PackDef[] = [
  {
    id: 'basic',
    name: 'Basic Pack',
    price: 500,
    cards: 3,
    blurb: '3 cards. Mostly Common and Uncommon.',
    odds: { common: 6200, uncommon: 2800, rare: 800, epic: 170, legendary: 25, mythic: 5 },
    accent: '#9aa0a6',
  },
  {
    id: 'pro',
    name: 'Pro Pack',
    price: 1500,
    cards: 5,
    blurb: '5 cards. Improved Rare and Epic chances.',
    odds: { common: 4000, uncommon: 2800, rare: 2000, epic: 900, legendary: 250, mythic: 50 },
    accent: '#5ec8ff',
  },
  {
    id: 'elite',
    name: 'Elite Pack',
    price: 4000,
    cards: 5,
    blurb: '5 cards. Better Epic and Legendary chances.',
    odds: { common: 2000, uncommon: 2500, rare: 2700, epic: 1800, legendary: 800, mythic: 200 },
    accent: '#c77dff',
  },
  {
    id: 'legendary',
    name: 'Legendary Pack',
    price: 8000,
    cards: 3,
    blurb: '3 premium cards. High Legendary odds, guaranteed Rare or better.',
    odds: { common: 0, uncommon: 2000, rare: 3000, epic: 2700, legendary: 1800, mythic: 500 },
    guarantee: 'rare',
    accent: '#ffd54a',
  },
  {
    id: 'mythic',
    name: 'Mythic Pack',
    price: 15000,
    cards: 5,
    blurb: '5 premium cards. Guaranteed Epic or better, boosted Mythic chance.',
    odds: { common: 0, uncommon: 1000, rare: 3000, epic: 3000, legendary: 2000, mythic: 1000 },
    guarantee: 'epic',
    accent: '#ff4d6d',
  },
]

export function getPack(id: string) {
  return PACKS.find((p) => p.id === id)
}

export function oddsTotal(t: OddsTable) {
  return RARITIES.reduce((s, r) => s + t[r], 0)
}

/** The table used for the guaranteed slot: the base table restricted to >= floor, renormalised. */
export function guaranteedOdds(t: OddsTable, floor: Rarity): OddsTable {
  const allowed = RARITIES.filter((r) => rarityRank(r) >= rarityRank(floor))
  const sum = allowed.reduce((s, r) => s + t[r], 0)
  const out = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 } as OddsTable
  let acc = 0
  allowed.forEach((r, i) => {
    if (i === allowed.length - 1) out[r] = 10000 - acc
    else {
      out[r] = sum > 0 ? Math.round((t[r] / sum) * 10000) : 0
      acc += out[r]
    }
  })
  return out
}

export function rollRarity(t: OddsTable, rng: Rng = defaultRng): Rarity {
  const total = oddsTotal(t)
  let roll = rng() * total
  for (const r of RARITIES) {
    if (roll < t[r]) return r
    roll -= t[r]
  }
  return 'common'
}

export interface PulledCard {
  playerId: string
  rarity: Rarity
}

/**
 * Rolls a full pack. If a guarantee exists and no earlier card met it, the final
 * slot is rolled on the guaranteed table so the rule always holds.
 */
export function rollPack(pack: PackDef, rng: Rng = defaultRng): PulledCard[] {
  const out: PulledCard[] = []
  for (let i = 0; i < pack.cards; i++) {
    const last = i === pack.cards - 1
    const needGuarantee =
      pack.guarantee &&
      last &&
      !out.some((c) => rarityRank(c.rarity) >= rarityRank(pack.guarantee!))
    const table = needGuarantee ? guaranteedOdds(pack.odds, pack.guarantee!) : pack.odds
    const rarity = rollRarity(table, rng)
    const pool = POOL_BY_RARITY[rarity]
    const p = pool[Math.floor(rng() * pool.length)]
    out.push({ playerId: p.id, rarity })
  }
  return out
}

export function fmtOdds(bp: number) {
  return `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 2)}%`
}

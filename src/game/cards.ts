import { COLLECTIBLES, REAL_PLAYERS, getPlayer, type PlayerDef, type Pos } from './data/roster'
import { clamp, hashStr } from './rng'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

export const RARITY_INFO: Record<Rarity, { label: string; color: string; sell: number; tier: number }> = {
  common: { label: 'Common', color: '#9aa0a6', sell: 50, tier: 0 },
  uncommon: { label: 'Uncommon', color: '#6fdc8c', sell: 100, tier: 1 },
  rare: { label: 'Rare', color: '#5ec8ff', sell: 250, tier: 2 },
  epic: { label: 'Epic', color: '#c77dff', sell: 600, tier: 3 },
  legendary: { label: 'Legendary', color: '#ffd54a', sell: 1500, tier: 4 },
  mythic: { label: 'Mythic', color: '#ff4d6d', sell: 4000, tier: 5 },
}

/** Tier sizes by overall rank: top 6 mythic, next 8 legendary, 8 epic, 8 rare, 10 uncommon, rest common. */
const TIER_SIZES: Array<[Rarity, number]> = [
  ['mythic', 6],
  ['legendary', 8],
  ['epic', 8],
  ['rare', 8],
  ['uncommon', 10],
]

const RARITY_BY_ID = (() => {
  const m = new Map<string, Rarity>()
  const ranked = [...REAL_PLAYERS].sort(
    (a, b) => b.overall - a.overall || (a.number ?? 999) - (b.number ?? 999),
  )
  let i = 0
  for (const [r, n] of TIER_SIZES) {
    for (let k = 0; k < n && i < ranked.length; k++, i++) m.set(ranked[i].id, r)
  }
  for (; i < ranked.length; i++) m.set(ranked[i].id, 'common')
  for (const c of COLLECTIBLES) if (c.kind === 'coach') m.set(c.id, 'mythic')
  return m
})()

export function rarityOf(id: string): Rarity {
  return RARITY_BY_ID.get(id) ?? 'common'
}

export const POOL_BY_RARITY: Record<Rarity, PlayerDef[]> = RARITIES.reduce(
  (acc, r) => {
    acc[r] = COLLECTIBLES.filter((p) => rarityOf(p.id) === r)
    return acc
  },
  {} as Record<Rarity, PlayerDef[]>,
)

export type AttrKey =
  | 'throwAcc'
  | 'throwPow'
  | 'speed'
  | 'accel'
  | 'agility'
  | 'ballSec'
  | 'catching'
  | 'route'
  | 'strength'
  | 'blocking'
  | 'awareness'
  | 'tackling'
  | 'coverage'
  | 'kickPow'
  | 'kickAcc'

export const ATTR_LABEL: Record<AttrKey, string> = {
  throwAcc: 'Throw Accuracy',
  throwPow: 'Throw Power',
  speed: 'Speed',
  accel: 'Acceleration',
  agility: 'Agility',
  ballSec: 'Ball Security',
  catching: 'Catching',
  route: 'Route Running',
  strength: 'Strength',
  blocking: 'Blocking',
  awareness: 'Awareness',
  tackling: 'Tackling',
  coverage: 'Coverage',
  kickPow: 'Kick Power',
  kickAcc: 'Kick Accuracy',
}

const ALL_ATTRS = Object.keys(ATTR_LABEL) as AttrKey[]

/** Key attributes per position with their offset from the card's overall. */
const PROFILE: Record<Pos, Partial<Record<AttrKey, number>>> = {
  QB: { throwAcc: 2, throwPow: 1, speed: -6, awareness: 2 },
  RB: { speed: 2, accel: 2, agility: 1, ballSec: -2 },
  WR: { speed: 3, catching: 1, route: 0, strength: -6 },
  TE: { speed: -5, catching: 1, route: -2, strength: 5 },
  OL: { blocking: 2, strength: 2, awareness: -2 },
  DL: { tackling: 1, speed: -6, coverage: -14, strength: 5, awareness: 0 },
  LB: { tackling: 3, speed: -2, coverage: -4, strength: 1, awareness: 2 },
  CB: { tackling: -4, speed: 3, coverage: 3, strength: -6, awareness: 0 },
  S: { tackling: 0, speed: 1, coverage: 2, strength: -2, awareness: 2 },
  K: { kickPow: 1, kickAcc: 0 },
}

export const POS_ATTRS: Record<Pos, AttrKey[]> = Object.fromEntries(
  Object.entries(PROFILE).map(([p, prof]) => [p, Object.keys(prof) as AttrKey[]]),
) as Record<Pos, AttrKey[]>

export type Attrs = Record<AttrKey, number>

const attrCache = new Map<string, Attrs>()

/** Deterministic attribute set for a player at card level 0. */
export function baseAttrs(def: PlayerDef): Attrs {
  const hit = attrCache.get(def.id)
  if (hit) return hit
  const out = {} as Attrs
  for (const a of ALL_ATTRS) {
    let best = def.overall - 22
    for (const p of def.positions) {
      const off = PROFILE[p][a]
      if (off !== undefined) best = Math.max(best, def.overall + off)
    }
    const jitter = (hashStr(def.id + a) % 9) - 4
    out[a] = clamp(Math.round(best + jitter), 30, 99)
  }
  attrCache.set(def.id, out)
  return out
}

export const MAX_LEVEL = 5
export const UPGRADE_COST = [600, 1200, 2200, 3500, 5000]

export function cardAttrs(playerId: string, level = 0): Attrs {
  const def = getPlayer(playerId)
  if (!def) throw new Error(`Unknown player ${playerId}`)
  const b = baseAttrs(def)
  const out = {} as Attrs
  for (const a of ALL_ATTRS) out[a] = clamp(b[a] + level, 30, 99)
  return out
}

export function cardOverall(playerId: string, level = 0) {
  const def = getPlayer(playerId)
  return clamp((def?.overall ?? 50) + level, 30, 99)
}

/** How good a player is at a specific position (average of that position's key attributes). */
export function posRating(attrs: Attrs, pos: Pos) {
  const keys = POS_ATTRS[pos]
  return Math.round(keys.reduce((s, k) => s + attrs[k], 0) / keys.length)
}

export function rarityRank(r: Rarity) {
  return RARITY_INFO[r].tier
}

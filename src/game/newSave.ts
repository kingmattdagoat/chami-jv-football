import { POOL_BY_RARITY } from './cards'
import { autoFill } from './lineup'
import { createSeason } from './season'
import { newCard } from './shop'
import type { SaveData } from './types'

export const STARTING_COINS = 2500

function shuffle<T>(a: T[]) {
  const arr = [...a]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function createNewSave(): SaveData {
  const now = Date.now()
  const starters = [
    ...shuffle(POOL_BY_RARITY.common).slice(0, 8),
    ...shuffle(POOL_BY_RARITY.uncommon).slice(0, 2),
  ].map((p) => newCard(p.id, 'Starter Collection'))
  const save: SaveData = {
    version: 1,
    createdAt: now,
    coins: STARTING_COINS,
    cards: starters,
    roster: [],
    lineup: {},
    fitness: {},
    formation: 'spread',
    offStrategy: 'balanced',
    defStrategy: 'balanced',
    settings: { quarterMinutes: 4, difficulty: 'varsity', sound: true, autoDefense: false },
    transactions: [{ id: 'tx_welcome', ts: now, amount: STARTING_COINS, reason: 'Welcome to Chaminade JV!', balance: STARTING_COINS }],
    claimed: {},
    achievements: {},
    daily: { date: '', done: [] },
    season: createSeason(1, new Date().getFullYear()),
    seasonHistory: [],
    career: { gamesPlayed: 0, wins: 0, losses: 0, championships: 0, touchdowns: 0, pointsFor: 0, pointsAgainst: 0, winStreak: 0, bestStreak: 0, shutouts: 0, packsOpened: 0, bestPull: null },
    careerStats: {},
    seasonStats: {},
    pendingPack: null,
    activeGame: null,
  }
  for (const c of starters) save.roster.push(c.uid)
  autoFill(save)
  return save
}

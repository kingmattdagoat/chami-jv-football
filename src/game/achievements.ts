import { rarityOf, rarityRank } from './cards'
import { COLLECTIBLES } from './data/roster'
import { earn } from './economy'
import type { SaveData } from './types'

export interface AchievementDef {
  id: string
  name: string
  desc: string
  reward: number
  check: (s: SaveData) => boolean
}

export function uniqueOwned(s: SaveData) {
  return new Set(s.cards.map((c) => c.playerId))
}

export function collectionPct(s: SaveData) {
  return uniqueOwned(s).size / COLLECTIBLES.length
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_td', name: 'First Touchdown', desc: 'Score your first touchdown.', reward: 250, check: (s) => s.career.touchdowns >= 1 },
  { id: 'first_win', name: 'First Win', desc: 'Win your first game.', reward: 500, check: (s) => s.career.wins >= 1 },
  { id: 'games_10', name: 'Ten Game Vet', desc: 'Play 10 games.', reward: 1000, check: (s) => s.career.gamesPlayed >= 10 },
  { id: 'perfect_game', name: 'Perfect Game', desc: 'Win a game without allowing a point.', reward: 1500, check: (s) => s.career.shutouts >= 1 },
  { id: 'streak3', name: 'Winning Streak', desc: 'Win 3 games in a row.', reward: 1000, check: (s) => s.career.bestStreak >= 3 },
  { id: 'streak7', name: 'Unstoppable', desc: 'Win 7 games in a row.', reward: 3000, check: (s) => s.career.bestStreak >= 7 },
  { id: 'td_50', name: 'Touchdown Machine', desc: 'Score 50 career touchdowns.', reward: 2000, check: (s) => s.career.touchdowns >= 50 },
  { id: 'champion', name: 'Championship Winner', desc: 'Win a league championship.', reward: 3000, check: (s) => s.career.championships >= 1 },
  { id: 'dynasty', name: 'Dynasty', desc: 'Win 3 championships.', reward: 8000, check: (s) => s.career.championships >= 3 },
  { id: 'pack_10', name: 'Pack Rat', desc: 'Open 10 packs.', reward: 1000, check: (s) => s.career.packsOpened >= 10 },
  {
    id: 'rare_collector',
    name: 'Rare Card Collector',
    desc: 'Own 10 different Rare-or-better cards.',
    reward: 1500,
    check: (s) => [...uniqueOwned(s)].filter((id) => rarityRank(rarityOf(id)) >= 2).length >= 10,
  },
  {
    id: 'legendary_pull',
    name: 'Legendary Pull',
    desc: 'Own a Legendary or Mythic card.',
    reward: 1000,
    check: (s) => s.cards.some((c) => rarityRank(rarityOf(c.playerId)) >= 4),
  },
  { id: 'collection_25', name: 'Collector I', desc: 'Collect 25% of all cards.', reward: 750, check: (s) => collectionPct(s) >= 0.25 },
  { id: 'collection_50', name: 'Collector II', desc: 'Collect 50% of all cards.', reward: 2000, check: (s) => collectionPct(s) >= 0.5 },
  { id: 'collection_75', name: 'Collector III', desc: 'Collect 75% of all cards.', reward: 4000, check: (s) => collectionPct(s) >= 0.75 },
  { id: 'collection_100', name: 'Full Collection', desc: 'Collect every player and coach.', reward: 15000, check: (s) => collectionPct(s) >= 1 },
]

/** Unlock and pay for any newly satisfied achievements. Safe to call often. */
export function evaluateAchievements(draft: SaveData): AchievementDef[] {
  const unlocked: AchievementDef[] = []
  for (const a of ACHIEVEMENTS) {
    if (draft.achievements[a.id] || !a.check(draft)) continue
    draft.achievements[a.id] = Date.now()
    earn(draft, a.reward, `Achievement: ${a.name}`, `ach:${a.id}`)
    unlocked.push(a)
  }
  return unlocked
}

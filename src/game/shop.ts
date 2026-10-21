import { RARITY_INFO, rarityOf, rarityRank, UPGRADE_COST, MAX_LEVEL } from './cards'
import { getPlayer } from './data/roster'
import { evaluateAchievements } from './achievements'
import { earn, spend } from './economy'
import { getPack, rollPack } from './packs'
import { sanitize } from './lineup'
import { defaultRng, uid, type Rng } from './rng'
import type { CardInstance, SaveData } from './types'

export type Result<T = null> = { ok: true; value: T } | { ok: false; error: string }

/** Charge for a pack and roll it. The roll is stored as pendingPack so a refresh mid-reveal loses nothing. */
export function buyPack(draft: SaveData, packId: string, rng: Rng = defaultRng): Result<string> {
  if (draft.pendingPack) return { ok: false, error: 'Finish opening your current pack first.' }
  const pack = getPack(packId)
  if (!pack) return { ok: false, error: 'That pack does not exist.' }
  if (draft.coins < pack.price) return { ok: false, error: `You need ${(pack.price - draft.coins).toLocaleString()} more coins.` }
  if (!spend(draft, pack.price, `Bought ${pack.name}`)) return { ok: false, error: 'Purchase failed.' }
  const id = uid('pack')
  draft.pendingPack = { id, packId, cards: rollPack(pack, rng), createdAt: Date.now() }
  draft.career.packsOpened++
  return { ok: true, value: id }
}

export function newCard(playerId: string, source: string): CardInstance {
  return { uid: uid('card'), playerId, level: 0, locked: false, favorite: false, acquiredAt: Date.now(), source }
}

/** Move the pending pack's cards into the collection. Idempotent per pack id. */
export function claimPack(draft: SaveData, pendingId: string): Result<CardInstance[]> {
  const p = draft.pendingPack
  if (!p || p.id !== pendingId) return { ok: false, error: 'This pack was already added to your collection.' }
  const pack = getPack(p.packId)
  const added = p.cards.map((c) => newCard(c.playerId, pack?.name ?? 'Pack'))
  draft.cards.push(...added)
  draft.pendingPack = null
  for (const c of p.cards) {
    const best = draft.career.bestPull
    if (!best || rarityRank(rarityOf(c.playerId)) > rarityRank(rarityOf(best))) draft.career.bestPull = c.playerId
  }
  evaluateAchievements(draft)
  return { ok: true, value: added }
}

export function copiesOf(save: SaveData, playerId: string) {
  return save.cards.filter((c) => c.playerId === playerId)
}

export function sellBlockReason(save: SaveData, card: CardInstance): string | null {
  if (card.locked) return 'Card is locked.'
  if (card.favorite) return 'Card is a favorite.'
  if (save.roster.includes(card.uid) || Object.values(save.lineup).includes(card.uid)) return 'Card is on your active roster.'
  if (copiesOf(save, card.playerId).length < 2) return 'You can only sell duplicates — this is your only copy.'
  return null
}

export function sellValue(card: CardInstance) {
  return RARITY_INFO[rarityOf(card.playerId)].sell
}

export function sellCard(draft: SaveData, cardUid: string): Result<number> {
  const card = draft.cards.find((c) => c.uid === cardUid)
  if (!card) return { ok: false, error: 'Card already sold.' }
  const why = sellBlockReason(draft, card)
  if (why) return { ok: false, error: why }
  const value = sellValue(card)
  draft.cards = draft.cards.filter((c) => c.uid !== cardUid)
  earn(draft, value, `Sold duplicate: ${getPlayer(card.playerId)?.name}`)
  sanitize(draft)
  return { ok: true, value }
}

/** Sell every eligible duplicate, always keeping at least one copy (the best) of each player. */
export function sellAllDuplicates(draft: SaveData): Result<{ count: number; coins: number }> {
  let count = 0
  let coins = 0
  const byPlayer = new Map<string, CardInstance[]>()
  for (const c of draft.cards) byPlayer.set(c.playerId, [...(byPlayer.get(c.playerId) ?? []), c])
  for (const cards of byPlayer.values()) {
    if (cards.length < 2) continue
    const keep = [...cards].sort((a, b) => Number(draft.roster.includes(b.uid)) - Number(draft.roster.includes(a.uid)) || b.level - a.level)[0]
    for (const c of cards) {
      if (c.uid === keep.uid) continue
      const r = sellCard(draft, c.uid)
      if (r.ok) {
        count++
        coins += r.value
      }
    }
  }
  if (count === 0) return { ok: false, error: 'No eligible duplicates to sell.' }
  return { ok: true, value: { count, coins } }
}

export function upgradeCost(card: CardInstance) {
  return card.level >= MAX_LEVEL ? null : UPGRADE_COST[card.level]
}

export function upgradeCard(draft: SaveData, cardUid: string): Result<number> {
  const card = draft.cards.find((c) => c.uid === cardUid)
  if (!card) return { ok: false, error: 'Card not found.' }
  const def = getPlayer(card.playerId)
  if (def?.kind !== 'player') return { ok: false, error: 'Coaches are already maxed out.' }
  const cost = upgradeCost(card)
  if (cost == null) return { ok: false, error: 'Card is at max training level.' }
  if (def.overall + card.level >= 99) return { ok: false, error: 'Player is already rated 99.' }
  if (!spend(draft, cost, `Training: ${def.name} → Lv ${card.level + 1}`)) return { ok: false, error: `Training costs ${cost.toLocaleString()} coins.` }
  card.level++
  return { ok: true, value: card.level }
}

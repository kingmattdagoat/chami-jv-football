import { uid } from './rng'
import type { SaveData } from './types'

export const REWARDS = {
  complete: 300,
  win: 500,
  touchdown: 50,
  maxTdBonus: 8,
  playoffWin: 1000,
  championship: 5000,
  simComplete: 100,
  exhibitionComplete: 150,
  exhibitionWin: 250,
}

const MAX_TX = 250

function addTx(draft: SaveData, amount: number, reason: string) {
  draft.transactions.unshift({ id: uid('tx'), ts: Date.now(), amount, reason, balance: draft.coins })
  if (draft.transactions.length > MAX_TX) draft.transactions.length = MAX_TX
}

/** Grant coins. When `key` is given the grant can only ever happen once. */
export function earn(draft: SaveData, amount: number, reason: string, key?: string): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false
  if (key) {
    if (draft.claimed[key]) return false
    draft.claimed[key] = Date.now()
  }
  draft.coins += Math.round(amount)
  addTx(draft, Math.round(amount), reason)
  return true
}

export function spend(draft: SaveData, amount: number, reason: string): boolean {
  if (!Number.isFinite(amount) || amount <= 0 || draft.coins < amount) return false
  draft.coins -= amount
  addTx(draft, -amount, reason)
  return true
}

export function fmtCoins(n: number) {
  return n.toLocaleString('en-US')
}

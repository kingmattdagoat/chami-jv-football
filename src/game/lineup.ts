import { cardAttrs, posRating, type Attrs } from './cards'
import { getPlayer, type CoachRole, type Pos } from './data/roster'
import type { CardInstance, CoachSlot, DefSlot, OffSlot, SaveData, SlotId } from './types'

export const MAX_ROSTER = 30

export interface SlotDef {
  id: SlotId
  pos: Pos | 'COACH'
  label: string
  side: 'off' | 'def' | 'st' | 'coach'
}

export const SLOTS: SlotDef[] = [
  { id: 'QB', pos: 'QB', label: 'Quarterback', side: 'off' },
  { id: 'RB', pos: 'RB', label: 'Running Back', side: 'off' },
  { id: 'WR1', pos: 'WR', label: 'Wide Receiver 1', side: 'off' },
  { id: 'WR2', pos: 'WR', label: 'Wide Receiver 2', side: 'off' },
  { id: 'TE', pos: 'TE', label: 'Tight End', side: 'off' },
  { id: 'OL1', pos: 'OL', label: 'Left Guard', side: 'off' },
  { id: 'OL2', pos: 'OL', label: 'Center', side: 'off' },
  { id: 'OL3', pos: 'OL', label: 'Right Guard', side: 'off' },
  { id: 'DL1', pos: 'DL', label: 'Defensive Line 1', side: 'def' },
  { id: 'DL2', pos: 'DL', label: 'Defensive Line 2', side: 'def' },
  { id: 'LB1', pos: 'LB', label: 'Linebacker 1', side: 'def' },
  { id: 'LB2', pos: 'LB', label: 'Linebacker 2', side: 'def' },
  { id: 'CB1', pos: 'CB', label: 'Cornerback 1', side: 'def' },
  { id: 'CB2', pos: 'CB', label: 'Cornerback 2', side: 'def' },
  { id: 'S', pos: 'S', label: 'Safety', side: 'def' },
  { id: 'K', pos: 'K', label: 'Kicker', side: 'st' },
  { id: 'HC', pos: 'COACH', label: 'Head Coach', side: 'coach' },
  { id: 'OC', pos: 'COACH', label: 'Offensive Coach', side: 'coach' },
  { id: 'OLC', pos: 'COACH', label: 'O-Line Coach', side: 'coach' },
  { id: 'DLC', pos: 'COACH', label: 'D-Line Coach', side: 'coach' },
  { id: 'DBC', pos: 'COACH', label: 'DB Coach', side: 'coach' },
]

export const PLAYER_SLOTS = SLOTS.filter((s) => s.side !== 'coach')

export function slotDef(id: SlotId) {
  return SLOTS.find((s) => s.id === id)!
}

export function isEligible(playerId: string, slot: SlotId) {
  const def = getPlayer(playerId)
  const sd = slotDef(slot)
  if (!def || def.kind === 'test') return false
  if (sd.pos === 'COACH') return def.kind === 'coach' && def.coachRole === (slot as CoachRole)
  return def.kind === 'player' && def.positions.includes(sd.pos)
}

export function findCard(save: SaveData, uid: string | undefined) {
  return uid ? save.cards.find((c) => c.uid === uid) : undefined
}

/** Remove any lineup/roster entry that no longer points at a valid, eligible, unique card. */
export function sanitize(draft: SaveData) {
  const uids = new Set(draft.cards.map((c) => c.uid))
  const seenRosterPlayers = new Set<string>()
  draft.roster = draft.roster.filter((u) => {
    const c = findCard(draft, u)
    if (!c || !uids.has(u) || getPlayer(c.playerId)?.kind !== 'player') return false
    if (seenRosterPlayers.has(c.playerId)) return false
    seenRosterPlayers.add(c.playerId)
    return true
  })
  draft.roster = draft.roster.slice(0, MAX_ROSTER)
  const used = new Set<string>()
  for (const s of SLOTS) {
    const u = draft.lineup[s.id]
    if (!u) continue
    const c = findCard(draft, u)
    const ok =
      c &&
      isEligible(c.playerId, s.id) &&
      (s.side === 'coach' || draft.roster.includes(u)) &&
      !used.has(c.playerId)
    if (!ok) delete draft.lineup[s.id]
    else used.add(c.playerId)
  }
}

export function lineupIssues(save: SaveData): string[] {
  const issues: string[] = []
  const used = new Map<string, SlotId>()
  for (const s of PLAYER_SLOTS) {
    const c = findCard(save, save.lineup[s.id])
    if (!c) {
      issues.push(`${s.label} is empty — a walk-on will play.`)
      continue
    }
    if (!isEligible(c.playerId, s.id)) issues.push(`${s.label}: player is not eligible.`)
    if (used.has(c.playerId)) issues.push(`${s.label}: player already starts at ${used.get(c.playerId)}.`)
    used.set(c.playerId, s.id)
    const fit = save.fitness[c.playerId] ?? 100
    if (fit < 60) issues.push(`${getPlayer(c.playerId)?.name} is tired (${fit}% fitness).`)
  }
  return issues
}

export function addToRoster(draft: SaveData, uid: string): string | null {
  const c = findCard(draft, uid)
  if (!c) return 'Card not found.'
  if (getPlayer(c.playerId)?.kind !== 'player') return 'Coaches are assigned directly to coaching slots.'
  if (draft.roster.includes(uid)) return null
  const dupe = draft.roster.find((u) => findCard(draft, u)?.playerId === c.playerId)
  if (dupe) {
    // Swap to the requested copy so the same player is never on the roster twice.
    draft.roster = draft.roster.map((u) => (u === dupe ? uid : u))
    for (const s of SLOTS) if (draft.lineup[s.id] === dupe) draft.lineup[s.id] = uid
    return null
  }
  if (draft.roster.length >= MAX_ROSTER) return `Roster is full (${MAX_ROSTER}). Release someone first.`
  draft.roster.push(uid)
  return null
}

export function removeFromRoster(draft: SaveData, uid: string) {
  draft.roster = draft.roster.filter((u) => u !== uid)
  for (const s of SLOTS) if (draft.lineup[s.id] === uid) delete draft.lineup[s.id]
}

export function assignSlot(draft: SaveData, slot: SlotId, uid: string | null): string | null {
  if (!uid) {
    delete draft.lineup[slot]
    return null
  }
  const c = findCard(draft, uid)
  if (!c) return 'Card not found.'
  if (!isEligible(c.playerId, slot)) return `${getPlayer(c.playerId)?.name} can't play ${slotDef(slot).label}.`
  if (slotDef(slot).side !== 'coach') {
    const err = addToRoster(draft, uid)
    if (err) return err
  }
  // A player can only hold one starting slot: vacate any other slot they occupy.
  for (const s of SLOTS) {
    const other = findCard(draft, draft.lineup[s.id])
    if (s.id !== slot && other?.playerId === c.playerId) delete draft.lineup[s.id]
  }
  draft.lineup[slot] = uid
  return null
}

function bestCopies(save: SaveData): CardInstance[] {
  const best = new Map<string, CardInstance>()
  for (const c of save.cards) {
    const cur = best.get(c.playerId)
    if (!cur || c.level > cur.level) best.set(c.playerId, c)
  }
  return [...best.values()]
}

/** Fill every slot with the best available owned player, keeping current picks when valid. */
export function autoFill(draft: SaveData, replaceAll = false) {
  if (replaceAll) draft.lineup = {}
  sanitize(draft)
  const used = new Set(
    Object.values(draft.lineup)
      .map((u) => findCard(draft, u)?.playerId)
      .filter(Boolean) as string[],
  )
  const copies = bestCopies(draft)
  // Prefer the scarcest positions first so multi-position players land where needed.
  const order: SlotId[] = ['QB', 'K', 'TE', 'RB', 'OL1', 'OL2', 'OL3', 'WR1', 'WR2', 'DL1', 'DL2', 'LB1', 'LB2', 'CB1', 'CB2', 'S', 'HC', 'OC', 'OLC', 'DLC', 'DBC']
  for (const slot of order) {
    if (draft.lineup[slot]) continue
    const sd = slotDef(slot)
    const candidates = copies
      .filter((c) => !used.has(c.playerId) && isEligible(c.playerId, slot))
      .filter((c) => sd.side === 'coach' || draft.roster.includes(c.uid) || draft.roster.length < MAX_ROSTER || draft.roster.some((u) => findCard(draft, u)?.playerId === c.playerId))
      .map((c) => ({ c, r: sd.pos === 'COACH' ? 99 : posRating(cardAttrs(c.playerId, c.level), sd.pos) }))
      .sort((a, b) => b.r - a.r)
    const pick = candidates[0]
    if (!pick) continue
    if (!assignSlot(draft, slot, pick.c.uid)) used.add(pick.c.playerId)
  }
}

// ---------- Game-time team resolution ----------

export interface GamePlayer {
  slot: SlotId
  playerId: string
  name: string
  number: number | null
  attrs: Attrs
  walkOn: boolean
}

export type GameSlots = OffSlot | DefSlot | 'K'

export interface TeamRatings {
  overall: number
  passing: number
  rushing: number
  blocking: number
  passRush: number
  runStop: number
  coverage: number
  kicking: number
}

export interface GameTeam {
  players: Record<GameSlots, GamePlayer>
  ratings: TeamRatings
  coaches: CoachSlot[]
}

function coachSet(save: SaveData): CoachSlot[] {
  return (['HC', 'OC', 'OLC', 'DLC', 'DBC'] as CoachSlot[]).filter((s) => {
    const c = findCard(save, save.lineup[s])
    return c && isEligible(c.playerId, s)
  })
}

export function resolveTeam(save: SaveData, withFitness = true): GameTeam {
  const coaches = coachSet(save)
  const has = (c: CoachSlot) => coaches.includes(c)
  const players = {} as Record<GameSlots, GamePlayer>
  for (const s of PLAYER_SLOTS) {
    const c = findCard(save, save.lineup[s.id])
    const pos = s.pos as Pos
    const playerId = c && isEligible(c.playerId, s.id) ? c.playerId : `walkon-${pos}`
    const def = getPlayer(playerId)!
    const a = { ...cardAttrs(playerId, c?.level ?? 0) }
    const fit = withFitness ? (save.fitness[playerId] ?? 100) : 100
    const bump = (k: keyof Attrs, n: number) => {
      a[k] = Math.min(99, a[k] + n)
    }
    for (const k of Object.keys(a) as (keyof Attrs)[]) {
      if (has('HC')) bump(k, 2)
      a[k] = Math.round(a[k] * (0.9 + 0.1 * (fit / 100)))
    }
    if (has('OC')) {
      bump('throwAcc', 4)
      bump('route', 4)
    }
    if (has('OLC') && s.pos === 'OL') bump('blocking', 5)
    if (has('DLC') && (s.pos === 'DL' || s.pos === 'LB')) {
      bump('strength', 5)
      bump('tackling', 5)
    }
    if (has('DBC') && (s.pos === 'CB' || s.pos === 'S')) bump('coverage', 5)
    players[s.id as GameSlots] = {
      slot: s.id,
      playerId,
      name: def.name,
      number: def.number,
      attrs: a,
      walkOn: def.kind === 'test',
    }
  }
  const pr = (slot: GameSlots) => posRating(players[slot].attrs, slotDef(slot).pos as Pos)
  const avg = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length)
  const p = players
  const ratings: TeamRatings = {
    passing: avg([pr('QB'), pr('QB'), pr('WR1'), pr('WR2'), pr('TE')]),
    rushing: avg([pr('RB'), pr('RB'), pr('OL1'), pr('OL2'), pr('OL3')]),
    blocking: avg([p.OL1.attrs.blocking, p.OL2.attrs.blocking, p.OL3.attrs.blocking]),
    passRush: avg([p.DL1.attrs.strength, p.DL2.attrs.strength, p.LB1.attrs.tackling, p.DL1.attrs.tackling, p.DL2.attrs.tackling]),
    runStop: avg([pr('DL1'), pr('DL2'), pr('LB1'), pr('LB2')]),
    coverage: avg([pr('CB1'), pr('CB2'), pr('S'), p.LB1.attrs.coverage, p.LB2.attrs.coverage]),
    kicking: pr('K'),
    overall: avg(PLAYER_SLOTS.map((s) => pr(s.id as GameSlots))),
  }
  return { players, ratings, coaches }
}

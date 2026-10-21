import { useSyncExternalStore } from 'react'
import type { SaveData } from './types'
import { createNewSave } from './newSave'

/**
 * Versioned local save. All state changes go through commit(), which clones,
 * mutates, persists and notifies in one synchronous step — so a double click can
 * never observe a half-applied purchase. Swap persist()/load() for a cloud
 * adapter later without touching the screens.
 */
export const SAVE_KEY = 'chami-jv-football:save'
export const SAVE_VERSION = 1

type Listener = () => void
let state: SaveData | null = null
let loadError: string | null = null
const listeners = new Set<Listener>()
let persistErrorHandler: ((msg: string) => void) | null = null

function migrate(raw: unknown): SaveData {
  const data = raw as Partial<SaveData>
  if (!data || typeof data !== 'object' || typeof data.version !== 'number') {
    throw new Error('Save file is not recognised')
  }
  if (data.version > SAVE_VERSION) throw new Error('Save was made by a newer version of the game')
  // v1 is current. Future migrations go here: if (data.version === 1) { ...; data.version = 2 }
  const fresh = createNewSave()
  return {
    ...fresh,
    ...data,
    settings: { ...fresh.settings, ...(data.settings ?? {}) },
    career: { ...fresh.career, ...(data.career ?? {}) },
    version: SAVE_VERSION,
  } as SaveData
}

function load(): SaveData {
  if (typeof window === 'undefined') return createNewSave()
  try {
    const raw = window.localStorage.getItem(SAVE_KEY)
    if (!raw) {
      const s = createNewSave()
      writeRaw(s)
      return s
    }
    return migrate(JSON.parse(raw))
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Unknown save error'
    try {
      const raw = window.localStorage.getItem(SAVE_KEY)
      if (raw) window.localStorage.setItem(`${SAVE_KEY}:corrupt-${Date.now()}`, raw)
    } catch {
      /* ignore */
    }
    const s = createNewSave()
    writeRaw(s)
    return s
  }
}

function writeRaw(s: SaveData) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(s))
  } catch {
    persistErrorHandler?.('Could not save progress — browser storage may be full or disabled.')
  }
}

export function getSave(): SaveData {
  if (!state) state = load()
  return state
}

export function takeLoadError() {
  const e = loadError
  loadError = null
  return e
}

export function onPersistError(fn: (msg: string) => void) {
  persistErrorHandler = fn
}

export function subscribe(fn: Listener) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Apply a mutation atomically. Return value of the mutator is passed through. */
export function commit<T>(mutator: (draft: SaveData) => T): T {
  const draft = structuredClone(getSave())
  const result = mutator(draft)
  state = draft
  writeRaw(draft)
  listeners.forEach((l) => l())
  return result
}

export function replaceSave(next: SaveData) {
  state = migrate(next)
  writeRaw(state)
  listeners.forEach((l) => l())
}

export function resetSave() {
  state = createNewSave()
  writeRaw(state)
  listeners.forEach((l) => l())
}

export function useSave(): SaveData {
  return useSyncExternalStore(subscribe, getSave, getSave)
}

/** Keep tabs in sync if the game is open twice. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== SAVE_KEY || !e.newValue) return
    try {
      state = migrate(JSON.parse(e.newValue))
      listeners.forEach((l) => l())
    } catch {
      /* ignore */
    }
  })
}

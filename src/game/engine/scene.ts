/** Everything the renderer needs for one frame. Coordinates are absolute field yards:
 *  x 0..120 (0-10 Chaminade end zone, 110-120 opponent end zone), y 0..53.3 (top to bottom). */
export const FIELD_W = 53.33
export const CENTER_Y = FIELD_W / 2

export interface SceneEnt {
  x: number
  y: number
  team: 'user' | 'opp'
  number: number | null
  facing: 1 | -1
  step: number
  moving: boolean
  carrier: boolean
  down: boolean
  controlled: boolean
}

export interface Popup {
  x: number
  y: number
  text: string
  color: string
  age: number
}

export interface Scene {
  ents: SceneEnt[]
  ball: { x: number; y: number; z: number } | null
  losX: number | null
  firstDownX: number | null
  focusX: number
  focusY: number
  lookAhead: number
  aim: { fromX: number; fromY: number; toX: number; toY: number; ok: boolean } | null
  popups: Popup[]
  hint: string | null
}

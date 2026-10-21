import type { GameSlots } from '../lineup'

export type RouteId = 'go' | 'slant' | 'curl' | 'post' | 'out' | 'flat' | 'drag' | 'corner' | 'screen' | 'block' | 'wheel'

export type Receiver = 'WR1' | 'WR2' | 'TE' | 'RB'

export interface PlayDef {
  id: string
  name: string
  kind: 'pass' | 'run' | 'special'
  desc: string
  routes: Partial<Record<Receiver, RouteId>>
  carrier?: 'RB' | 'QB'
  runStyle?: 'inside' | 'outside'
  flea?: boolean
  drop: number
}

export const OFFENSE_PLAYS: PlayDef[] = [
  { id: 'slants', name: 'Quick Slants', kind: 'pass', desc: 'Short and fast. Both WRs slant inside, TE leaks to the flat.', routes: { WR1: 'slant', WR2: 'slant', TE: 'flat', RB: 'block' }, drop: 3 },
  { id: 'curlflat', name: 'Curl Flat', kind: 'pass', desc: 'Receivers sit down at 10 yards with outlets underneath.', routes: { WR1: 'curl', WR2: 'out', TE: 'curl', RB: 'flat' }, drop: 4 },
  { id: 'mesh', name: 'Mesh Drag', kind: 'pass', desc: 'Crossing drags pick off man coverage. Great on 3rd & short.', routes: { WR1: 'drag', WR2: 'drag', TE: 'corner', RB: 'flat' }, drop: 3 },
  { id: 'post', name: 'Deep Post', kind: 'pass', desc: 'WR1 breaks inside deep, WR2 runs a go. Big-play shot.', routes: { WR1: 'post', WR2: 'go', TE: 'corner', RB: 'block' }, drop: 5 },
  { id: 'verts', name: 'Four Verticals', kind: 'pass', desc: 'Everybody goes deep. Stretch the safety and pick a lane.', routes: { WR1: 'go', WR2: 'go', TE: 'go', RB: 'wheel' }, drop: 5 },
  { id: 'inside', name: 'Inside Zone', kind: 'run', desc: 'Handoff up the middle behind the guards.', routes: { WR1: 'block', WR2: 'block', TE: 'block' }, carrier: 'RB', runStyle: 'inside', drop: 0 },
  { id: 'sweep', name: 'Outside Sweep', kind: 'run', desc: 'Toss to the RB, bounce it outside and race the corner.', routes: { WR1: 'block', WR2: 'block', TE: 'block' }, carrier: 'RB', runStyle: 'outside', drop: 0 },
  { id: 'screen', name: 'WR Screen', kind: 'special', desc: 'Quick throw to WR1 behind the line with blockers in front.', routes: { WR1: 'screen', WR2: 'go', TE: 'block', RB: 'block' }, drop: 2 },
  { id: 'keeper', name: 'QB Keeper', kind: 'special', desc: 'The QB fakes the handoff and takes off himself.', routes: { WR1: 'block', WR2: 'block', TE: 'block' }, carrier: 'QB', runStyle: 'outside', drop: 0 },
  { id: 'flea', name: 'Flea Flicker', kind: 'special', desc: 'Handoff, pitch back, bomb. Linebackers and safety bite on the run.', routes: { WR1: 'post', WR2: 'go', TE: 'go' }, flea: true, drop: 4 },
]

export const RECEIVER_SLOTS: Receiver[] = ['WR1', 'WR2', 'TE', 'RB']

export const RECEIVER_KEYS: Record<Receiver, string> = { WR1: '1', WR2: '2', TE: '3', RB: '4' }

export type DefCallId = 'man' | 'zone' | 'blitz' | 'runstop' | 'prevent'

export const DEF_CALLS: { id: DefCallId; name: string; desc: string }[] = [
  { id: 'man', name: 'Man Coverage', desc: 'Lock onto every receiver. Solid all-around.' },
  { id: 'zone', name: 'Cover 3 Zone', desc: 'Keep it in front. Strong vs short and medium passes.' },
  { id: 'blitz', name: 'Blitz', desc: 'Send extra rushers. Big sack chance, risky vs deep shots.' },
  { id: 'runstop', name: 'Run Stop', desc: 'Stack the box. Crushes runs, vulnerable to passes.' },
  { id: 'prevent', name: 'Prevent', desc: 'Protect deep. Concedes short gains.' },
]

export type OppPlayType = 'run' | 'short' | 'deep'

export const DEF_WEIGHTS: Record<'run' | 'pass' | 'sack' | 'int', Array<[GameSlots, number]>> = {
  run: [['DL1', 2], ['DL2', 2], ['LB1', 3], ['LB2', 3], ['S', 1.2], ['CB1', 0.8], ['CB2', 0.8]],
  pass: [['CB1', 3], ['CB2', 3], ['S', 2.5], ['LB1', 1.5], ['LB2', 1.5]],
  sack: [['DL1', 3], ['DL2', 3], ['LB1', 1.5], ['LB2', 1.5]],
  int: [['CB1', 3], ['CB2', 3], ['S', 2.5], ['LB1', 0.8], ['LB2', 0.8]],
}

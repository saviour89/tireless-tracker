/**
 * A game is an append-only list of these events. Everything else (life totals, turn timers,
 * stats) is computed from the list by `project()`. Seats are referred to by their index in
 * `Game.seats`, which is also the turn order.
 */

export type EliminationCause =
  | 'damage'
  | 'commander'
  | 'poison'
  | 'combo'
  | 'alt_win'
  | 'concede'
  | 'mill'
  | 'other'

export type WinType = 'last_standing' | 'combo' | 'alt_win' | 'draw'

export type GameEventBody =
  /** Turn 1 begins for `firstSeat`. */
  | { type: 'start'; firstSeat: number }
  /**
   * Life change on `target`. Negative = loss. With `source` it counts as damage dealt by that
   * seat (a positive amount with a source is a correction). With `commander` (index into the
   * source deck's commanders) it is also commander damage.
   */
  | { type: 'life'; target: number; amount: number; source?: number; commander?: number }
  /** Poison counters. Infect commanders can also set `commander`: poison + commander damage, no life loss. */
  | { type: 'poison'; target: number; amount: number; source?: number; commander?: number }
  /** End `turn`. Ignored unless it is still that turn, so two phones tapping at once is harmless. */
  | { type: 'pass'; turn: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'eliminate'; target: number; cause: EliminationCause; by?: number }
  /** Game over. Anyone still alive who isn't a winner is eliminated by it. */
  | { type: 'end'; winners: number[]; winType: WinType; card?: string; note?: string }
  /** Cancels a previous event. */
  | { type: 'undo'; eventId: string }

export interface EventMeta {
  id: string
  gameId: string
  /** Client clock, ms. */
  at: number
  deviceId: string
  /** Order assigned by the server once synced. Unsynced events sort after synced ones. */
  seq?: number
}

export type GameEvent = EventMeta & GameEventBody

export type EventOf<T extends GameEventBody['type']> = Extract<GameEvent, { type: T }>

/** The one ordering used everywhere: server order first, then local clock. */
export function compareEvents(a: GameEvent, b: GameEvent): number {
  const sa = a.seq ?? Number.MAX_SAFE_INTEGER
  const sb = b.seq ?? Number.MAX_SAFE_INTEGER
  if (sa !== sb) return sa - sb
  if (a.at !== b.at) return a.at - b.at
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export const CAUSE_LABEL: Record<EliminationCause, string> = {
  damage: 'Damage',
  commander: 'Commander damage',
  poison: 'Poison',
  combo: 'Combo',
  alt_win: 'Alt win con',
  concede: 'Conceded',
  mill: 'Decked',
  other: 'Other',
}

export const WIN_TYPE_LABEL: Record<WinType, string> = {
  last_standing: 'Last standing',
  combo: 'Combo',
  alt_win: 'Alt win con',
  draw: 'Draw',
}

export const LETHAL_POISON = 10
export const LETHAL_COMMANDER = 21

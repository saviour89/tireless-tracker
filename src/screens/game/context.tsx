import { createContext, useContext } from 'react'
import type { Deck, Game, Player } from '../../data/types'
import type { GameEventBody } from '../../game/events'
import type { GameState } from '../../game/project'

export interface SeatInfo {
  player?: Player
  deck?: Deck
  name: string
  hex: string
}

export interface GameCtxValue {
  game: Game
  state: GameState
  seats: SeatInfo[]
  record: (body: GameEventBody) => void
  /** Seat highlighted by the first-player roll animation. */
  rollingSeat: number | null
}

export const GameCtx = createContext<GameCtxValue | null>(null)

export function useGameCtx(): GameCtxValue {
  const ctx = useContext(GameCtx)
  if (!ctx) throw new Error('useGameCtx outside GameCtx')
  return ctx
}

/** Short label for a commander, e.g. "Atraxa" from "Atraxa, Praetors' Voice". */
export function shortName(name: string): string {
  return name.split(/[,/]/)[0].trim()
}

export function commanderLabel(info: SeatInfo | undefined, idx: number): string {
  const c = info?.deck?.commanders[idx]
  return c ? shortName(c.name) : `${info?.name ?? 'Their'}'s commander`
}

/** Commander slots for a seat; a seat without a deck still gets one generic slot. */
export function commanderSlots(info: SeatInfo | undefined): { idx: number; label: string; artUrl?: string }[] {
  const cs = info?.deck?.commanders ?? []
  if (cs.length === 0) return [{ idx: 0, label: 'Commander' }]
  return cs.map((c, idx) => ({ idx, label: shortName(c.name), artUrl: c.artUrl }))
}

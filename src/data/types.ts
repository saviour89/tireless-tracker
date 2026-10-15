import type { GameSummary } from '../game/summary'

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G'

/** Fields every synced row carries. `updatedAt` decides which write wins during sync. */
export interface Row {
  id: string
  createdAt: number
  updatedAt: number
  /** Soft delete, so the deletion can sync to other devices. */
  deleted?: boolean
}

export interface Player extends Row {
  name: string
  /** Key into PLAYER_COLORS. */
  color: string
}

export interface Commander {
  name: string
  scryfallId?: string
  /** Cropped art, used as panel backgrounds and thumbnails. */
  artUrl?: string
  /** Full card image. */
  imageUrl?: string
  colors: ManaColor[]
}

export type Bracket = 1 | 2 | 3 | 4 | 5

export interface Deck extends Row {
  ownerId: string
  name: string
  /** One commander, or two for partners / backgrounds / friends forever. */
  commanders: Commander[]
  bracket?: Bracket
  colors: ManaColor[]
  /** Retired decks stay in stats but are hidden when picking a deck for a new game. */
  retired?: boolean
}

export interface Seat {
  playerId: string
  deckId: string | null
}

export type GameStatus = 'active' | 'finished' | 'abandoned'

export interface Game extends Row {
  status: GameStatus
  /** 'table': one phone in the middle. 'multi': every player on their own phone. */
  mode: 'table' | 'multi'
  startingLife: number
  /** Seats in turn order, going clockwise around the table. */
  seats: Seat[]
  endedAt?: number
  /** Written when the game finishes; stats read from this instead of replaying every event. */
  summary?: GameSummary
}

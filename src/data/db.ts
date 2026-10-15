import Dexie, { type EntityTable, type Table } from 'dexie'
import type { GameEvent } from '../game/events'
import type { Deck, Game, Player, Row } from './types'

export type DocKind = 'player' | 'deck' | 'game'

/** A local change waiting to be pushed to the server. */
export interface OutboxEntry {
  key: string
  kind: DocKind | 'event'
  id: string
}

export interface MetaEntry {
  key: string
  value: string
}

/** Local, offline-first store. The UI only ever reads from here; syncing fills it from the server. */
export class TrackerDB extends Dexie {
  players!: EntityTable<Player, 'id'>
  decks!: EntityTable<Deck, 'id'>
  games!: EntityTable<Game, 'id'>
  events!: EntityTable<GameEvent, 'id'>
  outbox!: EntityTable<OutboxEntry, 'key'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor(name = 'tireless-tracker') {
    super(name)
    this.version(1).stores({
      players: 'id, updatedAt',
      decks: 'id, ownerId, updatedAt',
      games: 'id, status, createdAt, updatedAt',
      events: 'id, gameId, [gameId+at]',
    })
    this.version(2).stores({
      outbox: 'key',
      meta: 'key',
    })
  }

  /** The table for a synced document kind, typed by the fields all of them share. */
  docTable(kind: DocKind): Table<Row, string> {
    const table = kind === 'player' ? this.players : kind === 'deck' ? this.decks : this.games
    return table as unknown as Table<Row, string>
  }
}

export const db = new TrackerDB()

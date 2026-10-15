import type { DocKind } from '../data/db'
import type { GameEvent } from '../game/events'

export interface DocRow {
  kind: DocKind
  id: string
  data: { updatedAt: number } & Record<string, unknown>
  updatedAt: number
}

export interface RemoteDoc extends DocRow {
  /** Server time the doc last changed (ISO), used as the pull cursor. */
  syncedAt: string
}

export interface RemoteEvent {
  seq: number
  event: GameEvent
  createdAt: string
}

/** What the sync engine needs from a server. Supabase implements it; tests use an in-memory fake. */
export interface SyncBackend {
  pushDocs(docs: DocRow[]): Promise<void>
  /** Returns the server order (`seq`) for every event, including ones the server already had. */
  pushEvents(events: GameEvent[]): Promise<Map<string, number>>
  /** Docs changed at or after `since` (everything when null). */
  pullDocs(since: string | null): Promise<RemoteDoc[]>
  /** Events created at or after `since` (everything when null). */
  pullEvents(since: string | null): Promise<RemoteEvent[]>
  /** Live changes from other devices. Returns an unsubscribe function. */
  subscribe(handlers: { doc: (d: RemoteDoc) => void; event: (e: RemoteEvent) => void; status: (live: boolean) => void }): () => void
}

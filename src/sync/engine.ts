import { db as defaultDb, type DocKind, type TrackerDB } from '../data/db'
import type { Row } from '../data/types'
import type { GameEvent } from '../game/events'
import type { DocRow, RemoteDoc, RemoteEvent, SyncBackend } from './backend'

/**
 * Pulls re-read this much before the last cursor. Server timestamps are assigned when a row is
 * written, not when its transaction commits, so a slow write can land "in the past"; the
 * overlap catches it. Re-applying rows we already have is harmless.
 */
const OVERLAP_MS = 30_000

const DOC_KINDS: DocKind[] = ['player', 'deck', 'game']

export class SyncEngine {
  private running: Promise<void> | null = null
  private again = false

  constructor(
    private backend: SyncBackend,
    private store: TrackerDB = defaultDb,
  ) {}

  /** Push local changes, then pull remote ones. Calls made while a sync runs are folded into one more pass. */
  sync(): Promise<void> {
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = (async () => {
      try {
        do {
          this.again = false
          await this.adoptLocalData()
          await this.push()
          await this.pull()
        } while (this.again)
      } finally {
        this.running = null
      }
    })()
    return this.running
  }

  /** Live updates from other devices, applied straight into the local store. */
  subscribe(onStatus: (live: boolean) => void): () => void {
    return this.backend.subscribe({
      doc: (d) => void this.applyDocs([d]),
      event: (e) => void this.applyEvents([e]),
      status: onStatus,
    })
  }

  async pendingCount(): Promise<number> {
    return this.store.outbox.count()
  }

  /**
   * The first time a device syncs, queue everything it already has. A pod can start on one
   * phone without sync and turn it on later without losing those games.
   */
  private async adoptLocalData() {
    if (await this.getMeta('adopted')) return
    await this.store.transaction('rw', [this.store.players, this.store.decks, this.store.games, this.store.events, this.store.outbox, this.store.meta], async () => {
      for (const kind of DOC_KINDS) {
        const ids = (await this.store.docTable(kind).toCollection().primaryKeys()) as string[]
        await this.store.outbox.bulkPut(ids.map((id) => ({ key: `${kind}:${id}`, kind, id })))
      }
      const eventIds = (await this.store.events.toCollection().primaryKeys()) as string[]
      await this.store.outbox.bulkPut(eventIds.map((id) => ({ key: `event:${id}`, kind: 'event' as const, id })))
      await this.store.meta.put({ key: 'adopted', value: '1' })
    })
  }

  private async push() {
    const entries = await this.store.outbox.toArray()
    if (!entries.length) return

    const docs: DocRow[] = []
    const pushedVersion = new Map<string, number>()
    for (const kind of DOC_KINDS) {
      const mine = entries.filter((e) => e.kind === kind)
      const rows = await this.store.docTable(kind).bulkGet(mine.map((e) => e.id))
      rows.forEach((row, i) => {
        if (!row) return
        docs.push({ kind, id: row.id, data: row as unknown as DocRow['data'], updatedAt: row.updatedAt })
        pushedVersion.set(mine[i].key, row.updatedAt)
      })
    }
    const eventEntries = entries.filter((e) => e.kind === 'event')
    const events = (await this.store.events.bulkGet(eventEntries.map((e) => e.id))).filter((e): e is GameEvent => !!e)

    // Docs first: a game row must exist before other devices see its events.
    await this.backend.pushDocs(docs)
    const seqs = await this.backend.pushEvents(events)

    await this.store.transaction('rw', [this.store.outbox, this.store.events, this.store.players, this.store.decks, this.store.games], async () => {
      for (const e of eventEntries) {
        const seq = seqs.get(e.id)
        if (seq !== undefined) await this.store.events.update(e.id, { seq })
        await this.store.outbox.delete(e.key)
      }
      for (const e of entries) {
        if (e.kind === 'event') continue
        const row = await this.store.docTable(e.kind).get(e.id)
        // Leave it queued if it was edited again while we were pushing.
        if (!row || row.updatedAt === pushedVersion.get(e.key)) await this.store.outbox.delete(e.key)
      }
    })
  }

  private async pull() {
    const docs = await this.backend.pullDocs(overlap(await this.getMeta('docsCursor')))
    if (docs.length) {
      await this.applyDocs(docs)
      await this.setMeta('docsCursor', maxIso(docs.map((d) => d.syncedAt)))
    }
    const events = await this.backend.pullEvents(overlap(await this.getMeta('eventsCursor')))
    if (events.length) {
      await this.applyEvents(events)
      await this.setMeta('eventsCursor', maxIso(events.map((e) => e.createdAt)))
    }
  }

  /** Last write wins, by the row's own `updatedAt`. */
  async applyDocs(docs: RemoteDoc[]) {
    for (const kind of DOC_KINDS) {
      const incoming = docs.filter((d) => d.kind === kind)
      if (!incoming.length) continue
      const table = this.store.docTable(kind)
      await this.store.transaction('rw', table, this.store.outbox, async () => {
        const locals = await table.bulkGet(incoming.map((d) => d.id))
        const newer = incoming.filter((d, i) => !locals[i] || locals[i]!.updatedAt < d.updatedAt)
        if (!newer.length) return
        await table.bulkPut(newer.map((d) => d.data as unknown as Row))
        // A newer remote version beats any unpushed local edit of the same row.
        await this.store.outbox.bulkDelete(newer.map((d) => `${kind}:${d.id}`))
      })
    }
  }

  /** Events are immutable: add the ones we don't have, and record server order on the ones we do. */
  async applyEvents(remote: RemoteEvent[]) {
    await this.store.transaction('rw', this.store.events, async () => {
      const locals = await this.store.events.bulkGet(remote.map((r) => r.event.id))
      const add: GameEvent[] = []
      for (let i = 0; i < remote.length; i++) {
        const local = locals[i]
        if (!local) add.push({ ...remote[i].event, seq: remote[i].seq })
        else if (local.seq !== remote[i].seq) await this.store.events.update(local.id, { seq: remote[i].seq })
      }
      if (add.length) await this.store.events.bulkPut(add)
    })
  }

  private async getMeta(key: string): Promise<string | null> {
    return (await this.store.meta.get(key))?.value ?? null
  }

  private async setMeta(key: string, value: string) {
    await this.store.meta.put({ key, value })
  }
}

function overlap(cursor: string | null): string | null {
  if (!cursor) return null
  const t = Date.parse(cursor)
  return Number.isNaN(t) ? null : new Date(t - OVERLAP_MS).toISOString()
}

function maxIso(values: string[]): string {
  return values.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a))
}

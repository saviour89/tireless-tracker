import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { TrackerDB } from '../data/db'
import type { Game, Player } from '../data/types'
import type { GameEvent } from '../game/events'
import type { DocRow, RemoteDoc, RemoteEvent, SyncBackend } from './backend'
import { SyncEngine } from './engine'

/** In-memory server with the same semantics as the Supabase functions. */
class FakeServer implements SyncBackend {
  docs = new Map<string, RemoteDoc>()
  events: RemoteEvent[] = []
  clock = Date.parse('2026-10-15T12:00:00Z')
  listeners: Parameters<SyncBackend['subscribe']>[0][] = []

  private tick() {
    this.clock += 1000
    return new Date(this.clock).toISOString()
  }
  async pushDocs(docs: DocRow[]) {
    for (const d of docs) {
      const key = `${d.kind}:${d.id}`
      const cur = this.docs.get(key)
      if (cur && cur.updatedAt >= d.updatedAt) continue
      const doc = { ...structuredClone(d), syncedAt: this.tick() }
      this.docs.set(key, doc)
      this.listeners.forEach((l) => l.doc(doc))
    }
  }
  async pushEvents(events: GameEvent[]) {
    const seqs = new Map<string, number>()
    for (const e of events) {
      let row = this.events.find((r) => r.event.id === e.id)
      if (!row) {
        const { seq: _seq, ...data } = e
        row = { seq: this.events.length + 1, event: { ...data, seq: this.events.length + 1 } as GameEvent, createdAt: this.tick() }
        this.events.push(row)
        this.listeners.forEach((l) => l.event(row!))
      }
      seqs.set(e.id, row.seq)
    }
    return seqs
  }
  async pullDocs(since: string | null) {
    return [...this.docs.values()].filter((d) => !since || d.syncedAt >= since)
  }
  async pullEvents(since: string | null) {
    return this.events.filter((e) => !since || e.createdAt >= since)
  }
  subscribe(h: Parameters<SyncBackend['subscribe']>[0]) {
    this.listeners.push(h)
    h.status(true)
    return () => (this.listeners = this.listeners.filter((l) => l !== h))
  }
}

let n = 0
function device(server: FakeServer) {
  const store = new TrackerDB(`test-${n++}`)
  return { store, engine: new SyncEngine(server, store) }
}

async function localWrite(store: TrackerDB, kind: 'player' | 'game', row: Player | Game) {
  await (kind === 'player' ? store.players.put(row as Player) : store.games.put(row as Game))
  await store.outbox.put({ key: `${kind}:${row.id}`, kind, id: row.id })
}

async function localEvent(store: TrackerDB, e: GameEvent) {
  await store.events.put(e)
  await store.outbox.put({ key: `event:${e.id}`, kind: 'event', id: e.id })
}

const player = (id: string, name: string, updatedAt: number): Player => ({ id, name, color: 'sky', createdAt: 1, updatedAt })
const game: Game = { id: 'g1', createdAt: 1, updatedAt: 1, status: 'active', mode: 'multi', startingLife: 40, seats: [] }
const ev = (id: string, at: number): GameEvent => ({ id, gameId: 'g1', at, deviceId: 'x', type: 'life', target: 0, amount: -1 })

describe('SyncEngine', () => {
  it('moves docs and events between devices and assigns server order', async () => {
    const server = new FakeServer()
    const a = device(server)
    const b = device(server)
    await localWrite(a.store, 'player', player('p1', 'Ben', 10))
    await localWrite(a.store, 'game', game)
    await localEvent(a.store, ev('e1', 100))
    await a.engine.sync()

    expect(await a.store.outbox.count()).toBe(0)
    expect((await a.store.events.get('e1'))?.seq).toBe(1)

    await b.engine.sync()
    expect((await b.store.players.get('p1'))?.name).toBe('Ben')
    expect(await b.store.games.get('g1')).toBeTruthy()
    expect((await b.store.events.get('e1'))?.seq).toBe(1)
  })

  it('keeps the newest edit when two devices change the same row', async () => {
    const server = new FakeServer()
    const a = device(server)
    const b = device(server)
    await localWrite(a.store, 'player', player('p1', 'Ben', 10))
    await a.engine.sync()
    await b.engine.sync()

    await localWrite(a.store, 'player', player('p1', 'Benjamin', 20))
    await localWrite(b.store, 'player', player('p1', 'Benny', 30))
    await a.engine.sync()
    await b.engine.sync()
    await a.engine.sync()

    expect((await a.store.players.get('p1'))?.name).toBe('Benny')
    expect((await b.store.players.get('p1'))?.name).toBe('Benny')
    expect(await a.store.outbox.count()).toBe(0)
  })

  it('applies live updates from other devices without a pull', async () => {
    const server = new FakeServer()
    const a = device(server)
    const b = device(server)
    b.engine.subscribe(() => {})
    await localEvent(a.store, ev('e1', 100))
    await a.engine.sync()
    await new Promise((r) => setTimeout(r, 20))
    expect((await b.store.events.get('e1'))?.seq).toBe(1)
  })

  it('queues data that existed before sync was turned on', async () => {
    const server = new FakeServer()
    const store = new TrackerDB(`test-${n++}`)
    await store.players.put(player('old', 'Pre-sync', 5))
    await store.events.put(ev('old-e', 1))
    await new SyncEngine(server, store).sync()
    expect(server.docs.has('player:old')).toBe(true)
    expect(server.events).toHaveLength(1)
  })

  it('does not lose an edit made while a push is in flight', async () => {
    const server = new FakeServer()
    const a = device(server)
    await localWrite(a.store, 'player', player('p1', 'Ben', 10))
    const origPush = server.pushDocs.bind(server)
    server.pushDocs = async (docs) => {
      await origPush(docs)
      // The user edits again before the push finishes.
      await localWrite(a.store, 'player', player('p1', 'Ben 2', 20))
    }
    await a.engine.sync()
    expect(await a.store.outbox.count()).toBe(1)
    server.pushDocs = origPush
    await a.engine.sync()
    expect(server.docs.get('player:p1')?.data).toMatchObject({ name: 'Ben 2' })
  })
})

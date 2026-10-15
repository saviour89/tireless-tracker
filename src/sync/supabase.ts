import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DocKind } from '../data/db'
import type { GameEvent } from '../game/events'
import type { DocRow, RemoteDoc, RemoteEvent, SyncBackend } from './backend'

import { SUPABASE_KEY, SUPABASE_URL, syncConfigured } from './config'

let client: SupabaseClient | null = null
export function supabase(): SupabaseClient {
  if (!syncConfigured) throw new Error('Supabase is not configured')
  client ??= createClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { persistSession: true, autoRefreshToken: true } })
  return client
}

const PAGE = 1000

interface DocRecord {
  kind: DocKind
  id: string
  data: RemoteDoc['data']
  updated_at: number
  synced_at: string
}

interface EventRecord {
  seq: number
  id: string
  data: GameEvent
  created_at: string
}

const toDoc = (r: DocRecord): RemoteDoc => ({ kind: r.kind, id: r.id, data: r.data, updatedAt: Number(r.updated_at), syncedAt: r.synced_at })
const toEvent = (r: EventRecord): RemoteEvent => ({ seq: Number(r.seq), event: { ...r.data, seq: Number(r.seq) }, createdAt: r.created_at })

/** Strips local-only fields before an event goes to the server. */
function eventPayload(e: GameEvent) {
  const { seq: _seq, ...rest } = e
  return rest
}

export class SupabaseBackend implements SyncBackend {
  constructor(private sb: SupabaseClient = supabase()) {}

  async pushDocs(docs: DocRow[]) {
    if (!docs.length) return
    const rows = docs.map((d) => ({ kind: d.kind, id: d.id, data: d.data, updated_at: d.updatedAt }))
    const { error } = await this.sb.rpc('push_docs', { rows })
    if (error) throw error
  }

  async pushEvents(events: GameEvent[]) {
    const seqs = new Map<string, number>()
    if (!events.length) return seqs
    const rows = events.map((e) => ({ id: e.id, game_id: e.gameId, data: eventPayload(e) }))
    const { data, error } = await this.sb.rpc('push_events', { rows })
    if (error) throw error
    for (const r of (data ?? []) as { id: string; seq: number }[]) seqs.set(r.id, Number(r.seq))
    return seqs
  }

  async pullDocs(since: string | null) {
    const out: RemoteDoc[] = []
    for (let from = 0; ; from += PAGE) {
      let q = this.sb.from('docs').select('kind,id,data,updated_at,synced_at').order('synced_at').range(from, from + PAGE - 1)
      if (since) q = q.gte('synced_at', since)
      const { data, error } = await q
      if (error) throw error
      out.push(...(data as DocRecord[]).map(toDoc))
      if (!data || data.length < PAGE) return out
    }
  }

  async pullEvents(since: string | null) {
    const out: RemoteEvent[] = []
    for (let from = 0; ; from += PAGE) {
      let q = this.sb.from('events').select('seq,id,data,created_at').order('seq').range(from, from + PAGE - 1)
      if (since) q = q.gte('created_at', since)
      const { data, error } = await q
      if (error) throw error
      out.push(...(data as EventRecord[]).map(toEvent))
      if (!data || data.length < PAGE) return out
    }
  }

  subscribe(handlers: Parameters<SyncBackend['subscribe']>[0]) {
    const channel = this.sb
      .channel('tracker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, (p) => {
        if (p.new && 'id' in p.new) handlers.doc(toDoc(p.new as DocRecord))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (p) => {
        handlers.event(toEvent(p.new as EventRecord))
      })
      .subscribe((status) => handlers.status(status === 'SUBSCRIBED'))
    return () => {
      void this.sb.removeChannel(channel)
    }
  }

  async serverNow(): Promise<number> {
    const { data, error } = await this.sb.rpc('server_now')
    if (error) throw error
    return Number(data)
  }
}

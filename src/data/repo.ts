import type { GameEvent, GameEventBody } from '../game/events'
import { project } from '../game/project'
import { summarize } from '../game/summary'
import { now } from '../lib/clock'
import { deviceId, newId } from '../lib/ids'
import { db, type DocKind } from './db'
import type { Deck, Game, Player, Seat } from './types'

/**
 * All local writes go through here. Each one also queues the row in the outbox, in the same
 * transaction, so the sync engine pushes it to the server whenever there's a connection.
 */

type Listener = () => void
const listeners = new Set<Listener>()

/** Called after every local write; the sync engine uses it to push soon. */
export function onLocalWrite(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

async function write<T>(kind: DocKind | 'event', id: string, fn: () => Promise<T>): Promise<T> {
  const table = kind === 'event' ? db.events : db.docTable(kind)
  const result = await db.transaction('rw', table, db.outbox, async () => {
    const r = await fn()
    await db.outbox.put({ key: `${kind}:${id}`, kind, id })
    return r
  })
  listeners.forEach((l) => l())
  return result
}

function stamp<T extends object>(fields: T) {
  const t = now()
  return { id: newId(), createdAt: t, updatedAt: t, ...fields }
}

export async function createPlayer(name: string, color: string): Promise<Player> {
  const player: Player = stamp({ name: name.trim(), color })
  await write('player', player.id, () => db.players.add(player))
  return player
}

export async function updatePlayer(id: string, changes: Partial<Pick<Player, 'name' | 'color' | 'deleted'>>) {
  await write('player', id, () => db.players.update(id, { ...changes, updatedAt: now() }))
}

export async function saveDeck(deck: Omit<Deck, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Deck> {
  const t = now()
  const existing = deck.id ? await db.decks.get(deck.id) : undefined
  const row: Deck = existing
    ? { ...existing, ...deck, id: existing.id, updatedAt: t }
    : { ...deck, id: newId(), createdAt: t, updatedAt: t }
  await write('deck', row.id, () => db.decks.put(row))
  return row
}

export async function updateDeck(id: string, changes: Partial<Pick<Deck, 'retired' | 'deleted'>>) {
  await write('deck', id, () => db.decks.update(id, { ...changes, updatedAt: now() }))
}

export async function createGame(seats: Seat[], startingLife: number, mode: Game['mode']): Promise<Game> {
  const game: Game = stamp({ status: 'active' as const, mode, startingLife, seats })
  await write('game', game.id, () => db.games.add(game))
  return game
}

async function updateGame(id: string, changes: Partial<Game>) {
  await write('game', id, () => db.games.update(id, { ...changes, updatedAt: now() }))
}

export async function appendEvent(gameId: string, body: GameEventBody): Promise<GameEvent> {
  const event = { ...body, id: newId(), gameId, at: now(), deviceId: deviceId() } as GameEvent
  await write('event', event.id, () => db.events.add(event))
  return event
}

export async function gameEvents(gameId: string): Promise<GameEvent[]> {
  return db.events.where('gameId').equals(gameId).toArray()
}

/**
 * Replays the game and stores its summary. Call after the game ends (or an end is undone) so
 * history and stats stay in line with the event log.
 */
export async function refreshGameResult(gameId: string) {
  const game = await db.games.get(gameId)
  if (!game || game.status === 'abandoned') return
  const state = project(await gameEvents(gameId), { seatCount: game.seats.length, startingLife: game.startingLife })
  const summary = summarize(state) ?? undefined
  const status = summary ? 'finished' : 'active'
  if (status === game.status && JSON.stringify(summary) === JSON.stringify(game.summary)) return
  await updateGame(gameId, { status, summary, endedAt: summary?.endedAt })
}

export async function abandonGame(gameId: string) {
  await updateGame(gameId, { status: 'abandoned' })
}

export async function deleteGame(gameId: string) {
  await updateGame(gameId, { deleted: true })
}

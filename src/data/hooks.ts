import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { project, type GameState } from '../game/project'
import { db } from './db'
import type { Deck, Game, Player } from './types'

export function usePlayers(): Player[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.players.toArray()
    return all.filter((p) => !p.deleted).sort((a, b) => a.name.localeCompare(b.name))
  })
}

export function useDecks(): Deck[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.decks.toArray()
    return all.filter((d) => !d.deleted).sort((a, b) => a.name.localeCompare(b.name))
  })
}

/** Lookup maps, including deleted rows so old games still show names. */
export function useLookups() {
  const players = useLiveQuery(() => db.players.toArray())
  const decks = useLiveQuery(() => db.decks.toArray())
  return useMemo(
    () => ({
      ready: players !== undefined && decks !== undefined,
      player: new Map((players ?? []).map((p) => [p.id, p])),
      deck: new Map((decks ?? []).map((d) => [d.id, d])),
    }),
    [players, decks],
  )
}

export type Lookups = ReturnType<typeof useLookups>

export function useGames(): Game[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.games.orderBy('createdAt').reverse().toArray()
    return all.filter((g) => !g.deleted)
  })
}

/** `null` once loaded if the game doesn't exist. */
export function useGame(id: string | undefined): Game | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.games.get(id)) ?? null) : null), [id])
}

export function useGameState(game: Game | null | undefined): { state: GameState | undefined; loading: boolean } {
  const events = useLiveQuery(() => (game ? db.events.where('gameId').equals(game.id).toArray() : []), [game?.id])
  const seatCount = game?.seats.length ?? 0
  const startingLife = game?.startingLife ?? 40
  const state = useMemo(
    () => (game && events ? project(events, { seatCount, startingLife }) : undefined),
    [events, game, seatCount, startingLife],
  )
  return { state, loading: events === undefined }
}

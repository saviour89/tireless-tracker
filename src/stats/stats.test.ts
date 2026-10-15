import { describe, expect, it } from 'vitest'
import type { Game } from '../data/types'
import type { GameEvent, GameEventBody } from '../game/events'
import { project } from '../game/project'
import { summarize } from '../game/summary'
import { computeStats, favoriteVictim, nemesis, winRate } from './stats'

function playGame(id: string, seats: [string, string][], bodies: [number, GameEventBody][]): Game {
  const events = bodies.map(([sec, b], i) => ({ id: `${id}-${i}`, gameId: id, at: sec * 1000, deviceId: 'd', ...b }) as GameEvent)
  const state = project(events, { seatCount: seats.length, startingLife: 40 })
  return {
    id,
    createdAt: 0,
    updatedAt: 0,
    status: 'finished',
    mode: 'table',
    startingLife: 40,
    seats: seats.map(([playerId, deckId]) => ({ playerId, deckId })),
    summary: summarize(state)!,
  }
}

const seats: [string, string][] = [
  ['ann', 'atraxa'],
  ['bob', 'yuriko'],
  ['cat', 'korvold'],
]

const g1 = playGame('g1', seats, [
  [0, { type: 'start', firstSeat: 0 }],
  [30, { type: 'life', target: 1, amount: -40, source: 2, commander: 0 }],
  [31, { type: 'eliminate', target: 1, cause: 'damage', by: 2 }],
  [60, { type: 'end', winners: [2], winType: 'combo', card: 'Food Chain' }],
])
const g2 = playGame('g2', seats, [
  [0, { type: 'start', firstSeat: 1 }],
  [20, { type: 'eliminate', target: 0, cause: 'commander', by: 2 }],
  [40, { type: 'eliminate', target: 1, cause: 'concede' }],
  [41, { type: 'end', winners: [2], winType: 'last_standing' }],
])

describe('computeStats', () => {
  const stats = computeStats([g1, g2])

  it('ranks players by win rate', () => {
    expect(stats.players.map((p) => p.id)).toEqual(['cat', 'ann', 'bob'])
    const cat = stats.players[0]
    expect(winRate(cat)).toBe(1)
    expect(cat).toMatchObject({ kills: 3, comboWins: 1, damage: 40, commander: 40 })
  })

  it('tracks kills, nemeses and causes', () => {
    expect(stats.kills.cat).toEqual({ bob: 1, ann: 2 })
    expect(nemesis(stats, 'ann')).toEqual({ id: 'cat', count: 2 })
    expect(favoriteVictim(stats, 'cat')).toEqual({ id: 'ann', count: 2 })
    expect(stats.causes).toMatchObject({ damage: 1, commander: 1, concede: 1, combo: 1 })
  })

  it('counts wins by turn position and per deck', () => {
    // g1: cat was 3rd (first=0). g2: cat was 2nd (first=1).
    expect(stats.positions.map((p) => p.wins)).toEqual([0, 1, 1])
    expect(stats.decks.find((d) => d.id === 'korvold')).toMatchObject({ wins: 2, ownerId: 'cat' })
    expect(stats.winTypes).toEqual({ combo: 1, last_standing: 1 })
    expect(stats.records.fastestWin?.playerId).toBe('cat')
  })
})

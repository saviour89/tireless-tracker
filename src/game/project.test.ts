import { describe, expect, it } from 'vitest'
import type { GameEvent, GameEventBody } from './events'
import { activeTurnMs, gameElapsedMs, project, threatFor } from './project'
import { summarize } from './summary'

/** Builds events with increasing ids and the given timestamps (seconds). */
function log(...items: [number, GameEventBody][]): GameEvent[] {
  return items.map(([sec, body], i) => ({ id: `e${i}`, gameId: 'g', at: sec * 1000, deviceId: 'd', ...body }))
}

const opts = { seatCount: 4, startingLife: 40 }

describe('life and damage', () => {
  it('tracks life, attributed damage and commander damage', () => {
    const s = project(
      log(
        [0, { type: 'life', target: 1, amount: -5, source: 0 }],
        [1, { type: 'life', target: 1, amount: -7, source: 2, commander: 0 }],
        [2, { type: 'life', target: 1, amount: 3 }],
        [3, { type: 'life', target: 2, amount: -2 }],
      ),
      opts,
    )
    expect(s.seats[1].life).toBe(31)
    expect(s.seats[2].life).toBe(38)
    expect(s.seats[0].dealt).toEqual({ damage: 5, commander: 0, poison: 0 })
    expect(s.seats[2].dealt).toEqual({ damage: 7, commander: 7, poison: 0 })
    expect(s.seats[1].commanderDamage[2][0]).toBe(7)
    expect(s.seats[1].lastDamageBy).toBe(2)
  })

  it('treats positive attributed changes as corrections', () => {
    const s = project(
      log(
        [0, { type: 'life', target: 1, amount: -6, source: 0, commander: 1 }],
        [1, { type: 'life', target: 1, amount: 2, source: 0, commander: 1 }],
      ),
      opts,
    )
    expect(s.seats[1].life).toBe(36)
    expect(s.seats[1].commanderDamage[0][1]).toBe(4)
    expect(s.seats[0].dealt.commander).toBe(4)
  })

  it('infect commanders give poison and commander damage without life loss', () => {
    const s = project(log([0, { type: 'poison', target: 3, amount: 4, source: 1, commander: 0 }]), opts)
    expect(s.seats[3].life).toBe(40)
    expect(s.seats[3].poison).toBe(4)
    expect(s.seats[3].commanderDamage[1][0]).toBe(4)
  })
})

describe('turns', () => {
  it('times turns, skips pauses and counts rounds from the first player', () => {
    const s = project(
      log(
        [0, { type: 'start', firstSeat: 2 }],
        [60, { type: 'pass', turn: 1 }], // seat 2: 60s
        [100, { type: 'pause' }],
        [400, { type: 'resume' }],
        [130, { type: 'pass', turn: 2 }], // out-of-order timestamp is clamped, not negative
      ),
      opts,
    )
    expect(s.turns[0]).toMatchObject({ seat: 2, ms: 60_000, round: 1 })
    expect(s.activeSeat).toBe(0)
    expect(s.round).toBe(1)

    const s2 = project(
      log(
        [0, { type: 'start', firstSeat: 2 }],
        [10, { type: 'pass', turn: 1 }],
        [20, { type: 'pass', turn: 2 }],
        [30, { type: 'pass', turn: 3 }],
        [40, { type: 'pass', turn: 4 }],
      ),
      opts,
    )
    expect(s2.turns.map((t) => t.seat)).toEqual([2, 3, 0, 1])
    expect(s2.activeSeat).toBe(2)
    expect(s2.round).toBe(2)
    expect(s2.turn).toBe(5)
  })

  it('ignores a duplicate pass for the same turn', () => {
    const s = project(
      log(
        [0, { type: 'start', firstSeat: 0 }],
        [10, { type: 'pass', turn: 1 }],
        [10, { type: 'pass', turn: 1 }],
      ),
      opts,
    )
    expect(s.activeSeat).toBe(1)
    expect(s.effective.filter((e) => e.type === 'pass')).toHaveLength(1)
  })

  it('excludes pause time from the live turn timer and game length', () => {
    const s = project(
      log(
        [0, { type: 'start', firstSeat: 0 }],
        [30, { type: 'pause' }],
      ),
      opts,
    )
    expect(activeTurnMs(s, 500_000)).toBe(30_000)
    expect(gameElapsedMs(s, 500_000)).toBe(30_000)
  })

  it('passing the turn while paused resumes the game', () => {
    const s = project(
      log(
        [0, { type: 'start', firstSeat: 0 }],
        [20, { type: 'pause' }],
        [80, { type: 'pass', turn: 1 }],
      ),
      opts,
    )
    expect(s.paused).toBe(false)
    expect(s.turns[0].ms).toBe(20_000)
    expect(s.totalPausedMs).toBe(60_000)
  })

  it('moves the turn on when the active player is eliminated, skipping dead seats', () => {
    const s = project(
      log(
        [0, { type: 'start', firstSeat: 0 }],
        [5, { type: 'eliminate', target: 1, cause: 'concede' }],
        [10, { type: 'eliminate', target: 0, cause: 'damage', by: 3 }],
      ),
      opts,
    )
    expect(s.activeSeat).toBe(2)
    expect(s.seats[0]).toMatchObject({ alive: false, killer: 3, eliminatedTurn: 1 })
  })
})

describe('undo', () => {
  it('cancels the targeted event', () => {
    const events = log(
      [0, { type: 'life', target: 0, amount: -10, source: 1 }],
      [1, { type: 'life', target: 0, amount: -3 }],
    )
    events.push({ id: 'u', gameId: 'g', at: 2000, deviceId: 'd', type: 'undo', eventId: 'e0' })
    const s = project(events, opts)
    expect(s.seats[0].life).toBe(37)
    expect(s.seats[1].dealt.damage).toBe(0)
    expect(s.effective.map((e) => e.id)).toEqual(['e1'])
  })

  it('reopens a finished game when the end is undone', () => {
    const events = log(
      [0, { type: 'start', firstSeat: 0 }],
      [10, { type: 'end', winners: [0], winType: 'combo' }],
    )
    events.push({ id: 'u', gameId: 'g', at: 20_000, deviceId: 'd', type: 'undo', eventId: 'e1' })
    const s = project(events, opts)
    expect(s.ended).toBe(false)
    expect(s.seats.every((x) => x.alive)).toBe(true)
  })
})

describe('eliminations and the end', () => {
  it('suggests eliminations with the likely killer', () => {
    const s = project(
      log(
        [0, { type: 'life', target: 1, amount: -21, source: 3, commander: 0 }],
        [1, { type: 'poison', target: 2, amount: 10, source: 0 }],
        [2, { type: 'life', target: 0, amount: -40, source: 2 }],
      ),
      opts,
    )
    expect(threatFor(s, 1)).toMatchObject({ cause: 'commander', killer: 3 })
    expect(threatFor(s, 2)).toMatchObject({ cause: 'poison', killer: 0 })
    expect(threatFor(s, 0)).toMatchObject({ cause: 'damage', killer: 2 })
    expect(threatFor(s, 3)).toBeNull()
  })

  it('a combo win eliminates everyone left and records places', () => {
    const s = project(
      log(
        [0, { type: 'start', firstSeat: 0 }],
        [100, { type: 'eliminate', target: 3, cause: 'damage', by: 1 }],
        [200, { type: 'end', winners: [1], winType: 'combo', card: "Thassa's Oracle" }],
      ),
      opts,
    )
    expect(s.ended).toBe(true)
    expect(s.seats.map((x) => x.place)).toEqual([2, 1, 2, 4])
    expect(s.seats[0]).toMatchObject({ cause: 'combo', killer: 1 })

    const summary = summarize(s)!
    expect(summary.winners).toEqual([1])
    expect(summary.card).toBe("Thassa's Oracle")
    expect(summary.durationMs).toBe(200_000)
    expect(summary.seats[1].won).toBe(true)
  })

  it('ignores events after the game ended', () => {
    const s = project(
      log(
        [0, { type: 'end', winners: [0], winType: 'last_standing' }],
        [1, { type: 'life', target: 0, amount: -5 }],
      ),
      opts,
    )
    expect(s.seats[0].life).toBe(40)
  })

  it('a draw has no winners', () => {
    const s = project(log([0, { type: 'start', firstSeat: 0 }], [9, { type: 'end', winners: [], winType: 'draw' }]), opts)
    expect(s.winners).toEqual([])
    expect(s.seats.every((x) => !x.alive)).toBe(true)
  })
})

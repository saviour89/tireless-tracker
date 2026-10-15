import type { Game } from '../data/types'
import type { EliminationCause, WinType } from '../game/events'

/** Totals for one player or one deck. */
export interface Totals {
  id: string
  games: number
  wins: number
  placeSum: number
  kills: number
  /** Times eliminated by an opponent (concessions and unattributed losses don't count). */
  deaths: number
  damage: number
  commander: number
  poison: number
  comboWins: number
  altWins: number
  turns: number
  turnMs: number
  longestTurnMs: number
  wentFirst: number
  lastPlayed: number
}

export interface DeckTotals extends Totals {
  ownerId: string
}

export interface GameRef {
  gameId: string
  playerId: string
  value: number
}

export interface Stats {
  games: number
  totalMs: number
  totalRounds: number
  totalTurns: number
  totalTurnMs: number
  players: Totals[]
  decks: DeckTotals[]
  /** kills[killerPlayerId][victimPlayerId] */
  kills: Record<string, Record<string, number>>
  winTypes: Partial<Record<WinType, number>>
  causes: Partial<Record<EliminationCause, number>>
  /** Wins by position in turn order: index 0 went first. */
  positions: { games: number; wins: number }[]
  records: {
    longestGame?: GameRef
    shortestGame?: GameRef
    longestTurn?: GameRef
    mostDamage?: GameRef
    fastestWin?: GameRef
  }
}

function blank(id: string): Totals {
  return {
    id,
    games: 0,
    wins: 0,
    placeSum: 0,
    kills: 0,
    deaths: 0,
    damage: 0,
    commander: 0,
    poison: 0,
    comboWins: 0,
    altWins: 0,
    turns: 0,
    turnMs: 0,
    longestTurnMs: 0,
    wentFirst: 0,
    lastPlayed: 0,
  }
}

export function finishedGames(games: Game[], sinceMs?: number): Game[] {
  return games.filter((g) => g.status === 'finished' && g.summary && !g.deleted && (sinceMs === undefined || g.createdAt >= sinceMs))
}

export function computeStats(games: Game[]): Stats {
  const players = new Map<string, Totals>()
  const decks = new Map<string, DeckTotals>()
  const kills: Stats['kills'] = {}
  const stats: Stats = {
    games: 0,
    totalMs: 0,
    totalRounds: 0,
    totalTurns: 0,
    totalTurnMs: 0,
    players: [],
    decks: [],
    kills,
    winTypes: {},
    causes: {},
    positions: [],
    records: {},
  }
  const better = (key: keyof Stats['records'], ref: GameRef, higherWins: boolean) => {
    const cur = stats.records[key]
    if (!cur || (higherWins ? ref.value > cur.value : ref.value < cur.value)) stats.records[key] = ref
  }

  for (const g of games) {
    const s = g.summary
    if (!s) continue
    const n = g.seats.length
    stats.games++
    stats.totalMs += s.durationMs
    stats.totalRounds += s.rounds
    stats.totalTurns += s.turns
    stats.winTypes[s.winType] = (stats.winTypes[s.winType] ?? 0) + 1
    const winnerPid = s.winners.length === 1 ? g.seats[s.winners[0]]?.playerId : undefined
    better('longestGame', { gameId: g.id, playerId: winnerPid ?? '', value: s.durationMs }, true)
    if (s.turns > 0) better('shortestGame', { gameId: g.id, playerId: winnerPid ?? '', value: s.durationMs }, false)
    if (winnerPid && s.rounds > 0) better('fastestWin', { gameId: g.id, playerId: winnerPid, value: s.rounds }, false)

    g.seats.forEach((seat, i) => {
      const ss = s.seats[i]
      if (!ss) return
      const totals = [players.get(seat.playerId) ?? blank(seat.playerId)]
      players.set(seat.playerId, totals[0])
      if (seat.deckId) {
        const d = decks.get(seat.deckId) ?? { ...blank(seat.deckId), ownerId: seat.playerId }
        decks.set(seat.deckId, d)
        totals.push(d)
      }
      const position = (i - s.firstSeat + n) % n
      stats.positions[position] ??= { games: 0, wins: 0 }
      stats.positions[position].games++
      if (ss.won) stats.positions[position].wins++
      stats.totalTurnMs += ss.turnMs

      for (const t of totals) {
        t.games++
        if (ss.won) t.wins++
        t.placeSum += ss.place
        t.damage += ss.dealt.damage
        t.commander += ss.dealt.commander
        t.poison += ss.dealt.poison
        if (ss.won && s.winType === 'combo') t.comboWins++
        if (ss.won && s.winType === 'alt_win') t.altWins++
        t.turns += ss.turns
        t.turnMs += ss.turnMs
        t.longestTurnMs = Math.max(t.longestTurnMs, ss.longestTurnMs)
        if (position === 0) t.wentFirst++
        t.lastPlayed = Math.max(t.lastPlayed, g.createdAt)
      }

      if (!ss.won && ss.cause) stats.causes[ss.cause] = (stats.causes[ss.cause] ?? 0) + 1
      if (ss.killer !== undefined) {
        const killerSeat = g.seats[ss.killer]
        if (killerSeat) {
          kills[killerSeat.playerId] ??= {}
          kills[killerSeat.playerId][seat.playerId] = (kills[killerSeat.playerId][seat.playerId] ?? 0) + 1
          const killerTotals = players.get(killerSeat.playerId) ?? blank(killerSeat.playerId)
          players.set(killerSeat.playerId, killerTotals)
          killerTotals.kills++
          if (killerSeat.deckId) {
            const kd = decks.get(killerSeat.deckId) ?? { ...blank(killerSeat.deckId), ownerId: killerSeat.playerId }
            decks.set(killerSeat.deckId, kd)
            kd.kills++
          }
          for (const t of totals) t.deaths++
        }
      }
      better('longestTurn', { gameId: g.id, playerId: seat.playerId, value: ss.longestTurnMs }, true)
      better('mostDamage', { gameId: g.id, playerId: seat.playerId, value: ss.dealt.damage }, true)
    })
  }

  const byRecord = (a: Totals, b: Totals) => winRate(b) - winRate(a) || b.wins - a.wins || b.games - a.games
  stats.players = [...players.values()].filter((p) => p.games > 0).sort(byRecord)
  stats.decks = [...decks.values()].filter((d) => d.games > 0).sort(byRecord)
  for (let i = 0; i < stats.positions.length; i++) stats.positions[i] ??= { games: 0, wins: 0 }
  return stats
}

export function winRate(t: { games: number; wins: number }): number {
  return t.games ? t.wins / t.games : 0
}

export function avgTurnMs(t: { turns: number; turnMs: number }): number {
  return t.turns ? t.turnMs / t.turns : 0
}

/** The opponent who has eliminated `playerId` most often, and how many times. */
export function nemesis(stats: Stats, playerId: string): { id: string; count: number } | null {
  let best: { id: string; count: number } | null = null
  for (const [killer, victims] of Object.entries(stats.kills)) {
    const c = victims[playerId] ?? 0
    if (c > 0 && (!best || c > best.count)) best = { id: killer, count: c }
  }
  return best
}

/** The opponent `playerId` has eliminated most often. */
export function favoriteVictim(stats: Stats, playerId: string): { id: string; count: number } | null {
  let best: { id: string; count: number } | null = null
  for (const [victim, c] of Object.entries(stats.kills[playerId] ?? {})) {
    if (c > 0 && (!best || c > best.count)) best = { id: victim, count: c }
  }
  return best
}

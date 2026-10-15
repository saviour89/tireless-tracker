import type { EliminationCause, WinType } from './events'
import { gameElapsedMs, maxCommanderDamageTaken, type DealtTotals, type GameState } from './project'

export interface SeatSummary {
  place: number
  won: boolean
  life: number
  poison: number
  cause?: EliminationCause
  killer?: number
  eliminatedTurn?: number
  eliminatedRound?: number
  turns: number
  turnMs: number
  longestTurnMs: number
  dealt: DealtTotals
  /** Most commander damage this seat took from a single commander. */
  maxCommanderTaken: number
}

/** The compact result of a finished game, stored on the Game row so stats don't need to replay events. */
export interface GameSummary {
  startedAt: number
  endedAt: number
  /** Pauses excluded. */
  durationMs: number
  turns: number
  rounds: number
  firstSeat: number
  winners: number[]
  winType: WinType
  card?: string
  note?: string
  seats: SeatSummary[]
}

export function summarize(s: GameState): GameSummary | null {
  if (!s.ended || s.startedAt === undefined || s.endedAt === undefined || !s.winType) return null
  return {
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    durationMs: gameElapsedMs(s, s.endedAt),
    turns: s.turns.length,
    rounds: s.round,
    firstSeat: s.firstSeat ?? 0,
    winners: s.winners,
    winType: s.winType,
    card: s.card,
    note: s.note,
    seats: s.seats.map((seat, i) => ({
      place: seat.place ?? s.seats.length,
      won: s.winners.includes(i),
      life: seat.life,
      poison: seat.poison,
      cause: seat.cause,
      killer: seat.killer,
      eliminatedTurn: seat.eliminatedTurn,
      eliminatedRound: seat.eliminatedRound,
      turns: seat.turns,
      turnMs: seat.turnMs,
      longestTurnMs: seat.longestTurnMs,
      dealt: { ...seat.dealt },
      maxCommanderTaken: maxCommanderDamageTaken(seat),
    })),
  }
}

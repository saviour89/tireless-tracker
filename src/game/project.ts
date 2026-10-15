import {
  compareEvents,
  LETHAL_COMMANDER,
  LETHAL_POISON,
  type EliminationCause,
  type EventOf,
  type GameEvent,
  type WinType,
} from './events'

export interface DealtTotals {
  /** Net damage dealt to opponents' life totals, commander damage included. */
  damage: number
  /** The part of `damage` (or infect poison) dealt by this seat's commanders. */
  commander: number
  poison: number
}

export interface SeatState {
  life: number
  poison: number
  /** Commander damage taken, indexed [sourceSeat][commanderIndex]. */
  commanderDamage: number[][]
  /** Poison counters given by each source seat (the total is `poison`). */
  poisonFrom: number[]
  alive: boolean
  eliminatedAt?: number
  eliminatedTurn?: number
  eliminatedRound?: number
  cause?: EliminationCause
  killer?: number
  /** Finishing place, 1 = winner. Only set once the game has ended. */
  place?: number
  lastDamageBy?: number
  lastPoisonBy?: number
  dealt: DealtTotals
  turns: number
  turnMs: number
  longestTurnMs: number
}

export interface TurnRecord {
  turn: number
  round: number
  seat: number
  start: number
  /** Active time, pauses excluded. */
  ms: number
}

export interface GameState {
  started: boolean
  startedAt?: number
  firstSeat?: number
  seats: SeatState[]
  activeSeat: number | null
  /** Global turn counter, starting at 1. */
  turn: number
  round: number
  turnStartedAt: number
  /** Paused time within the current turn, not counting a pause still in progress. */
  turnPausedMs: number
  paused: boolean
  pausedAt?: number
  totalPausedMs: number
  turns: TurnRecord[]
  ended: boolean
  endedAt?: number
  winners: number[]
  winType?: WinType
  card?: string
  note?: string
  /** Events that took effect, in order. Undone, stale and undo events are left out. */
  effective: GameEvent[]
  undone: Set<string>
}

export interface ProjectOptions {
  seatCount: number
  startingLife: number
}

export function project(events: GameEvent[], opts: ProjectOptions): GameState {
  const sorted = [...events].sort(compareEvents)
  const byId = new Map(sorted.map((e) => [e.id, e]))
  const undone = new Set<string>()
  for (const e of sorted) {
    if (e.type !== 'undo') continue
    const target = byId.get(e.eventId)
    if (target && target.type !== 'undo') undone.add(target.id)
  }

  const s = initialState(opts)
  s.undone = undone
  for (const e of sorted) {
    if (e.type === 'undo' || undone.has(e.id)) continue
    if (apply(s, e)) s.effective.push(e)
  }
  return s
}

function initialState({ seatCount, startingLife }: ProjectOptions): GameState {
  return {
    started: false,
    seats: Array.from({ length: seatCount }, () => ({
      life: startingLife,
      poison: 0,
      commanderDamage: Array.from({ length: seatCount }, () => []),
      poisonFrom: Array.from({ length: seatCount }, () => 0),
      alive: true,
      dealt: { damage: 0, commander: 0, poison: 0 },
      turns: 0,
      turnMs: 0,
      longestTurnMs: 0,
    })),
    activeSeat: null,
    turn: 0,
    round: 0,
    turnStartedAt: 0,
    turnPausedMs: 0,
    paused: false,
    totalPausedMs: 0,
    turns: [],
    ended: false,
    winners: [],
    effective: [],
    undone: new Set(),
  }
}

/** Applies one event. Returns false if it had no effect. */
function apply(s: GameState, e: GameEvent): boolean {
  if (s.ended) return false
  switch (e.type) {
    case 'start':
      return applyStart(s, e)
    case 'life':
    case 'poison':
      return applyCounter(s, e)
    case 'pass':
      if (!s.started || s.activeSeat === null || e.turn !== s.turn) return false
      resume(s, e.at)
      advanceTurn(s, e.at)
      return true
    case 'pause':
      if (!s.started || s.paused) return false
      s.paused = true
      s.pausedAt = e.at
      return true
    case 'resume':
      if (!s.paused) return false
      resume(s, e.at)
      return true
    case 'eliminate':
      return applyEliminate(s, e)
    case 'end':
      return applyEnd(s, e)
    case 'undo':
      return false
  }
}

function applyStart(s: GameState, e: EventOf<'start'>): boolean {
  if (s.started || !s.seats[e.firstSeat]) return false
  s.started = true
  s.startedAt = e.at
  s.firstSeat = e.firstSeat
  s.turn = 1
  s.round = 1
  const first = s.seats[e.firstSeat].alive ? e.firstSeat : nextAlive(s, e.firstSeat)
  if (first !== null) startTurn(s, first, e.at)
  return true
}

function applyCounter(s: GameState, e: EventOf<'life'> | EventOf<'poison'>): boolean {
  const target = s.seats[e.target]
  if (!target || e.amount === 0) return false
  const source = e.source !== undefined && e.source !== e.target && s.seats[e.source] ? e.source : undefined

  if (e.type === 'life') target.life += e.amount
  else target.poison = Math.max(0, target.poison + e.amount)

  if (source === undefined) return true
  // "Net" damage: positive when the source hurt the target, negative for corrections.
  const net = e.type === 'life' ? -e.amount : e.amount
  const dealt = s.seats[source].dealt
  if (e.type === 'life') dealt.damage += net
  else {
    dealt.poison += net
    target.poisonFrom[source] = Math.max(0, target.poisonFrom[source] + net)
  }
  if (e.commander !== undefined && e.commander >= 0) {
    const row = target.commanderDamage[source]
    row[e.commander] = Math.max(0, (row[e.commander] ?? 0) + net)
    dealt.commander += net
  }
  if (net > 0) {
    if (e.type === 'life') target.lastDamageBy = source
    else target.lastPoisonBy = source
  }
  return true
}

function applyEliminate(s: GameState, e: EventOf<'eliminate'>): boolean {
  const target = s.seats[e.target]
  if (!target?.alive) return false
  eliminate(s, e.target, e.at, e.cause, e.by)
  if (s.activeSeat === e.target) advanceTurn(s, e.at)
  return true
}

function applyEnd(s: GameState, e: EventOf<'end'>): boolean {
  const winners = e.winType === 'draw' ? [] : [...new Set(e.winners)].filter((i) => s.seats[i]?.alive)
  if (e.winType !== 'draw' && winners.length === 0) return false

  endTurn(s, e.at)
  s.activeSeat = null
  if (s.paused && s.pausedAt !== undefined) s.totalPausedMs += Math.max(0, e.at - s.pausedAt)
  s.paused = false

  // Whoever is still in and didn't win lost to the winning play.
  const cause: EliminationCause =
    e.winType === 'combo' ? 'combo' : e.winType === 'alt_win' ? 'alt_win' : e.winType === 'draw' ? 'other' : 'concede'
  const killer = winners.length === 1 && cause !== 'concede' ? winners[0] : undefined
  s.seats.forEach((seat, i) => {
    if (seat.alive && !winners.includes(i)) eliminate(s, i, e.at, cause, killer)
  })

  s.ended = true
  s.endedAt = e.at
  s.winners = winners
  s.winType = e.winType
  s.card = e.card
  s.note = e.note
  assignPlaces(s)
  return true
}

function eliminate(s: GameState, seat: number, at: number, cause: EliminationCause, by?: number) {
  const target = s.seats[seat]
  target.alive = false
  target.eliminatedAt = at
  target.eliminatedTurn = s.turn
  target.eliminatedRound = s.round
  target.cause = cause
  target.killer = by !== undefined && by !== seat && s.seats[by] ? by : undefined
}

/** Winners first, then everyone else by how long they survived. Simultaneous eliminations share a place. */
function assignPlaces(s: GameState) {
  for (const w of s.winners) s.seats[w].place = 1
  const losers = s.seats
    .map((seat, i) => ({ seat, i }))
    .filter(({ i }) => !s.winners.includes(i))
    .sort((a, b) => (b.seat.eliminatedAt ?? 0) - (a.seat.eliminatedAt ?? 0))
  let place = s.winners.length + 1
  losers.forEach(({ seat }, n) => {
    const prev = losers[n - 1]
    if (prev && prev.seat.eliminatedAt === seat.eliminatedAt) seat.place = prev.seat.place
    else seat.place = place
    place++
  })
}

function nextAlive(s: GameState, from: number): number | null {
  const n = s.seats.length
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n
    if (s.seats[i].alive) return i
  }
  return null
}

function startTurn(s: GameState, seat: number, at: number) {
  s.activeSeat = seat
  s.turnStartedAt = at
  s.turnPausedMs = 0
}

function endTurn(s: GameState, at: number) {
  if (s.activeSeat === null) return
  const ms = activeTurnMs(s, at)
  const seat = s.seats[s.activeSeat]
  seat.turns++
  seat.turnMs += ms
  seat.longestTurnMs = Math.max(seat.longestTurnMs, ms)
  s.turns.push({ turn: s.turn, round: s.round, seat: s.activeSeat, start: s.turnStartedAt, ms })
}

function advanceTurn(s: GameState, at: number) {
  const prev = s.activeSeat
  if (prev === null) return
  endTurn(s, at)
  const next = nextAlive(s, prev)
  if (next === null) {
    s.activeSeat = null
    return
  }
  const n = s.seats.length
  const first = s.firstSeat ?? 0
  const offset = (i: number) => (i - first + n) % n
  if (offset(next) <= offset(prev)) s.round++
  s.turn++
  startTurn(s, next, at)
}

function resume(s: GameState, at: number) {
  if (!s.paused || s.pausedAt === undefined) return
  s.turnPausedMs += Math.max(0, at - Math.max(s.pausedAt, s.turnStartedAt))
  s.totalPausedMs += Math.max(0, at - s.pausedAt)
  s.paused = false
  s.pausedAt = undefined
}

/** Active time of the current turn at `now`, pauses excluded. Clamped at 0 to absorb clock skew between phones. */
export function activeTurnMs(s: GameState, now: number): number {
  if (s.activeSeat === null) return 0
  const ongoingPause = s.paused && s.pausedAt !== undefined ? Math.max(0, now - Math.max(s.pausedAt, s.turnStartedAt)) : 0
  return Math.max(0, now - s.turnStartedAt - s.turnPausedMs - ongoingPause)
}

/** Game length so far (or total, once ended), pauses excluded. */
export function gameElapsedMs(s: GameState, now: number): number {
  if (s.startedAt === undefined) return 0
  const end = s.endedAt ?? now
  const ongoingPause = s.paused && s.pausedAt !== undefined ? Math.max(0, end - s.pausedAt) : 0
  return Math.max(0, end - s.startedAt - s.totalPausedMs - ongoingPause)
}

export function aliveSeats(s: GameState): number[] {
  return s.seats.flatMap((seat, i) => (seat.alive ? [i] : []))
}

export interface Threat {
  cause: EliminationCause
  killer?: number
  /** Changes whenever the lethal condition changes, so a dismissed prompt can come back. */
  key: string
}

/** Whether a living seat is at a lethal state, and who most likely did it. */
export function threatFor(s: GameState, seat: number): Threat | null {
  const st = s.seats[seat]
  if (!st?.alive || s.ended) return null
  for (let src = 0; src < st.commanderDamage.length; src++) {
    const row = st.commanderDamage[src]
    const idx = row.findIndex((d) => d >= LETHAL_COMMANDER)
    if (idx >= 0) return { cause: 'commander', killer: src, key: `c${src}.${idx}.${row[idx]}` }
  }
  if (st.poison >= LETHAL_POISON) return { cause: 'poison', killer: st.lastPoisonBy, key: `p${st.poison}` }
  if (st.life <= 0) return { cause: 'damage', killer: st.lastDamageBy, key: `l${st.life}` }
  return null
}

export function maxCommanderDamageTaken(seat: SeatState): number {
  return Math.max(0, ...seat.commanderDamage.flat())
}

import { Crown, Dices, Menu, Pause, Play } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useGame, useGameState, useLookups } from '../../data/hooks'
import { appendEvent, refreshGameResult } from '../../data/repo'
import type { GameEventBody } from '../../game/events'
import { aliveSeats } from '../../game/project'
import { playerHex } from '../../lib/colors'
import { haptic, useWakeLock } from '../../lib/device'
import { setMe, useMe } from '../../lib/me'
import { Button } from '../../ui/kit'
import { GameCtx, useGameCtx, type GameCtxValue, type SeatInfo } from './context'
import { DeclareWinSheet, GameLogSheet, GameMenuSheet } from './GameSheets'
import { InviteSheet, MySeatLayout } from './MySeat'
import { SeatPanel, type Rotation } from './SeatPanel'

export function GameScreen() {
  const { id } = useParams()
  const game = useGame(id)
  const { state } = useGameState(game)
  const lookups = useLookups()
  const [rollingSeat, setRollingSeat] = useState<number | null>(null)
  const me = useMe()
  const [view, setView] = useState<'seat' | 'table'>('seat')
  const [watching, setWatching] = useState(false)

  useWakeLock(game?.status === 'active')

  const seats: SeatInfo[] = useMemo(
    () =>
      (game?.seats ?? []).map((s) => {
        const player = lookups.player.get(s.playerId)
        const deck = s.deckId ? lookups.deck.get(s.deckId) : undefined
        return { player, deck, name: player?.name ?? 'Player', hex: playerHex(player?.color) }
      }),
    [game, lookups],
  )

  const gameId = game?.id
  const record = useCallback(
    (body: GameEventBody) => {
      if (!gameId) return
      void appendEvent(gameId, body).then(() => {
        if (body.type === 'end' || body.type === 'undo') return refreshGameResult(gameId)
      })
    },
    [gameId],
  )

  if (game === null) return <Navigate to="/" replace />
  if (!game || !state || !lookups.ready) return <div className="h-full bg-bg" />

  const ctx: GameCtxValue = { game, state, seats, record, rollingSeat }
  const multi = game.mode === 'multi'
  const mySeat = game.seats.findIndex((s) => s.playerId === me)
  const seatView = multi && mySeat >= 0 && view === 'seat'
  const viewToggle = multi && mySeat >= 0 ? { label: seatView ? 'Table view' : 'My seat view', onClick: () => setView(seatView ? 'table' : 'seat') } : undefined
  return (
    <GameCtx.Provider value={ctx}>
      <div className="fixed inset-0 overflow-hidden bg-black">
        {seatView ? (
          <MySeatLayout seat={mySeat} hub={<Hub inline viewToggle={viewToggle} />} />
        ) : (
          <>
            <TableLayout />
            <Hub viewToggle={viewToggle} />
          </>
        )}
        {multi && mySeat < 0 && !watching && !state.ended ? (
          <SeatClaim onWatch={() => setWatching(true)} />
        ) : (
          !state.started && !state.ended && <FirstPlayerPicker onRolling={setRollingSeat} />
        )}
        <EndPrompt />
      </div>
    </GameCtx.Provider>
  )
}

/**
 * Panels around the phone lying flat in the middle of the table. Seats run clockwise: up the
 * left side, then down the right side. Each panel faces the edge its player sits at.
 */
function TableLayout() {
  const { game } = useGameCtx()
  const n = game.seats.length
  if (n <= 2) {
    return (
      <div className="pt-safe pb-safe flex h-full flex-col">
        <div className="flex-1">{n > 1 && <SeatPanel seat={1} rotation={180} />}</div>
        <div className="flex-1">
          <SeatPanel seat={0} rotation={0} />
        </div>
      </div>
    )
  }
  const leftCount = Math.ceil(n / 2)
  const left = Array.from({ length: leftCount }, (_, i) => leftCount - 1 - i) // top → bottom
  const right = Array.from({ length: n - leftCount }, (_, i) => leftCount + i)
  const column = (seats: number[], rotation: Rotation) => (
    <div className="flex flex-1 flex-col">
      {seats.map((s) => (
        <div key={s} className="min-h-0 flex-1">
          <SeatPanel seat={s} rotation={rotation} />
        </div>
      ))}
    </div>
  )
  return (
    <div className="pt-safe pb-safe flex h-full">
      {column(left, 90)}
      {column(right, 270)}
    </div>
  )
}

/** The round menu button: in the middle of the table, or between the strip and your panel in seat view. */
function Hub({ inline, viewToggle }: { inline?: boolean; viewToggle?: { label: string; onClick: () => void } }) {
  const { state, record, game } = useGameCtx()
  const [sheet, setSheet] = useState<null | 'menu' | 'log' | 'win' | 'invite'>(null)
  return (
    <>
      <div className={inline ? '' : 'pointer-events-none absolute inset-0 z-20 flex items-center justify-center'}>
        <div className="pointer-events-auto flex items-center gap-2">
          {state.paused && (
            <button
              onClick={() => record({ type: 'resume' })}
              className="animate-pop flex h-12 items-center gap-2 rounded-full bg-gold px-4 font-semibold text-black shadow-lg shadow-black/50"
            >
              <Play className="size-4" fill="currentColor" /> Resume
            </button>
          )}
          <button
            aria-label="Game menu"
            onClick={() => setSheet('menu')}
            className="flex size-14 items-center justify-center rounded-full border-4 border-black bg-surface-2 text-fg shadow-lg shadow-black/60 active:bg-surface-3"
          >
            {state.paused ? <Pause className="size-6 text-gold" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>
      <GameMenuSheet
        open={sheet === 'menu'}
        onClose={() => setSheet(null)}
        onOpen={setSheet}
        viewToggle={
          viewToggle && {
            ...viewToggle,
            onClick: () => {
              viewToggle.onClick()
              setSheet(null)
            },
          }
        }
        canInvite={game.mode === 'multi'}
      />
      <InviteSheet open={sheet === 'invite'} onClose={() => setSheet(null)} />
      <GameLogSheet open={sheet === 'log'} onClose={() => setSheet(null)} />
      <DeclareWinSheet open={sheet === 'win'} onClose={() => setSheet(null)} />
    </>
  )
}

function FirstPlayerPicker({ onRolling }: { onRolling: (seat: number | null) => void }) {
  const { seats, record } = useGameCtx()
  const [rolling, setRolling] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const roll = () => {
    setRolling(true)
    const n = seats.length
    const winner = Math.floor(Math.random() * n)
    const steps = 2 * n + winner + 1 // two full laps, then stop on `winner`
    let t = 0
    for (let i = 0; i < steps; i++) {
      t += 60 + Math.pow(i / steps, 3) * 360
      const seat = i % n
      timers.current.push(
        setTimeout(() => {
          onRolling(seat)
          haptic(4)
        }, t),
      )
    }
    timers.current.push(
      setTimeout(() => {
        haptic([30, 60, 30])
        record({ type: 'start', firstSeat: winner })
        onRolling(null)
      }, t + 900),
    )
  }

  if (rolling) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-6">
      <div className="animate-pop pointer-events-auto w-full max-w-xs rounded-3xl border border-line bg-surface/95 p-5 text-center shadow-2xl backdrop-blur">
        <p className="text-lg font-semibold">Who goes first?</p>
        <Button variant="primary" size="lg" className="mt-4 w-full" onClick={roll}>
          <Dices className="size-5" /> Roll for it
        </Button>
        <p className="mt-4 mb-2 text-xs text-muted">or pick</p>
        <div className="flex flex-wrap justify-center gap-2">
          {seats.map((s, i) => (
            <button
              key={i}
              onClick={() => record({ type: 'start', firstSeat: i })}
              className="flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-sm active:bg-surface-3"
            >
              <span className="size-2.5 rounded-full" style={{ background: s.hex }} />
              {s.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Multi-phone game opened on a phone that isn't seated: ask whose phone this is. */
function SeatClaim({ onWatch }: { onWatch: () => void }) {
  const { seats } = useGameCtx()
  return (
    <Centered>
      <p className="text-lg font-semibold">Which seat is yours?</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {seats.map((s, i) => (
          <button
            key={i}
            onClick={() => s.player && setMe(s.player.id)}
            className="flex h-10 items-center gap-1.5 rounded-full bg-surface-2 px-4 font-medium active:bg-surface-3"
          >
            <span className="size-2.5 rounded-full" style={{ background: s.hex }} />
            {s.name}
          </button>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="mt-3 w-full text-muted" onClick={onWatch}>
        Just watching
      </Button>
    </Centered>
  )
}

/** When one player is left (or nobody), confirm the result. Also shown on a finished game. */
function EndPrompt() {
  const { state, seats, record, game } = useGameCtx()
  const navigate = useNavigate()
  const alive = aliveSeats(state)
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const lastEvent = state.effective[state.effective.length - 1]

  if (state.ended) {
    return (
      <Centered>
        <Crown className="mx-auto size-10 text-gold" />
        <p className="mt-2 text-xl font-bold">
          {state.winners.length ? `${state.winners.map((w) => seats[w].name).join(' & ')} won` : 'Draw'}
        </p>
        <Button variant="primary" className="mt-4 w-full" onClick={() => navigate(`/games/${game.id}`, { replace: true })}>
          See results
        </Button>
      </Centered>
    )
  }

  const eliminationCount = state.seats.filter((s) => !s.alive).length
  if (eliminationCount === 0 || alive.length > 1 || dismissedAt === eliminationCount) return null

  const undoLast = () => lastEvent && record({ type: 'undo', eventId: lastEvent.id })
  return (
    <Centered>
      {alive.length === 1 ? (
        <>
          <Crown className="mx-auto size-10 text-gold" />
          <p className="mt-2 text-xl font-bold">{seats[alive[0]].name} wins!</p>
          {seats[alive[0]].deck && <p className="text-sm text-muted">{seats[alive[0]].deck!.name}</p>}
          <Button
            variant="primary"
            className="mt-4 w-full"
            onClick={() => {
              haptic([30, 50, 30, 50, 60])
              record({ type: 'end', winners: alive, winType: 'last_standing' })
            }}
          >
            Confirm win
          </Button>
        </>
      ) : (
        <>
          <p className="text-xl font-bold">Everyone is out</p>
          <Button variant="primary" className="mt-4 w-full" onClick={() => record({ type: 'end', winners: [], winType: 'draw' })}>
            It's a draw
          </Button>
        </>
      )}
      <div className="mt-2 flex gap-2">
        <Button variant="ghost" size="sm" className="flex-1" onClick={undoLast}>
          Undo last
        </Button>
        <Button variant="ghost" size="sm" className="flex-1" onClick={() => setDismissedAt(eliminationCount)}>
          Not yet
        </Button>
      </div>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-6">
      <div className="animate-pop w-full max-w-xs rounded-3xl border border-line bg-surface/95 p-5 text-center shadow-2xl backdrop-blur">{children}</div>
    </div>
  )
}

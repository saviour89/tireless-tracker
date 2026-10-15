import { DoorOpen, Flag, LayoutGrid, Pause, Play, QrCode, ScrollText, Trophy, Undo2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { abandonGame } from '../../data/repo'
import { describeEvent } from '../../game/describe'
import { WIN_TYPE_LABEL, type GameEvent, type WinType } from '../../game/events'
import { aliveSeats, gameElapsedMs } from '../../game/project'
import { clock, timeOfDay } from '../../lib/format'
import { Button, Segmented, Sheet, TextField } from '../../ui/kit'
import { CardSearchField } from '../../ui/CardSearch'
import { commanderLabel, useGameCtx } from './context'
import { useNow } from './hooks'

function useDescribe() {
  const { seats } = useGameCtx()
  return (e: GameEvent) =>
    describeEvent(
      e,
      (i) => seats[i]?.name ?? '?',
      (i, idx) => commanderLabel(seats[i], idx),
    )
}

export function GameMenuSheet({
  open,
  onClose,
  onOpen,
  viewToggle,
  canInvite,
}: {
  open: boolean
  onClose: () => void
  onOpen: (s: 'log' | 'win' | 'invite') => void
  viewToggle?: { label: string; onClick: () => void }
  canInvite?: boolean
}) {
  const { state, record, game } = useGameCtx()
  const navigate = useNavigate()
  const describe = useDescribe()
  const now = useNow(1000, open && !state.paused)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const last = state.effective[state.effective.length - 1]

  const close = () => {
    setConfirmAbandon(false)
    onClose()
  }

  return (
    <Sheet open={open} onClose={close}>
      <div className="flex items-baseline justify-between pt-3 pb-4">
        <div>
          <p className="tabular text-3xl font-bold">{clock(gameElapsedMs(state, now))}</p>
          <p className="text-sm text-muted">
            {state.started ? `Turn ${state.turn} · Round ${state.round}` : 'Not started'}
            {state.paused && ' · Paused'}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {state.started && !state.ended && (
          <MenuItem
            icon={state.paused ? <Play className="size-5" /> : <Pause className="size-5" />}
            label={state.paused ? 'Resume game' : 'Pause game'}
            detail={state.paused ? undefined : "Turn timers stop while paused"}
            onClick={() => {
              record({ type: state.paused ? 'resume' : 'pause' })
              close()
            }}
          />
        )}
        <MenuItem
          icon={<Undo2 className="size-5" />}
          label="Undo"
          detail={last ? describe(last) : 'Nothing to undo'}
          disabled={!last}
          onClick={() => last && record({ type: 'undo', eventId: last.id })}
        />
        <MenuItem icon={<ScrollText className="size-5" />} label="Game log" detail={`${state.effective.length} events`} onClick={() => onOpen('log')} />
        {canInvite && !state.ended && (
          <MenuItem icon={<QrCode className="size-5" />} label="Invite phones" detail="QR code for this game" onClick={() => onOpen('invite')} />
        )}
        {viewToggle && <MenuItem icon={<LayoutGrid className="size-5" />} label={viewToggle.label} onClick={viewToggle.onClick} />}
        {!state.ended && (
          <MenuItem icon={<Trophy className="size-5" />} label="Declare a winner" detail="Combo, alt win con or a draw" onClick={() => onOpen('win')} />
        )}
        <MenuItem icon={<DoorOpen className="size-5" />} label="Leave table" detail="The game stays open, resume it from Play" onClick={() => navigate('/')} />
        {!state.ended &&
          (confirmAbandon ? (
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={() => setConfirmAbandon(false)}>
                Keep playing
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={async () => {
                  await abandonGame(game.id)
                  navigate('/', { replace: true })
                }}
              >
                Abandon game
              </Button>
            </div>
          ) : (
            <MenuItem icon={<Flag className="size-5" />} label="Abandon game" detail="Not counted in stats" danger onClick={() => setConfirmAbandon(true)} />
          ))}
      </div>
    </Sheet>
  )
}

function MenuItem({
  icon,
  label,
  detail,
  onClick,
  disabled,
  danger,
}: {
  icon: ReactNode
  label: string
  detail?: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-left transition active:bg-surface-3 disabled:opacity-40 ${danger ? 'text-danger' : ''}`}
    >
      <span className={danger ? '' : 'text-muted'}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {detail && <span className="block truncate text-sm text-muted">{detail}</span>}
      </span>
    </button>
  )
}

export function GameLogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, record, seats } = useGameCtx()
  const describe = useDescribe()
  const events = [...state.effective].reverse()
  return (
    <Sheet open={open} onClose={onClose} title="Game log">
      {events.length === 0 && <p className="py-8 text-center text-muted">Nothing has happened yet.</p>}
      <ul className="divide-y divide-line">
        {events.map((e) => {
          const seat = 'target' in e ? e.target : e.type === 'start' ? e.firstSeat : undefined
          return (
            <li key={e.id} className="flex items-center gap-3 py-2.5">
              <span className="size-2 shrink-0 rounded-full" style={{ background: seat !== undefined ? seats[seat]?.hex : 'var(--color-faint)' }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{describe(e)}</p>
                <p className="text-xs text-faint">{timeOfDay(e.at)}</p>
              </div>
              <button
                onClick={() => record({ type: 'undo', eventId: e.id })}
                className="flex h-8 items-center gap-1 rounded-lg px-2 text-sm text-muted active:bg-surface-2"
              >
                <Undo2 className="size-4" /> Undo
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

export function DeclareWinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, seats, record } = useGameCtx()
  const alive = aliveSeats(state)
  const [winner, setWinner] = useState<number | null>(null)
  const [winType, setWinType] = useState<WinType>('combo')
  const [card, setCard] = useState('')
  const [note, setNote] = useState('')

  const confirm = () => {
    record({
      type: 'end',
      winners: winType === 'draw' || winner === null ? [] : [winner],
      winType,
      card: card.trim() || undefined,
      note: note.trim() || undefined,
    })
    onClose()
  }

  const types: WinType[] = ['combo', 'alt_win', 'last_standing', 'draw']
  return (
    <Sheet open={open} onClose={onClose} title="Declare a winner">
      <div className="space-y-5 pt-1">
        <div>
          <p className="mb-2 text-sm text-muted">How</p>
          <Segmented
            value={winType}
            onChange={setWinType}
            options={types.map((t) => ({ value: t, label: t === 'last_standing' ? 'Concessions' : WIN_TYPE_LABEL[t] }))}
          />
          {winType === 'last_standing' && <p className="mt-2 text-xs text-muted">Everyone else conceded.</p>}
        </div>
        {winType !== 'draw' && (
          <div>
            <p className="mb-2 text-sm text-muted">Winner</p>
            <div className="flex flex-wrap gap-2">
              {alive.map((i) => (
                <button
                  key={i}
                  onClick={() => setWinner(i)}
                  className={`flex h-10 items-center gap-2 rounded-full px-4 font-medium transition ${winner === i ? 'bg-white text-black' : 'bg-surface-2'}`}
                >
                  <span className="size-2.5 rounded-full" style={{ background: seats[i].hex }} />
                  {seats[i].name}
                </button>
              ))}
            </div>
          </div>
        )}
        {(winType === 'combo' || winType === 'alt_win') && (
          <CardSearchField label="Key card (optional)" value={card} onChange={setCard} placeholder="e.g. Thassa's Oracle" />
        )}
        <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything worth remembering" />
        <Button variant="primary" size="lg" className="w-full" disabled={winType !== 'draw' && winner === null} onClick={confirm}>
          {winType === 'draw' ? 'End in a draw' : winner !== null ? `${seats[winner].name} wins` : 'Pick a winner'}
        </Button>
      </div>
    </Sheet>
  )
}

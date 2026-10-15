import { Biohazard, Crown, Ellipsis, Minus, Plus, Skull, SkipForward, Swords } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CAUSE_LABEL } from '../../game/events'
import { activeTurnMs, maxCommanderDamageTaken, threatFor } from '../../game/project'
import { haptic } from '../../lib/device'
import { clock } from '../../lib/format'
import { DeckArt } from '../../ui/kit'
import { commanderSlots, useGameCtx } from './context'
import { useNow, usePressRepeat } from './hooks'
import { CountersOverlay, KeypadOverlay, OutOverlay, SeatMenuOverlay } from './SeatOverlays'

/** How long the "who did it?" chips wait before saving damage as unattributed. */
export const ATTRIBUTION_MS = 3500
const GAIN_MS = 1400

export type Rotation = 0 | 90 | 180 | 270

type Overlay = null | 'menu' | 'counters' | 'keypad' | 'out'

export function SeatPanel({ seat, rotation }: { seat: number; rotation: Rotation }) {
  const { state, seats, record, rollingSeat } = useGameCtx()
  const st = state.seats[seat]
  const info = seats[seat]
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [dismissedThreat, setDismissedThreat] = useState<string | null>(null)

  // --- Pending life change: taps accumulate, then commit with an optional source. ---
  const [pending, setPending] = useState(0)
  const [bumps, setBumps] = useState(0)
  const pendingRef = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const commit = useCallback(
    (source?: number, commander?: number) => {
      clearTimeout(timer.current)
      const amount = pendingRef.current
      pendingRef.current = 0
      setPending(0)
      if (amount !== 0) record({ type: 'life', target: seat, amount, source, commander })
    },
    [record, seat],
  )
  const commitRef = useRef(commit)
  commitRef.current = commit
  useEffect(() => () => commitRef.current(), [])

  const bump = useCallback((delta: number) => {
    pendingRef.current += delta
    setPending(pendingRef.current)
    setBumps((b) => b + 1)
    clearTimeout(timer.current)
    haptic(5)
    if (pendingRef.current !== 0) {
      timer.current = setTimeout(() => commitRef.current(), pendingRef.current < 0 ? ATTRIBUTION_MS : GAIN_MS)
    }
  }, [])

  const minus = usePressRepeat(() => bump(-1))
  const plus = usePressRepeat(() => bump(1))

  const threat = threatFor(state, seat)
  const showThreat = !!threat && threat.key !== dismissedThreat && pending === 0 && overlay === null
  const active = state.activeSeat === seat && !state.ended
  const life = st.life + pending
  const maxCmd = maxCommanderDamageTaken(st)
  const opponents = seats.map((_, i) => i).filter((i) => i !== seat && state.seats[i].alive)

  const ring = rollingSeat === seat ? '#ffffff' : active ? info.hex : 'transparent'

  return (
    <div className="relative h-full w-full overflow-hidden [container-type:size]">
      <div className="no-select absolute" style={frameStyle(rotation)}>
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[22px] bg-surface [container-type:size]">
          {/* Background art */}
          <DeckArt
            deck={info.deck}
            rounded="rounded-none"
            className={`absolute inset-0 transition duration-500 ${st.alive ? 'opacity-55' : 'opacity-20 grayscale'}`}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/70" />
          <div
            className={`pointer-events-none absolute inset-0 z-30 rounded-[22px] transition-shadow duration-300 ${active && rollingSeat === null ? 'animate-pulse-ring' : ''}`}
            style={{ ['--ring' as string]: ring, boxShadow: `inset 0 0 0 3px ${ring}` }}
          />

          {/* Tap zones */}
          {st.alive && !state.ended && (
            <div className="absolute inset-0 z-0 flex">
              <button aria-label={`${info.name} minus one life`} className="flex flex-1 items-center pl-[4cqw] text-white/25 active:bg-white/5" style={{ touchAction: 'none' }} {...minus}>
                <Minus className="size-[12cqh] min-h-5 min-w-5" strokeWidth={2.5} />
              </button>
              <button aria-label={`${info.name} plus one life`} className="flex flex-1 items-center justify-end pr-[4cqw] text-white/25 active:bg-white/5" style={{ touchAction: 'none' }} {...plus}>
                <Plus className="size-[12cqh] min-h-5 min-w-5" strokeWidth={2.5} />
              </button>
            </div>
          )}

          {/* Top bar */}
          <div className="pointer-events-none relative z-10 flex items-start gap-2 px-[4cqw] pt-[5cqh]">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: info.hex }} />
                <span className="truncate text-[clamp(13px,9cqh,20px)] leading-tight font-semibold">{info.name}</span>
              </div>
              {info.deck && <div className="truncate text-[clamp(10px,6.5cqh,14px)] text-white/60">{info.deck.name}</div>}
            </div>
            <div className="pointer-events-auto flex shrink-0 items-center gap-1">
              {st.poison > 0 && (
                <Badge onClick={() => setOverlay('counters')} danger={st.poison >= 10}>
                  <Biohazard className="size-3.5" /> {st.poison}
                </Badge>
              )}
              {maxCmd > 0 && (
                <Badge onClick={() => setOverlay('counters')} danger={maxCmd >= 21}>
                  <Swords className="size-3.5" /> {maxCmd}
                </Badge>
              )}
              {st.alive && !state.ended && (
                <button
                  aria-label={`${info.name} options`}
                  onClick={() => setOverlay('menu')}
                  className="flex size-[clamp(30px,16cqh,40px)] items-center justify-center rounded-full bg-black/35 text-white/85 active:bg-black/60"
                >
                  <Ellipsis className="size-5" />
                </button>
              )}
            </div>
          </div>

          {/* Life */}
          <div className="pointer-events-none relative z-10 flex flex-1 items-center justify-center">
            {st.alive ? (
              <div className="relative flex items-center">
                <span
                  className={`tabular text-[clamp(44px,46cqh,170px)] leading-none font-extrabold tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] transition-colors ${
                    life <= 0 ? 'text-danger' : life <= 10 ? 'text-[#ffb4a8]' : 'text-white'
                  }`}
                >
                  {life}
                </span>
                {pending !== 0 && (
                  <span
                    key={pending > 0 ? 'up' : 'down'}
                    className={`animate-pop tabular absolute left-full ml-[3cqw] text-[clamp(18px,15cqh,48px)] font-bold ${pending > 0 ? 'text-good' : 'text-danger'}`}
                  >
                    {pending > 0 ? `+${pending}` : pending}
                  </span>
                )}
              </div>
            ) : (
              <EliminatedInfo seat={seat} />
            )}
          </div>

          {/* Bottom: attribution chips, or turn controls */}
          <div className="relative z-10 flex min-h-[22cqh] items-end justify-center px-[3cqw] pb-[4cqh]">
            {pending < 0 ? (
              <SourceChips seat={seat} opponents={opponents} bumps={bumps} onPick={(s, c) => { haptic(10); commit(s, c) }} onSkip={() => commit()} />
            ) : active ? (
              <TurnControls />
            ) : null}
          </div>

          {showThreat && threat && (
            <OutOverlay
              seat={seat}
              cause={threat.cause}
              suggestedKiller={threat.killer}
              onDone={() => setDismissedThreat(threat.key)}
            />
          )}
          {overlay === 'menu' && <SeatMenuOverlay seat={seat} onClose={() => setOverlay(null)} onOpen={setOverlay} />}
          {overlay === 'counters' && <CountersOverlay seat={seat} onClose={() => setOverlay(null)} />}
          {overlay === 'keypad' && (
            <KeypadOverlay
              seat={seat}
              onClose={() => setOverlay(null)}
              onAmount={(amount) => {
                setOverlay(null)
                bump(amount)
              }}
            />
          )}
          {overlay === 'out' && (
            <OutOverlay seat={seat} cause={null} suggestedKiller={undefined} onDone={() => setOverlay(null)} />
          )}
        </div>
      </div>
    </div>
  )
}

/** Positions the panel's inner frame so it faces the player sitting on that side. */
function frameStyle(rotation: Rotation): React.CSSProperties {
  const pad = 3
  if (rotation === 0 || rotation === 180) {
    return { inset: pad, transform: rotation === 180 ? 'rotate(180deg)' : undefined }
  }
  return {
    width: `calc(100cqh - ${pad * 2}px)`,
    height: `calc(100cqw - ${pad * 2}px)`,
    top: '50%',
    left: '50%',
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
  }
}

function Badge({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`tabular flex h-[clamp(26px,13cqh,34px)] items-center gap-1 rounded-full px-2.5 text-sm font-semibold ${
        danger ? 'bg-danger text-white' : 'bg-black/45 text-white/90'
      }`}
    >
      {children}
    </button>
  )
}

function SourceChips({
  seat,
  opponents,
  bumps,
  onPick,
  onSkip,
}: {
  seat: number
  opponents: number[]
  bumps: number
  onPick: (source: number, commander?: number) => void
  onSkip: () => void
}) {
  const { seats } = useGameCtx()
  return (
    <div className="animate-fade-in w-full">
      <div className="mb-1 flex items-center gap-2 px-1 text-[clamp(10px,6cqh,13px)] font-medium text-white/70">
        <span>Who did it?</span>
        <div className="h-0.5 flex-1 overflow-hidden rounded bg-white/15">
          <div key={bumps} className="h-full origin-left bg-white/60" style={{ animation: `shrink ${ATTRIBUTION_MS}ms linear forwards` }} />
        </div>
        <button onClick={onSkip} className="rounded-full px-2 py-0.5 text-white/80 active:bg-white/10" aria-label={`Save without a source for seat ${seat + 1}`}>
          Skip
        </button>
      </div>
      <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5">
        {opponents.map((o) => (
          <div key={o} className="flex shrink-0 items-center gap-1 rounded-full bg-black/55 p-1 ring-1 ring-white/10">
            <button
              onClick={() => onPick(o)}
              className={`flex h-[clamp(30px,17cqh,44px)] items-center gap-1.5 rounded-full pl-1 active:bg-white/15 ${opponents.length <= 2 ? 'pr-2.5' : 'pr-0'}`}
              aria-label={`Damage from ${seats[o].name}`}
            >
              <span className="flex aspect-square h-full items-center justify-center rounded-full text-sm font-bold text-black/80" style={{ background: seats[o].hex }}>
                {seats[o].name.charAt(0).toUpperCase()}
              </span>
              {opponents.length <= 2 && <span className="max-w-[18cqw] truncate text-[clamp(11px,7cqh,15px)] font-medium">{seats[o].name}</span>}
            </button>
            {commanderSlots(seats[o]).map((c) => (
              <button
                key={c.idx}
                onClick={() => onPick(o, c.idx)}
                aria-label={`Commander damage from ${c.label}`}
                className="relative aspect-square h-[clamp(30px,17cqh,44px)] overflow-hidden rounded-full bg-surface-3 ring-2 ring-gold/80 active:brightness-125"
              >
                {c.artUrl ? <img src={c.artUrl} alt="" className="size-full object-cover" draggable={false} /> : null}
                <Crown className="absolute inset-0 m-auto size-4 text-gold drop-shadow" />
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function TurnControls() {
  const { state, record } = useGameCtx()
  const now = useNow(1000, !state.paused)
  return (
    <div className="flex items-center gap-2">
      <div className={`tabular rounded-full bg-black/45 px-3 py-1.5 text-[clamp(12px,8cqh,17px)] font-semibold ${state.paused ? 'text-gold' : 'text-white/90'}`}>
        {state.paused ? 'Paused' : clock(activeTurnMs(state, now))}
      </div>
      <button
        onClick={() => {
          haptic(15)
          record({ type: 'pass', turn: state.turn })
        }}
        className="flex h-[clamp(34px,19cqh,48px)] items-center gap-1.5 rounded-full bg-white px-4 text-[clamp(13px,8cqh,17px)] font-semibold text-black active:bg-white/80"
      >
        End turn <SkipForward className="size-4" />
      </button>
    </div>
  )
}

function EliminatedInfo({ seat }: { seat: number }) {
  const { state, seats } = useGameCtx()
  const st = state.seats[seat]
  const won = state.winners.includes(seat)
  if (won) {
    return (
      <div className="flex flex-col items-center text-gold">
        <Crown className="size-[22cqh]" />
        <span className="text-[clamp(16px,12cqh,32px)] font-bold">Winner</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center text-center text-white/70">
      <Skull className="mb-1 size-[18cqh]" />
      <span className="text-[clamp(13px,9cqh,22px)] font-semibold">
        {st.cause ? CAUSE_LABEL[st.cause] : 'Out'}
        {st.killer !== undefined && ` · ${seats[st.killer].name}`}
      </span>
      {!!st.eliminatedRound && <span className="text-[clamp(11px,7cqh,15px)] text-white/50">Round {st.eliminatedRound}</span>}
    </div>
  )
}

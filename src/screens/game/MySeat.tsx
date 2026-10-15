import { Biohazard, Crown, Minus, Plus, Skull, Swords } from 'lucide-react'
import { useState } from 'react'
import { encode } from 'uqr'
import { activeTurnMs, maxCommanderDamageTaken } from '../../game/project'
import { haptic } from '../../lib/device'
import { clock } from '../../lib/format'
import { Button, DeckArt, Sheet } from '../../ui/kit'
import { commanderSlots, useGameCtx } from './context'
import { useNow, usePressRepeat } from './hooks'
import { SeatPanel } from './SeatPanel'

/**
 * Multi-phone layout: opponents in a strip along the top, your own panel filling the rest.
 * Tapping an opponent lets you log damage you dealt them.
 */
export function MySeatLayout({ seat, hub }: { seat: number; hub: React.ReactNode }) {
  const { game } = useGameCtx()
  const [target, setTarget] = useState<number | null>(null)
  const opponents = game.seats.map((_, i) => i).filter((i) => i !== seat)
  // Opponents in turn order starting after you, so the strip reads left-to-right around the table.
  const ordered = [...opponents.filter((i) => i > seat), ...opponents.filter((i) => i < seat)]
  return (
    <div className="pt-safe pb-safe flex h-full flex-col">
      <div className="grid h-[30%] shrink-0 gap-1.5 p-1.5 pb-0" style={{ gridTemplateColumns: `repeat(${ordered.length}, minmax(0, 1fr))` }}>
        {ordered.map((o) => (
          <OpponentCard key={o} seat={o} onClick={() => setTarget(o)} />
        ))}
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="absolute top-0 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2">{hub}</div>
        <SeatPanel seat={seat} rotation={0} />
      </div>
      {target !== null && <DealDamageSheet from={seat} to={target} onClose={() => setTarget(null)} />}
    </div>
  )
}

function OpponentCard({ seat, onClick }: { seat: number; onClick: () => void }) {
  const { state, seats } = useGameCtx()
  const st = state.seats[seat]
  const info = seats[seat]
  const active = state.activeSeat === seat && !state.ended
  const now = useNow(1000, active && !state.paused)
  const maxCmd = maxCommanderDamageTaken(st)
  const won = state.winners.includes(seat)
  return (
    <button
      onClick={onClick}
      disabled={!st.alive || state.ended}
      className="relative overflow-hidden rounded-2xl bg-surface text-left [container-type:size]"
      style={{ boxShadow: active ? `inset 0 0 0 3px ${info.hex}` : undefined }}
    >
      <DeckArt deck={info.deck} rounded="rounded-none" className={`absolute inset-0 ${st.alive ? 'opacity-45' : 'opacity-15 grayscale'}`} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/30" />
      <div className="relative flex h-full flex-col p-[6cqw]">
        <div className="flex items-center gap-1">
          <span className="size-2 shrink-0 rounded-full" style={{ background: info.hex }} />
          <span className="truncate text-[clamp(11px,11cqw,15px)] font-semibold">{info.name}</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          {won ? (
            <Crown className="size-[30cqw] text-gold" />
          ) : st.alive ? (
            <span className={`tabular text-[clamp(24px,34cqw,64px)] leading-none font-extrabold ${st.life <= 10 ? 'text-[#ffb4a8]' : ''}`}>{st.life}</span>
          ) : (
            <Skull className="size-[26cqw] text-white/50" />
          )}
        </div>
        <div className="flex min-h-5 flex-wrap items-center justify-center gap-1 text-[11px] font-semibold">
          {active && <span className="tabular rounded-full bg-black/50 px-1.5">{state.paused ? 'Paused' : clock(activeTurnMs(state, now))}</span>}
          {st.poison > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-black/50 px-1.5">
              <Biohazard className="size-3" /> {st.poison}
            </span>
          )}
          {maxCmd > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-black/50 px-1.5">
              <Swords className="size-3" /> {maxCmd}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function DealDamageSheet({ from, to, onClose }: { from: number; to: number; onClose: () => void }) {
  const { seats, record } = useGameCtx()
  const [amount, setAmount] = useState(1)
  const [commander, setCommander] = useState<number | null>(null)
  const dec = usePressRepeat(() => setAmount((a) => Math.max(1, a - 1)))
  const inc = usePressRepeat(() => setAmount((a) => a + 1))
  const slots = commanderSlots(seats[from])
  return (
    <Sheet open onClose={onClose} title={`Deal damage to ${seats[to].name}`}>
      <div className="flex items-center justify-center gap-6 py-4">
        <button aria-label="Less" className="flex size-14 items-center justify-center rounded-full bg-surface-2 active:bg-surface-3" style={{ touchAction: 'none' }} {...dec}>
          <Minus className="size-6" />
        </button>
        <span className="tabular w-24 text-center text-6xl font-extrabold">{amount}</span>
        <button aria-label="More" className="flex size-14 items-center justify-center rounded-full bg-surface-2 active:bg-surface-3" style={{ touchAction: 'none' }} {...inc}>
          <Plus className="size-6" />
        </button>
      </div>
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {[3, 5, 7, 10].map((n) => (
          <button key={n} onClick={() => setAmount(n)} className="h-9 rounded-full bg-surface-2 px-4 text-sm font-medium active:bg-surface-3">
            {n}
          </button>
        ))}
      </div>
      <p className="mb-2 text-sm text-muted">From</p>
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setCommander(null)}
          className={`h-10 rounded-full px-4 text-sm font-medium ${commander === null ? 'bg-white text-black' : 'bg-surface-2'}`}
        >
          Something else
        </button>
        {slots.map((c) => (
          <button
            key={c.idx}
            onClick={() => setCommander(c.idx)}
            className={`flex h-10 items-center gap-2 rounded-full pr-4 pl-1 text-sm font-medium ${commander === c.idx ? 'bg-white text-black' : 'bg-surface-2'}`}
          >
            <span className="relative size-8 overflow-hidden rounded-full bg-surface-3 ring-2 ring-gold/80">
              {c.artUrl && <img src={c.artUrl} alt="" className="size-full object-cover" />}
            </span>
            {c.label}
          </button>
        ))}
      </div>
      <Button
        variant="danger"
        size="lg"
        className="w-full bg-danger! text-white!"
        onClick={() => {
          haptic(15)
          record({ type: 'life', target: to, amount: -amount, source: from, commander: commander ?? undefined })
          onClose()
        }}
      >
        Deal {amount} {commander !== null ? 'commander ' : ''}damage
      </Button>
      <p className="mt-3 text-center text-xs text-muted">Only one of you needs to log it. Usually the player taking the damage does.</p>
    </Sheet>
  )
}

/** QR code for the current game's link, so other phones can jump straight in. */
export function InviteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { game } = useGameCtx()
  const [copied, setCopied] = useState(false)
  const url = `${location.origin}/game/${game.id}`
  const qr = open ? encode(url, { ecc: 'M' }) : null
  return (
    <Sheet open={open} onClose={onClose} title="Join this game">
      {qr && (
        <div className="mx-auto w-full max-w-64 rounded-2xl bg-white p-4">
          <svg viewBox={`0 0 ${qr.size} ${qr.size}`} className="block w-full" shapeRendering="crispEdges" aria-label="QR code for this game">
            {qr.data.flatMap((row, y) => row.map((on, x) => (on ? <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill="#0c0d10" /> : null)))}
          </svg>
        </div>
      )}
      <p className="mt-4 text-center text-sm text-muted">Scan with the other phones' cameras. They'll open this game and pick their seat.</p>
      <Button
        className="mt-4 w-full"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
          } catch {
            // Clipboard blocked; the QR still works.
          }
        }}
      >
        {copied ? 'Link copied' : 'Copy link'}
      </Button>
    </Sheet>
  )
}

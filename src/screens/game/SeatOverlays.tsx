import { Biohazard, Crown, Delete, Keyboard, Minus, Plus, Skull, Swords, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { CAUSE_LABEL, LETHAL_COMMANDER, LETHAL_POISON, type EliminationCause } from '../../game/events'
import { haptic } from '../../lib/device'
import { commanderSlots, useGameCtx } from './context'
import { useBufferedDelta, usePressRepeat } from './hooks'

/** Full-panel overlay, drawn inside the rotated frame so it faces the right player. */
function PanelOverlay({ children, onClose, title }: { children: ReactNode; onClose?: () => void; title?: ReactNode }) {
  return (
    <div className="animate-fade-in absolute inset-0 z-40 flex flex-col bg-[#0e0f13]/95 px-[4cqw] pt-[4cqh] pb-[4cqh] backdrop-blur-sm">
      {(title || onClose) && (
        <div className="mb-[2cqh] flex shrink-0 items-center gap-2">
          <div className="min-w-0 flex-1 truncate text-[clamp(13px,8.5cqh,18px)] font-semibold">{title}</div>
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="flex size-[clamp(28px,15cqh,38px)] items-center justify-center rounded-full bg-white/10 active:bg-white/20">
              <X className="size-4" />
            </button>
          )}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

export function SeatMenuOverlay({ seat, onClose, onOpen }: { seat: number; onClose: () => void; onOpen: (o: 'counters' | 'keypad' | 'out') => void }) {
  const { seats } = useGameCtx()
  const items = [
    { key: 'counters' as const, icon: <Swords className="size-[14cqh] min-h-5 min-w-5" />, label: 'Commander damage & poison' },
    { key: 'keypad' as const, icon: <Keyboard className="size-[14cqh] min-h-5 min-w-5" />, label: 'Enter an amount' },
    { key: 'out' as const, icon: <Skull className="size-[14cqh] min-h-5 min-w-5" />, label: "I'm out" },
  ]
  return (
    <PanelOverlay title={seats[seat].name} onClose={onClose}>
      <div className="grid flex-1 grid-cols-3 gap-[2.5cqw]">
        {items.map((it) => (
          <button
            key={it.key}
            onClick={() => onOpen(it.key)}
            className="flex flex-col items-center justify-center gap-[3cqh] rounded-2xl bg-white/8 px-2 text-center text-[clamp(11px,7cqh,15px)] leading-tight font-medium active:bg-white/15"
          >
            {it.icon}
            {it.label}
          </button>
        ))}
      </div>
    </PanelOverlay>
  )
}

const MANUAL_CAUSES: EliminationCause[] = ['concede', 'damage', 'commander', 'poison', 'mill', 'other']

/**
 * "Are you out?" Shown automatically at a lethal state (with the likely cause and killer
 * preselected), or opened manually from the seat menu (pick a cause).
 */
export function OutOverlay({
  seat,
  cause,
  suggestedKiller,
  onDone,
}: {
  seat: number
  cause: EliminationCause | null
  suggestedKiller: number | undefined
  onDone: () => void
}) {
  const { seats, state, record } = useGameCtx()
  const [picked, setPicked] = useState<EliminationCause>(cause ?? 'concede')
  const [killer, setKiller] = useState<number | undefined>(suggestedKiller)
  const others = seats.map((_, i) => i).filter((i) => i !== seat)
  const st = state.seats[seat]

  const title =
    cause === 'commander'
      ? `${LETHAL_COMMANDER} commander damage. Out?`
      : cause === 'poison'
        ? `${st.poison} poison. Out?`
        : cause === 'damage'
          ? `${st.life} life. Out?`
          : 'How did you go out?'

  const needsKiller = picked !== 'concede'

  return (
    <PanelOverlay title={<span className={cause ? 'text-danger' : ''}>{title}</span>}>
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-[2cqh]">
        <div className="min-h-0 space-y-[2.5cqh] overflow-y-auto">
          {cause === null && (
            <ChipRow>
              {MANUAL_CAUSES.map((c) => (
                <Chip key={c} active={picked === c} onClick={() => setPicked(c)}>
                  {CAUSE_LABEL[c]}
                </Chip>
              ))}
            </ChipRow>
          )}
          {needsKiller && (
            <ChipRow label="By">
              {others.map((o) => (
                <Chip key={o} active={killer === o} onClick={() => setKiller(killer === o ? undefined : o)} color={seats[o].hex}>
                  {seats[o].name}
                </Chip>
              ))}
            </ChipRow>
          )}
        </div>
        <div className="flex shrink-0 gap-[2cqw]">
          <button onClick={onDone} className="h-[clamp(36px,20cqh,50px)] flex-1 rounded-xl bg-white/10 text-[clamp(13px,8cqh,17px)] font-semibold active:bg-white/20">
            {cause ? 'Not yet' : 'Cancel'}
          </button>
          <button
            onClick={() => {
              haptic([20, 40, 20])
              record({ type: 'eliminate', target: seat, cause: cause ?? picked, by: needsKiller ? killer : undefined })
              onDone()
            }}
            className="flex h-[clamp(36px,20cqh,50px)] flex-1 items-center justify-center gap-2 rounded-xl bg-danger text-[clamp(13px,8cqh,17px)] font-semibold text-white active:brightness-90"
          >
            <Skull className="size-4" /> I'm out
          </button>
        </div>
      </div>
    </PanelOverlay>
  )
}

function ChipRow({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="shrink-0 text-[clamp(11px,7cqh,14px)] text-white/60">{label}</span>}
      <div className="scrollbar-none flex gap-1.5 overflow-x-auto">{children}</div>
    </div>
  )
}

function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-[clamp(30px,16cqh,40px)] shrink-0 items-center gap-1.5 rounded-full px-3 text-[clamp(12px,7.5cqh,15px)] font-medium transition ${
        active ? 'bg-white text-black' : 'bg-white/10 text-white active:bg-white/20'
      }`}
    >
      {color && <span className="size-2.5 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  )
}

/** Commander damage and poison taken, one row per opponent. */
export function CountersOverlay({ seat, onClose }: { seat: number; onClose: () => void }) {
  const { seats, state } = useGameCtx()
  const others = seats.map((_, i) => i).filter((i) => i !== seat)
  return (
    <PanelOverlay title={`Damage taken by ${seats[seat].name}`} onClose={onClose}>
      <div className="min-h-0 flex-1 space-y-[2cqh] overflow-y-auto">
        {others.map((o) => (
          <div key={o} className="flex items-center gap-[2cqw]">
            <div className="flex w-[15cqw] min-w-0 shrink-0 items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: seats[o].hex }} />
              <span className="truncate text-[clamp(11px,7cqh,15px)] font-medium">{seats[o].name}</span>
            </div>
            <div className="scrollbar-none flex min-w-0 flex-1 gap-[2cqw] overflow-x-auto">
              {commanderSlots(seats[o]).map((c) => (
                <CounterCell
                  key={c.idx}
                  value={state.seats[seat].commanderDamage[o][c.idx] ?? 0}
                  lethal={LETHAL_COMMANDER}
                  icon={
                    <span className="relative size-[clamp(22px,13cqh,30px)] shrink-0 overflow-hidden rounded-full bg-surface-3 ring-2 ring-gold/80">
                      {c.artUrl && <img src={c.artUrl} alt="" className="size-full object-cover" />}
                      {!c.artUrl && <Crown className="absolute inset-0 m-auto size-3.5 text-gold" />}
                    </span>
                  }
                  label={`${c.label} commander damage`}
                  kind={{ type: 'life', source: o, commander: c.idx }}
                  seat={seat}
                />
              ))}
              <CounterCell
                value={state.seats[seat].poisonFrom[o]}
                lethal={LETHAL_POISON}
                icon={<Biohazard className="size-[clamp(18px,11cqh,24px)] shrink-0 text-poison" />}
                label={`Poison from ${seats[o].name}`}
                kind={{ type: 'poison', source: o }}
                seat={seat}
              />
            </div>
          </div>
        ))}
        <p className="pt-1 text-[clamp(10px,6cqh,12px)] text-white/45">
          Commander damage also changes life. Total poison: {state.seats[seat].poison}/{LETHAL_POISON}
        </p>
      </div>
    </PanelOverlay>
  )
}

function CounterCell({
  value,
  lethal,
  icon,
  label,
  kind,
  seat,
}: {
  value: number
  lethal: number
  icon: ReactNode
  label: string
  kind: { type: 'life'; source: number; commander: number } | { type: 'poison'; source: number }
  seat: number
}) {
  const { record } = useGameCtx()
  const { pending, bump } = useBufferedDelta((amount) => {
    if (kind.type === 'life') record({ type: 'life', target: seat, amount: -amount, source: kind.source, commander: kind.commander })
    else record({ type: 'poison', target: seat, amount, source: kind.source })
  }, 1100)
  const shown = Math.max(0, value + pending)
  const dec = usePressRepeat(() => {
    if (value + pending > 0) {
      haptic(5)
      bump(-1)
    }
  })
  const inc = usePressRepeat(() => {
    haptic(5)
    bump(1)
  })
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-white/6 p-0.5" aria-label={label}>
      <button aria-label={`Less ${label}`} className="flex size-[clamp(26px,14cqh,36px)] items-center justify-center rounded-full active:bg-white/15" style={{ touchAction: 'none' }} {...dec}>
        <Minus className="size-4" />
      </button>
      {icon}
      <span className={`tabular w-[2.4ch] text-center text-[clamp(13px,9cqh,19px)] font-bold ${shown >= lethal ? 'text-danger' : ''}`}>
        {shown}
      </span>
      <button aria-label={`More ${label}`} className="flex size-[clamp(26px,14cqh,36px)] items-center justify-center rounded-full active:bg-white/15" style={{ touchAction: 'none' }} {...inc}>
        <Plus className="size-4" />
      </button>
    </div>
  )
}

export function KeypadOverlay({ seat, onClose, onAmount }: { seat: number; onClose: () => void; onAmount: (amount: number) => void }) {
  const { seats } = useGameCtx()
  const [digits, setDigits] = useState('')
  const n = Number(digits || '0')
  const press = (d: string) => {
    haptic(5)
    setDigits((cur) => (cur.length >= 3 ? cur : (cur + d).replace(/^0+/, '')))
  }
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫']
  return (
    <PanelOverlay title={`${seats[seat].name}: enter amount`} onClose={onClose}>
      <div className="flex min-h-0 flex-1 gap-[3cqw]">
        <div className="flex w-[38%] flex-col gap-[2cqh]">
          <div className="tabular flex flex-1 items-center justify-center rounded-xl bg-white/6 text-[clamp(28px,24cqh,64px)] font-extrabold">{n}</div>
          <div className="flex gap-[2cqw]">
            <button
              disabled={n === 0}
              onClick={() => onAmount(-n)}
              className="h-[clamp(34px,18cqh,48px)] flex-1 rounded-xl bg-danger text-[clamp(12px,7.5cqh,16px)] font-semibold text-white disabled:opacity-30"
            >
              Lose
            </button>
            <button
              disabled={n === 0}
              onClick={() => onAmount(n)}
              className="h-[clamp(34px,18cqh,48px)] flex-1 rounded-xl bg-good text-[clamp(12px,7.5cqh,16px)] font-semibold text-black disabled:opacity-30"
            >
              Gain
            </button>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-[1.5cqw]">
          {keys.map((k) => (
            <button
              key={k}
              onClick={() => (k === 'C' ? setDigits('') : k === '⌫' ? setDigits((c) => c.slice(0, -1)) : press(k))}
              className="flex items-center justify-center rounded-lg bg-white/8 text-[clamp(14px,9cqh,22px)] font-semibold active:bg-white/20"
            >
              {k === '⌫' ? <Delete className="size-5" /> : k}
            </button>
          ))}
        </div>
      </div>
    </PanelOverlay>
  )
}

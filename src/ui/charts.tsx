import { useState, type ReactNode } from 'react'

export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular mt-1 text-[1.35rem] leading-tight font-bold whitespace-nowrap">{value}</p>
      {sub && <p className="mt-1 text-xs text-faint">{sub}</p>}
    </div>
  )
}

/**
 * A labelled horizontal bar: label on the left, value at the end. Used for every ranked
 * list in stats, so values are always printed and never carried by color alone.
 */
export function BarRow({
  label,
  value,
  fraction,
  color = 'var(--color-gold)',
  onClick,
  title,
}: {
  label: ReactNode
  value: ReactNode
  fraction: number
  color?: string
  onClick?: () => void
  title?: string
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} title={title} className="flex w-full items-center gap-3 py-1.5 text-left">
      <div className="w-[8.5rem] min-w-0 shrink-0 truncate text-sm">{label}</div>
      <div className="h-2.5 min-w-0 flex-1 rounded-r bg-surface-2">
        <div className="h-full rounded-r" style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, background: color, minWidth: fraction > 0 ? 4 : 0 }} />
      </div>
      <div className="tabular w-14 shrink-0 text-right text-sm text-muted">{value}</div>
    </Tag>
  )
}

export interface ColumnDatum {
  key: string
  label: ReactNode
  value: number
  color: string
  tooltip: ReactNode
}

/** Vertical bars along a baseline, with a tap/hover tooltip. Used for the turn-by-turn timeline. */
export function ColumnStrip({ data, height = 120, emptyLabel }: { data: ColumnDatum[]; height?: number; emptyLabel?: string }) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  if (data.length === 0) return <p className="py-6 text-center text-sm text-muted">{emptyLabel}</p>
  const shown = active !== null ? data[active] : null
  return (
    <div onMouseLeave={() => setActive(null)}>
      <div className="mb-2 h-10 text-sm">
        {shown ? <div className="animate-fade-in">{shown.tooltip}</div> : <p className="pt-2 text-xs text-faint">Tap a bar for details</p>}
      </div>
      <div className="flex items-end gap-[2px] border-b border-line" style={{ height }}>
        {data.map((d, i) => (
          <button
            key={d.key}
            type="button"
            aria-label={typeof d.label === 'string' ? d.label : undefined}
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive(i)}
            className="flex h-full min-w-[3px] flex-1 items-end"
          >
            <span
              className="block w-full rounded-t-[3px] transition-opacity"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: 2, background: d.color, opacity: active === null || active === i ? 1 : 0.35 }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

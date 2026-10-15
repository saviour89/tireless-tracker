import { ChevronLeft, X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import type { Commander, Deck, ManaColor, Player } from '../data/types'
import { MANA, playerHex, sortColors } from '../lib/colors'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gold text-black font-semibold active:brightness-90 disabled:opacity-40',
  secondary: 'bg-surface-2 text-fg border border-line active:bg-surface-3 disabled:opacity-40',
  ghost: 'text-fg active:bg-surface-2 disabled:opacity-40',
  danger: 'bg-danger/15 text-danger border border-danger/30 active:bg-danger/25 disabled:opacity-40',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-9 px-3 text-sm rounded-lg', md: 'h-11 px-4 rounded-xl', lg: 'h-14 px-5 text-lg rounded-2xl' }
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 transition select-none ${sizes[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function IconButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex size-10 items-center justify-center rounded-full text-fg transition active:bg-surface-3 disabled:opacity-30 ${className}`}
      {...props}
    />
  )
}

/** Page header with optional back button and trailing actions. */
export function Header({ title, back, children }: { title: ReactNode; back?: boolean | string; children?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="pt-safe sticky top-0 z-20 bg-bg/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-1 px-2">
        {back ? (
          <IconButton aria-label="Back" onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}>
            <ChevronLeft className="size-6" />
          </IconButton>
        ) : (
          <div className="w-2" />
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
        {children}
      </div>
    </header>
  )
}

/** Modal bottom sheet. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  className = '',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  // Portaled to <body> so a transformed ancestor can't turn `fixed` into "fixed to that ancestor".
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="animate-fade-in absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className={`animate-slide-up pb-safe relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border-t border-line bg-surface shadow-2xl ${className}`}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-surface-3" />
        {title && (
          <div className="flex shrink-0 items-center gap-2 py-2 pr-2 pl-5">
            <h2 className="flex-1 text-lg font-semibold">{title}</h2>
            <IconButton aria-label="Close" onClick={onClose}>
              <X className="size-5" />
            </IconButton>
          </div>
        )}
        <div className="min-h-0 overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function PlayerDot({ player, size = 32, className = '' }: { player?: Pick<Player, 'name' | 'color'>; size?: number; className?: string }) {
  const hex = playerHex(player?.color)
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-black/80 ${className}`}
      style={{ width: size, height: size, background: hex, fontSize: size * 0.45 }}
    >
      {player?.name.trim().charAt(0).toUpperCase() ?? '?'}
    </span>
  )
}

export function ManaPips({ colors, size = 12 }: { colors: ManaColor[]; size?: number }) {
  if (colors.length === 0) {
    return <span className="inline-block rounded-full border border-white/30 bg-[#bdb6aa]" style={{ width: size, height: size }} title="Colorless" />
  }
  return (
    <span className="inline-flex gap-0.5">
      {sortColors(colors).map((c) => (
        <span
          key={c}
          title={MANA[c].name}
          className="inline-block rounded-full ring-1 ring-black/40"
          style={{ width: size, height: size, background: MANA[c].hex }}
        />
      ))}
    </span>
  )
}

/** Gradient built from color identity; used behind or instead of card art. */
export function colorGradient(colors: ManaColor[], alpha = 1): string {
  const cs = sortColors(colors)
  const hexes = cs.length ? cs.map((c) => MANA[c].hex) : ['#6f6a62', '#3c3a36']
  if (hexes.length === 1) hexes.push(hexes[0])
  const withAlpha = hexes.map((h) => (alpha < 1 ? `color-mix(in srgb, ${h} ${alpha * 100}%, transparent)` : h))
  return `linear-gradient(135deg, ${withAlpha.join(', ')})`
}

/** Commander art (split in two for partners), falling back to a color-identity gradient. */
export function DeckArt({ deck, className = '', rounded = 'rounded-xl' }: { deck?: Pick<Deck, 'commanders' | 'colors'> | null; className?: string; rounded?: string }) {
  const commanders = (deck?.commanders ?? []).filter((c): c is Commander & { artUrl: string } => !!c.artUrl)
  return (
    <div className={`flex overflow-hidden ${rounded} ${className}`} style={{ background: colorGradient(deck?.colors ?? []) }}>
      {commanders.map((c) => (
        <img key={c.name} src={c.artUrl} alt="" loading="lazy" draggable={false} className="h-full min-w-0 flex-1 object-cover" />
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-muted">{icon}</div>
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-6 mb-2 flex items-center justify-between px-1">
      <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">{children}</h2>
      {action}
    </div>
  )
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`block w-full rounded-2xl border border-line bg-surface text-left ${onClick ? 'transition active:bg-surface-2' : ''} ${className}`}
    >
      {children}
    </Tag>
  )
}

export function TextField({
  label,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1.5 block text-sm text-muted">{label}</span>}
      <input
        className="h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-base text-fg placeholder:text-faint focus:border-gold/60 focus:outline-none"
        {...props}
      />
    </label>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-9 flex-1 rounded-lg text-sm font-medium transition ${o.value === value ? 'bg-surface-3 text-fg shadow' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

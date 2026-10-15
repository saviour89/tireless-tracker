/** 75_000 → "1:15", 3_725_000 → "1:02:05". */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** 75_000 → "1m 15s", 3_725_000 → "1h 2m". For summaries, where precision matters less. */
export function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return s && m < 10 ? `${m}m ${s}s` : `${m}m`
  return `${s}s`
}

export function relativeDay(ts: number, now = Date.now()): string {
  const day = (t: number) => {
    const d = new Date(t)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  const diff = Math.round((day(now) - day(ts)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return new Date(ts).toLocaleDateString(undefined, { weekday: 'long' })
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: new Date(ts).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
  })
}

export function timeOfDay(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function pct(n: number, d: number): string {
  return d === 0 ? '–' : `${Math.round((n / d) * 100)}%`
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

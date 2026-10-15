import { LoaderCircle, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Commander } from '../data/types'
import { autocompleteCards, searchCommanders } from '../lib/scryfall'
import { ManaPips } from './kit'

/** Debounced async search that cancels stale requests. */
function useSearch<T>(term: string, fn: (q: string, signal: AbortSignal) => Promise<T[]>, enabled = true) {
  const [results, setResults] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!enabled || term.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    const t = setTimeout(() => {
      fn(term, ctrl.signal)
        .then((r) => {
          setResults(r)
          setError(false)
        })
        .catch((e) => {
          if (!ctrl.signal.aborted) setError(e instanceof Error && e.name !== 'AbortError')
        })
        .finally(() => !ctrl.signal.aborted && setLoading(false))
    }, 250)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [term, fn, enabled])
  return { results, loading, error }
}

function SearchInput({ value, onChange, placeholder, loading, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; loading?: boolean; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-faint" />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="h-12 w-full rounded-xl border border-line bg-surface-2 pr-10 pl-10 text-base text-fg placeholder:text-faint focus:border-gold/60 focus:outline-none"
      />
      {loading && <LoaderCircle className="absolute top-1/2 right-3.5 size-4.5 -translate-y-1/2 animate-spin text-faint" />}
    </div>
  )
}

/** Free-text card name with Scryfall suggestions. */
export function CardSearchField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const { results, loading } = useSearch(value, autocompleteCards, focused && value !== picked)
  return (
    <div onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}>
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      <SearchInput value={value} onChange={onChange} placeholder={placeholder} loading={loading} />
      {focused && results.length > 0 && value !== picked && (
        <ul className="mt-1 overflow-hidden rounded-xl border border-line bg-surface-2">
          {results.map((name) => (
            <li key={name}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setPicked(name)
                  onChange(name)
                }}
                className="block w-full px-4 py-2.5 text-left text-sm active:bg-surface-3"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Commander picker: search Scryfall, show art, pick one. */
export function CommanderSearch({ onPick, autoFocus }: { onPick: (c: Commander) => void; autoFocus?: boolean }) {
  const [term, setTerm] = useState('')
  const { results, loading, error } = useSearch(term, searchCommanders)
  return (
    <div>
      <SearchInput value={term} onChange={setTerm} placeholder="Search commanders" loading={loading} autoFocus={autoFocus} />
      {error && <p className="mt-3 text-sm text-danger">Couldn't reach Scryfall. Check your connection.</p>}
      {!loading && !error && term.trim().length >= 2 && results.length === 0 && <p className="mt-3 text-sm text-muted">No commanders match “{term}”.</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {results.map((c) => (
          <button key={c.scryfallId} type="button" onClick={() => onPick(c)} className="overflow-hidden rounded-xl border border-line bg-surface-2 text-left active:brightness-110">
            <div className="aspect-[4/3] bg-surface-3">{c.artUrl && <img src={c.artUrl} alt="" loading="lazy" className="size-full object-cover" />}</div>
            <div className="p-2">
              <p className="line-clamp-2 text-sm leading-tight font-medium">{c.name}</p>
              <div className="mt-1">
                <ManaPips colors={c.colors} size={10} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

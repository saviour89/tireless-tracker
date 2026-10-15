import { ScrollText } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useGames, useLookups, usePlayers } from '../data/hooks'
import type { Game } from '../data/types'
import { GameCard } from '../ui/GameCard'
import { EmptyState, Header, PlayerDot } from '../ui/kit'

export function History() {
  const games = useGames()
  const players = usePlayers()
  const lookups = useLookups()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<string | null>(null)
  const [showAbandoned, setShowAbandoned] = useState(false)
  if (!games || !players || !lookups.ready) return null

  const visible = games.filter(
    (g) => (showAbandoned || g.status !== 'abandoned') && (!filter || g.seats.some((s) => s.playerId === filter)),
  )
  const months = new Map<string, Game[]>()
  for (const g of visible) {
    const key = new Date(g.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    months.set(key, [...(months.get(key) ?? []), g])
  }

  return (
    <div>
      <Header title="Games" />
      {players.length > 1 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-2">
          <FilterChip active={!filter} onClick={() => setFilter(null)}>
            Everyone
          </FilterChip>
          {players.map((p) => (
            <FilterChip key={p.id} active={filter === p.id} onClick={() => setFilter(filter === p.id ? null : p.id)}>
              <PlayerDot player={p} size={18} /> {p.name}
            </FilterChip>
          ))}
        </div>
      )}
      <div className="px-4">
        {visible.length === 0 && (
          <EmptyState icon={<ScrollText className="size-6" />} title="No games here yet">
            {filter ? 'Nobody matching this filter has played.' : 'Finished games show up here.'}
          </EmptyState>
        )}
        {[...months].map(([month, list]) => (
          <section key={month}>
            <h2 className="mt-5 mb-2 px-1 text-xs font-semibold tracking-wider text-muted uppercase">
              {month} · {list.length}
            </h2>
            <div className="space-y-2">
              {list.map((g) => (
                <GameCard key={g.id} game={g} lookups={lookups} onClick={() => navigate(g.status === 'active' ? `/game/${g.id}` : `/games/${g.id}`)} />
              ))}
            </div>
          </section>
        ))}
        {games.some((g) => g.status === 'abandoned') && (
          <button onClick={() => setShowAbandoned(!showAbandoned)} className="mt-6 w-full py-2 text-sm text-faint">
            {showAbandoned ? 'Hide abandoned games' : 'Show abandoned games'}
          </button>
        )}
      </div>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition ${active ? 'bg-fg text-bg' : 'bg-surface-2 text-fg'}`}
    >
      {children}
    </button>
  )
}

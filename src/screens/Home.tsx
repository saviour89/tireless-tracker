import { ChevronRight, Plus, Swords } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useGames, useLookups } from '../data/hooks'
import { GameCard } from '../ui/GameCard'
import { Logo } from '../ui/Logo'
import { Button, SectionTitle } from '../ui/kit'

export function Home() {
  const games = useGames()
  const lookups = useLookups()
  const navigate = useNavigate()
  if (!games || !lookups.ready) return null

  const active = games.filter((g) => g.status === 'active')
  const recent = games.filter((g) => g.status === 'finished').slice(0, 3)

  return (
    <div className="pt-safe px-4">
      <div className="flex items-center gap-3 pt-6 pb-2">
        <Logo className="size-10" />
        <div>
          <h1 className="text-xl leading-tight font-bold">Tireless Tracker</h1>
          <p className="text-sm text-muted">{games.filter((g) => g.status === 'finished').length} games tracked</p>
        </div>
      </div>

      {active.length > 0 && (
        <>
          <SectionTitle>Game in progress</SectionTitle>
          <div className="space-y-2">
            {active.map((g) => (
              <GameCard key={g.id} game={g} lookups={lookups} onClick={() => navigate(`/game/${g.id}`)} />
            ))}
          </div>
        </>
      )}

      <Button variant="primary" size="lg" className="mt-6 w-full" onClick={() => navigate('/new')}>
        <Plus className="size-5" /> New game
      </Button>

      {recent.length > 0 ? (
        <>
          <SectionTitle
            action={
              <button onClick={() => navigate('/games')} className="flex items-center text-sm text-muted">
                All <ChevronRight className="size-4" />
              </button>
            }
          >
            Recent games
          </SectionTitle>
          <div className="space-y-2">
            {recent.map((g) => (
              <GameCard key={g.id} game={g} lookups={lookups} onClick={() => navigate(`/games/${g.id}`)} />
            ))}
          </div>
        </>
      ) : (
        active.length === 0 && (
          <div className="mt-10 rounded-3xl border border-dashed border-line px-6 py-10 text-center">
            <Swords className="mx-auto size-8 text-faint" />
            <p className="mt-3 font-semibold">No games yet</p>
            <p className="mt-1 text-sm text-muted">Start a game and put the phone in the middle of the table. Everything you tap becomes stats.</p>
          </div>
        )
      )}
    </div>
  )
}

import { Archive, ArchiveRestore, ChevronRight, Layers, Pencil, Plus, Settings, Trash, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useDecks, useGames, useLookups, usePlayers } from '../data/hooks'
import { updateDeck, updatePlayer } from '../data/repo'
import type { Deck } from '../data/types'
import { duration, pct } from '../lib/format'
import { avgTurnMs, computeStats, favoriteVictim, finishedGames, nemesis, type Stats } from '../stats/stats'
import { StatTile } from '../ui/charts'
import { BRACKETS, DeckEditor, PlayerForm } from '../ui/forms'
import { GameCard } from '../ui/GameCard'
import { Button, Card, DeckArt, EmptyState, Header, IconButton, ManaPips, PlayerDot, SectionTitle, Sheet } from '../ui/kit'

function useStats(): Stats | null {
  const games = useGames()
  return useMemo(() => (games ? computeStats(finishedGames(games)) : null), [games])
}

export function Pod() {
  const players = usePlayers()
  const decks = useDecks()
  const stats = useStats()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  if (!players || !decks || !stats) return null

  return (
    <div>
      <Header title="Pod">
        <IconButton aria-label="Add player" onClick={() => setAdding(true)}>
          <UserPlus className="size-5" />
        </IconButton>
        <IconButton aria-label="Settings" onClick={() => navigate('/settings')}>
          <Settings className="size-5" />
        </IconButton>
      </Header>
      <div className="px-4">
        {players.length === 0 ? (
          <EmptyState icon={<Users className="size-6" />} title="No players yet">
            <Button variant="primary" className="mt-4" onClick={() => setAdding(true)}>
              <UserPlus className="size-4" /> Add your first player
            </Button>
          </EmptyState>
        ) : (
          <div className="space-y-2 pt-2">
            {players.map((p) => {
              const own = decks.filter((d) => d.ownerId === p.id && !d.retired)
              const t = stats.players.find((x) => x.id === p.id)
              return (
                <Card key={p.id} onClick={() => navigate(`/pod/player/${p.id}`)} className="flex items-center gap-3 p-3">
                  <PlayerDot player={p} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-sm text-muted">
                      {t ? `${t.wins}W in ${t.games} · ${pct(t.wins, t.games)}` : 'No games yet'} · {own.length} {own.length === 1 ? 'deck' : 'decks'}
                    </p>
                  </div>
                  <div className="flex -space-x-3">
                    {own.slice(0, 3).map((d) => (
                      <DeckArt key={d.id} deck={d} className="size-9 border-2 border-surface" rounded="rounded-full" />
                    ))}
                  </div>
                  <ChevronRight className="size-4 text-faint" />
                </Card>
              )
            })}
          </div>
        )}
      </div>
      <Sheet open={adding} onClose={() => setAdding(false)} title="New player">
        <PlayerForm takenColors={players.map((p) => p.color)} onDone={() => setAdding(false)} />
      </Sheet>
    </div>
  )
}

export function PlayerPage() {
  const { id } = useParams()
  const lookups = useLookups()
  const decks = useDecks()
  const games = useGames()
  const stats = useStats()
  const navigate = useNavigate()
  const [sheet, setSheet] = useState<null | 'edit' | 'deck'>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showRetired, setShowRetired] = useState(false)
  if (!lookups.ready || !decks || !games || !stats) return null
  const player = id ? lookups.player.get(id) : undefined
  if (!player || player.deleted) return <Navigate to="/pod" replace />

  const t = stats.players.find((x) => x.id === player.id)
  const own = decks.filter((d) => d.ownerId === player.id)
  const active = own.filter((d) => !d.retired)
  const retired = own.filter((d) => d.retired)
  const nem = nemesis(stats, player.id)
  const victim = favoriteVictim(stats, player.id)
  const recent = games.filter((g) => g.status === 'finished' && g.seats.some((s) => s.playerId === player.id)).slice(0, 5)
  const name = (pid: string) => lookups.player.get(pid)?.name ?? '?'

  return (
    <div className="mx-auto min-h-full max-w-lg pb-10">
      <Header title="" back>
        <IconButton aria-label="Edit player" onClick={() => setSheet('edit')}>
          <Pencil className="size-5" />
        </IconButton>
      </Header>
      <div className="px-4">
        <div className="flex items-center gap-4 pb-2">
          <PlayerDot player={player} size={64} />
          <div>
            <h1 className="text-2xl font-bold">{player.name}</h1>
            <p className="text-muted">{t ? `${t.games} games · ${t.wins} wins` : 'No games yet'}</p>
          </div>
        </div>

        {t && (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatTile label="Win rate" value={pct(t.wins, t.games)} />
              <StatTile label="Avg place" value={(t.placeSum / t.games).toFixed(1)} />
              <StatTile label="Kills" value={t.kills} />
              <StatTile label="Avg turn" value={duration(avgTurnMs(t))} />
              <StatTile label="Dmg / game" value={Math.round(t.damage / t.games)} />
              <StatTile label="Combo wins" value={t.comboWins} />
            </div>
            {(nem || victim) && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {nem && <StatTile label="Nemesis" value={<span className="text-lg">{name(nem.id)}</span>} sub={`took you out ${nem.count}×`} />}
                {victim && <StatTile label="Favorite target" value={<span className="text-lg">{name(victim.id)}</span>} sub={`you took them out ${victim.count}×`} />}
              </div>
            )}
          </>
        )}

        <SectionTitle
          action={
            <button onClick={() => setSheet('deck')} className="flex items-center gap-1 text-sm text-gold">
              <Plus className="size-4" /> Add
            </button>
          }
        >
          Decks
        </SectionTitle>
        {active.length === 0 && <p className="px-1 text-sm text-muted">No decks yet.</p>}
        <div className="space-y-2">
          {active.map((d) => (
            <DeckRow key={d.id} deck={d} stats={stats} onClick={() => navigate(`/pod/deck/${d.id}`)} />
          ))}
        </div>
        {retired.length > 0 && (
          <>
            <button onClick={() => setShowRetired(!showRetired)} className="mt-3 px-1 text-sm text-faint">
              {showRetired ? 'Hide' : 'Show'} {retired.length} retired
            </button>
            {showRetired && (
              <div className="mt-2 space-y-2 opacity-70">
                {retired.map((d) => (
                  <DeckRow key={d.id} deck={d} stats={stats} onClick={() => navigate(`/pod/deck/${d.id}`)} />
                ))}
              </div>
            )}
          </>
        )}

        {recent.length > 0 && (
          <>
            <SectionTitle>Recent games</SectionTitle>
            <div className="space-y-2">
              {recent.map((g) => (
                <GameCard key={g.id} game={g} lookups={lookups} onClick={() => navigate(`/games/${g.id}`)} />
              ))}
            </div>
          </>
        )}

        <div className="mt-10">
          {confirmDelete ? (
            <Button
              variant="danger"
              className="w-full"
              onClick={async () => {
                await updatePlayer(player.id, { deleted: true })
                navigate('/pod', { replace: true })
              }}
            >
              Remove {player.name}? Their past games stay in stats.
            </Button>
          ) : (
            <Button variant="ghost" className="w-full text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash className="size-4" /> Remove player
            </Button>
          )}
        </div>
      </div>

      <Sheet open={sheet === 'edit'} onClose={() => setSheet(null)} title="Edit player">
        <PlayerForm player={player} onDone={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'deck'} onClose={() => setSheet(null)} title={`New deck for ${player.name}`}>
        {sheet === 'deck' && <DeckEditor ownerId={player.id} onSaved={() => setSheet(null)} />}
      </Sheet>
    </div>
  )
}

function DeckRow({ deck, stats, onClick }: { deck: Deck; stats: Stats; onClick: () => void }) {
  const t = stats.decks.find((x) => x.id === deck.id)
  return (
    <Card onClick={onClick} className="flex items-center gap-3 p-2">
      <DeckArt deck={deck} className="h-14 w-20 shrink-0" rounded="rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{deck.name}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted">
          <ManaPips colors={deck.colors} size={10} />
          {deck.bracket && <span>B{deck.bracket}</span>}
          <span>{t ? `${t.wins}/${t.games} wins` : 'Unplayed'}</span>
        </div>
      </div>
      <ChevronRight className="size-4 text-faint" />
    </Card>
  )
}

export function DeckPage() {
  const { id } = useParams()
  const lookups = useLookups()
  const games = useGames()
  const stats = useStats()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!lookups.ready || !games || !stats) return null
  const deck = id ? lookups.deck.get(id) : undefined
  if (!deck || deck.deleted) return <Navigate to="/pod" replace />

  const owner = lookups.player.get(deck.ownerId)
  const t = stats.decks.find((x) => x.id === deck.id)
  const recent = games.filter((g) => g.status === 'finished' && g.seats.some((s) => s.deckId === deck.id)).slice(0, 5)

  return (
    <div className="mx-auto min-h-full max-w-lg pb-10">
      <div className="relative">
        <DeckArt deck={deck} rounded="rounded-none" className="h-64 w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-black/40" />
        <div className="absolute inset-x-0 top-0">
          <Header title="" back>
            <IconButton aria-label="Edit deck" onClick={() => setEditing(true)}>
              <Pencil className="size-5" />
            </IconButton>
          </Header>
        </div>
        <div className="absolute inset-x-0 bottom-0 px-4 pb-2">
          <h1 className="text-2xl font-bold">{deck.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted">
            <PlayerDot player={owner} size={18} />
            <span>{owner?.name}</span>
            <ManaPips colors={deck.colors} size={11} />
            {deck.bracket && <span>· Bracket {deck.bracket} ({BRACKETS[deck.bracket]})</span>}
          </div>
        </div>
      </div>

      <div className="px-4">
        {deck.commanders.length > 0 && <p className="mt-2 text-sm text-faint">{deck.commanders.map((c) => c.name).join(' + ')}</p>}
        {t ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatTile label="Record" value={`${t.wins}–${t.games - t.wins}`} sub={pct(t.wins, t.games)} />
            <StatTile label="Avg place" value={(t.placeSum / t.games).toFixed(1)} />
            <StatTile label="Kills" value={t.kills} />
            <StatTile label="Dmg / game" value={Math.round(t.damage / t.games)} />
            <StatTile label="Cmdr dmg" value={t.commander} />
            <StatTile label="Combo wins" value={t.comboWins} />
          </div>
        ) : (
          <EmptyState icon={<Layers className="size-6" />} title="Not played yet" />
        )}

        {recent.length > 0 && (
          <>
            <SectionTitle>Recent games</SectionTitle>
            <div className="space-y-2">
              {recent.map((g) => (
                <GameCard key={g.id} game={g} lookups={lookups} onClick={() => navigate(`/games/${g.id}`)} />
              ))}
            </div>
          </>
        )}

        <div className="mt-10 flex gap-2">
          <Button className="flex-1" onClick={() => void updateDeck(deck.id, { retired: !deck.retired })}>
            {deck.retired ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            {deck.retired ? 'Bring back' : 'Retire deck'}
          </Button>
          {confirmDelete ? (
            <Button
              variant="danger"
              className="flex-1"
              onClick={async () => {
                await updateDeck(deck.id, { deleted: true })
                navigate(-1)
              }}
            >
              Really delete?
            </Button>
          ) : (
            <Button variant="ghost" className="flex-1 text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash className="size-4" /> Delete
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-faint">Retired decks keep their stats but don't show up when picking a deck for a new game.</p>
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit deck">
        {editing && <DeckEditor ownerId={deck.ownerId} deck={deck} onSaved={() => setEditing(false)} />}
      </Sheet>
    </div>
  )
}

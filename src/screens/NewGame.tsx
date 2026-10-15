import { ChevronDown, ChevronUp, Layers, Plus, Smartphone, UserPlus, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useDecks, useGames, usePlayers } from '../data/hooks'
import { createGame } from '../data/repo'
import type { Deck, Game, Player, Seat } from '../data/types'
import { playerHex } from '../lib/colors'
import { useSync } from '../sync/SyncProvider'
import { DeckEditor, PlayerForm } from '../ui/forms'
import { Button, Card, DeckArt, Header, ManaPips, PlayerDot, SectionTitle, Segmented, Sheet } from '../ui/kit'

const MAX_SEATS = 6

/** Most recently played deck for each player, from game history. */
function lastDecks(games: Game[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const g of games) for (const s of g.seats) if (s.deckId && !map.has(s.playerId)) map.set(s.playerId, s.deckId)
  return map
}

export function NewGame() {
  const navigate = useNavigate()
  const players = usePlayers()
  const decks = useDecks()
  const games = useGames()
  const [seats, setSeats] = useState<Seat[] | null>(null)
  const [startingLife, setStartingLife] = useState(40)
  const [pickPlayer, setPickPlayer] = useState<number | 'add' | null>(null)
  const [pickDeck, setPickDeck] = useState<number | null>(null)
  const [starting, setStarting] = useState(false)
  const sync = useSync()
  const canMulti = sync.phase === 'ready'
  const [mode, setMode] = useState<Game['mode']>('table')

  const ready = players && decks && games
  const playerById = useMemo(() => new Map((players ?? []).map((p) => [p.id, p])), [players])
  const deckById = useMemo(() => new Map((decks ?? []).map((d) => [d.id, d])), [decks])
  const recentDeck = useMemo(() => lastDecks(games ?? []), [games])

  // Start from the last game's lineup: most pods play with the same people.
  useEffect(() => {
    if (!ready || seats !== null) return
    const last = games.find((g) => g.status !== 'abandoned')
    setSeats(
      (last?.seats ?? [])
        .filter((s) => playerById.has(s.playerId))
        .map((s) => ({ playerId: s.playerId, deckId: s.deckId && deckById.get(s.deckId)?.retired !== true && deckById.has(s.deckId) ? s.deckId : null })),
    )
    setStartingLife(last?.startingLife ?? 40)
  }, [ready, seats, games, playerById, deckById])

  if (!ready || seats === null) return null

  const seatedIds = seats.map((s) => s.playerId)
  const defaultDeckFor = (playerId: string) => {
    const recent = recentDeck.get(playerId)
    if (recent && deckById.get(recent) && !deckById.get(recent)!.retired) return recent
    const own = decks.filter((d) => d.ownerId === playerId && !d.retired)
    return own.length === 1 ? own[0].id : null
  }

  const choosePlayer = (p: Player) => {
    const seat: Seat = { playerId: p.id, deckId: defaultDeckFor(p.id) }
    setSeats((cur) => {
      const list = [...(cur ?? [])]
      if (pickPlayer === 'add' || pickPlayer === null) list.push(seat)
      else list[pickPlayer] = seat
      return list
    })
    setPickPlayer(null)
  }

  const move = (i: number, dir: -1 | 1) =>
    setSeats((cur) => {
      const list = [...(cur ?? [])]
      const j = i + dir
      if (j < 0 || j >= list.length) return list
      ;[list[i], list[j]] = [list[j], list[i]]
      return list
    })

  const start = async () => {
    setStarting(true)
    const game = await createGame(seats, startingLife, canMulti ? mode : 'table')
    navigate(`/game/${game.id}`, { replace: true })
  }

  return (
    <div className="mx-auto min-h-full max-w-lg pb-32">
      <Header title="New game" back />
      <div className="px-4">
        <SectionTitle>Players · clockwise around the table</SectionTitle>
        <div className="space-y-2">
          {seats.map((seat, i) => {
            const player = playerById.get(seat.playerId)
            const deck = seat.deckId ? deckById.get(seat.deckId) : undefined
            return (
              <Card key={seat.playerId} className="flex items-stretch overflow-hidden">
                <div className="flex w-9 shrink-0 flex-col items-center justify-center border-r border-line text-faint">
                  <button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="flex h-6 w-full items-center justify-center disabled:opacity-20">
                    <ChevronUp className="size-4" />
                  </button>
                  <span className="tabular text-xs font-semibold">{i + 1}</span>
                  <button aria-label="Move down" disabled={i === seats.length - 1} onClick={() => move(i, 1)} className="flex h-6 w-full items-center justify-center disabled:opacity-20">
                    <ChevronDown className="size-4" />
                  </button>
                </div>
                <button onClick={() => setPickDeck(i)} className="flex min-w-0 flex-1 items-center gap-3 p-2.5 text-left active:bg-surface-2">
                  <DeckArt deck={deck} className="h-12 w-16 shrink-0" rounded="rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: playerHex(player?.color) }} />
                      <span className="truncate font-semibold">{player?.name}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                      {deck ? (
                        <>
                          <span className="truncate">{deck.name}</span>
                          <ManaPips colors={deck.colors} size={9} />
                        </>
                      ) : (
                        <span className="text-gold">Choose deck</span>
                      )}
                    </div>
                  </div>
                </button>
                <button aria-label={`Remove ${player?.name}`} onClick={() => setSeats(seats.filter((_, j) => j !== i))} className="flex w-11 shrink-0 items-center justify-center text-faint active:bg-surface-2">
                  <X className="size-4.5" />
                </button>
              </Card>
            )
          })}
          {seats.length < MAX_SEATS && (
            <button
              onClick={() => setPickPlayer('add')}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-muted active:bg-surface"
            >
              <Plus className="size-5" /> Add player
            </button>
          )}
        </div>

        <SectionTitle>Starting life</SectionTitle>
        <Segmented value={startingLife} onChange={setStartingLife} options={[20, 30, 40].map((v) => ({ value: v, label: String(v) }))} />

        <SectionTitle>How you'll play</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <ModeCard
            active={mode === 'table' || !canMulti}
            icon={<Smartphone className="size-5" />}
            title="One phone"
            detail="In the middle of the table"
            onClick={() => setMode('table')}
          />
          <ModeCard
            active={mode === 'multi' && canMulti}
            disabled={!canMulti}
            icon={<Users className="size-5" />}
            title="Everyone's phone"
            detail={canMulti ? 'Each player tracks their own seat' : 'Needs sync (see Settings)'}
            onClick={() => setMode('multi')}
          />
        </div>
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto max-w-lg p-4">
          <Button variant="primary" size="lg" className="w-full" disabled={seats.length < 2 || starting} onClick={() => void start()}>
            Start game{seats.length >= 2 ? ` · ${seats.length} players` : ''}
          </Button>
        </div>
      </div>

      <PlayerPickerSheet
        open={pickPlayer !== null}
        onClose={() => setPickPlayer(null)}
        players={players.filter((p) => !seatedIds.includes(p.id) || (typeof pickPlayer === 'number' && seats[pickPlayer]?.playerId === p.id))}
        takenColors={seats.map((s) => playerById.get(s.playerId)?.color ?? '')}
        onPick={choosePlayer}
      />
      {pickDeck !== null && (
        <DeckPickerSheet
          player={playerById.get(seats[pickDeck].playerId)!}
          decks={decks.filter((d) => d.ownerId === seats[pickDeck].playerId && !d.retired)}
          selected={seats[pickDeck].deckId}
          onClose={() => setPickDeck(null)}
          onChangePlayer={() => {
            const i = pickDeck
            setPickDeck(null)
            setPickPlayer(i)
          }}
          onPick={(deckId) => {
            setSeats(seats.map((s, j) => (j === pickDeck ? { ...s, deckId } : s)))
            setPickDeck(null)
          }}
        />
      )}
    </div>
  )
}

function ModeCard({
  active,
  disabled,
  icon,
  title,
  detail,
  onClick,
}: {
  active: boolean
  disabled?: boolean
  icon: React.ReactNode
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-2xl p-3 text-left transition disabled:opacity-50 ${active ? 'border-2 border-gold bg-gold-soft/40' : 'border-2 border-line'}`}
    >
      <span className={active ? 'text-gold' : 'text-muted'}>{icon}</span>
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted">{detail}</p>
    </button>
  )
}

function PlayerPickerSheet({
  open,
  onClose,
  players,
  takenColors,
  onPick,
}: {
  open: boolean
  onClose: () => void
  players: Player[]
  takenColors: string[]
  onPick: (p: Player) => void
}) {
  const [creating, setCreating] = useState(false)
  const close = () => {
    setCreating(false)
    onClose()
  }
  const showForm = creating || players.length === 0
  return (
    <Sheet open={open} onClose={close} title={showForm ? 'New player' : 'Add player'}>
      {showForm ? (
        <PlayerForm
          takenColors={takenColors}
          onDone={(p) => {
            setCreating(false)
            onPick(p)
          }}
        />
      ) : (
        <div className="space-y-2">
          {players.map((p) => (
            <button key={p.id} onClick={() => onPick(p)} className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 p-3 text-left active:bg-surface-3">
              <PlayerDot player={p} size={36} />
              <span className="font-medium">{p.name}</span>
            </button>
          ))}
          <Button variant="ghost" className="w-full text-gold" onClick={() => setCreating(true)}>
            <UserPlus className="size-5" /> New player
          </Button>
        </div>
      )}
    </Sheet>
  )
}

function DeckPickerSheet({
  player,
  decks,
  selected,
  onClose,
  onPick,
  onChangePlayer,
}: {
  player: Player
  decks: Deck[]
  selected: string | null
  onClose: () => void
  onPick: (deckId: string | null) => void
  onChangePlayer: () => void
}) {
  const [creating, setCreating] = useState(decks.length === 0)
  return (
    <Sheet open onClose={onClose} title={creating ? `New deck for ${player.name}` : `${player.name}'s deck`}>
      {creating ? (
        <DeckEditor ownerId={player.id} onSaved={(d) => onPick(d.id)} />
      ) : (
        <div className="space-y-2">
          {decks.map((d) => (
            <button
              key={d.id}
              onClick={() => onPick(d.id)}
              className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition active:brightness-110 ${d.id === selected ? 'bg-gold-soft ring-2 ring-gold' : 'bg-surface-2'}`}
            >
              <DeckArt deck={d} className="h-14 w-20 shrink-0" rounded="rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.name}</p>
                <div className="mt-1">
                  <ManaPips colors={d.colors} size={11} />
                </div>
              </div>
            </button>
          ))}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={() => setCreating(true)}>
              <Layers className="size-4" /> New deck
            </Button>
            <Button variant="ghost" className="flex-1 text-muted" onClick={() => onPick(null)}>
              No deck
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="w-full text-muted" onClick={onChangePlayer}>
            Swap player
          </Button>
        </div>
      )}
    </Sheet>
  )
}

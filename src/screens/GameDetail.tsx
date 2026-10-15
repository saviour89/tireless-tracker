import { Crown, RotateCcw, Skull, Trash } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useGame, useGameState, useLookups } from '../data/hooks'
import { appendEvent, deleteGame, refreshGameResult } from '../data/repo'
import { describeEvent } from '../game/describe'
import { CAUSE_LABEL, WIN_TYPE_LABEL } from '../game/events'
import { avgTurnMs } from '../stats/stats'
import { playerHex } from '../lib/colors'
import { clock, duration, ordinal, relativeDay, timeOfDay } from '../lib/format'
import { ColumnStrip } from '../ui/charts'
import { Button, Card, DeckArt, Header, SectionTitle } from '../ui/kit'
import { shortName } from './game/context'

export function GameDetail() {
  const { id } = useParams()
  const game = useGame(id)
  const { state } = useGameState(game)
  const lookups = useLookups()
  const navigate = useNavigate()
  const [showLog, setShowLog] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (game === null || game?.deleted) return <Navigate to="/games" replace />
  if (!game || !state || !lookups.ready) return null
  if (game.status === 'active') return <Navigate to={`/game/${game.id}`} replace />

  const s = game.summary
  const seat = (i: number) => {
    const player = lookups.player.get(game.seats[i].playerId)
    const deckId = game.seats[i].deckId
    return { player, deck: deckId ? lookups.deck.get(deckId) : undefined, name: player?.name ?? '?', hex: playerHex(player?.color) }
  }
  const order = game.seats.map((_, i) => i).sort((a, b) => (s?.seats[a].place ?? 9) - (s?.seats[b].place ?? 9))
  const winner = s?.winners.length === 1 ? seat(s.winners[0]) : null
  const endEvent = [...state.effective].reverse().find((e) => e.type === 'end')

  const reopen = async () => {
    if (!endEvent) return
    await appendEvent(game.id, { type: 'undo', eventId: endEvent.id })
    await refreshGameResult(game.id)
    navigate(`/game/${game.id}`, { replace: true })
  }

  return (
    <div className="mx-auto min-h-full max-w-lg pb-10">
      <Header title={`${relativeDay(game.createdAt)} · ${timeOfDay(game.createdAt)}`} back="/games" />

      <div className="px-4">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-line">
          <DeckArt deck={winner?.deck} rounded="rounded-none" className="absolute inset-0 opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          <div className="relative flex min-h-48 flex-col justify-end p-5">
            {game.status === 'abandoned' ? (
              <p className="text-2xl font-bold">Abandoned</p>
            ) : s?.winType === 'draw' ? (
              <p className="text-2xl font-bold">Draw</p>
            ) : (
              <>
                <Crown className="mb-1 size-7 text-gold" />
                <p className="text-2xl font-bold">{s?.winners.map((w) => seat(w).name).join(' & ')} won</p>
                {winner?.deck && <p className="text-white/70">{winner.deck.name}</p>}
              </>
            )}
            {s && (
              <p className="mt-2 text-sm text-white/70">
                {WIN_TYPE_LABEL[s.winType]}
                {s.card && ` · ${s.card}`} · {duration(s.durationMs)} · {s.rounds} {s.rounds === 1 ? 'round' : 'rounds'}
              </p>
            )}
            {s?.note && <p className="mt-2 text-sm text-white/90 italic">“{s.note}”</p>}
          </div>
        </div>

        {/* Standings */}
        {s && (
          <>
            <SectionTitle>Standings</SectionTitle>
            <Card className="divide-y divide-line">
              {order.map((i) => {
                const ss = s.seats[i]
                const info = seat(i)
                return (
                  <div key={i} className="flex items-center gap-3 px-3 py-3">
                    <span className={`tabular w-7 text-center text-sm font-bold ${ss.won ? 'text-gold' : 'text-faint'}`}>{ordinal(ss.place)}</span>
                    <DeckArt deck={info.deck} className="h-11 w-14 shrink-0" rounded="rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 font-medium">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: info.hex }} />
                        <span className="truncate">{info.name}</span>
                        {i === s.firstSeat && <span className="shrink-0 rounded bg-surface-3 px-1.5 text-[10px] text-muted">went first</span>}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {ss.won ? (
                          info.deck?.name ?? 'No deck'
                        ) : (
                          <>
                            <Skull className="mr-1 inline size-3 align-[-2px]" />
                            {ss.cause ? CAUSE_LABEL[ss.cause] : 'Out'}
                            {ss.killer !== undefined && ` by ${seat(ss.killer).name}`}
                            {ss.eliminatedRound ? `, round ${ss.eliminatedRound}` : ''}
                          </>
                        )}
                      </p>
                      <p className="tabular mt-0.5 text-xs text-faint">
                        {ss.dealt.damage} dmg{ss.dealt.commander > 0 && ` (${ss.dealt.commander} cmdr)`}
                        {ss.dealt.poison > 0 && ` · ${ss.dealt.poison} poison`}
                        {ss.turns > 0 && ` · ${duration(avgTurnMs(ss))}/turn`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </Card>
          </>
        )}

        {/* Turn timeline */}
        {state.turns.length > 0 && (
          <>
            <SectionTitle>Turn by turn</SectionTitle>
            <Card className="p-4">
              <ColumnStrip
                data={state.turns.map((t) => ({
                  key: String(t.turn),
                  label: `Turn ${t.turn}`,
                  value: t.ms,
                  color: seat(t.seat).hex,
                  tooltip: (
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: seat(t.seat).hex }} />
                      <span className="font-medium">{seat(t.seat).name}</span>
                      <span className="text-muted">
                        Round {t.round} · turn {t.turn}
                      </span>
                      <span className="tabular ml-auto font-semibold">{clock(t.ms)}</span>
                    </div>
                  ),
                }))}
              />
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                {game.seats.map((_, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs text-muted">
                    <span className="size-2 rounded-full" style={{ background: seat(i).hex }} />
                    {seat(i).name}
                  </span>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* Log */}
        <SectionTitle
          action={
            <button onClick={() => setShowLog(!showLog)} className="text-sm text-muted">
              {showLog ? 'Hide' : `Show ${state.effective.length}`}
            </button>
          }
        >
          Game log
        </SectionTitle>
        {showLog && (
          <Card className="divide-y divide-line px-4">
            {state.effective.map((e) => (
              <div key={e.id} className="flex items-baseline gap-3 py-2 text-sm">
                <span className="tabular w-16 shrink-0 text-xs text-faint">{timeOfDay(e.at)}</span>
                <span>
                  {describeEvent(
                    e,
                    (i) => seat(i).name,
                    (i, idx) => {
                      const c = seat(i).deck?.commanders[idx]
                      return c ? shortName(c.name) : `${seat(i).name}'s commander`
                    },
                  )}
                </span>
              </div>
            ))}
          </Card>
        )}

        <div className="mt-8 flex gap-2">
          {endEvent && (
            <Button className="flex-1" onClick={() => void reopen()}>
              <RotateCcw className="size-4" /> Reopen game
            </Button>
          )}
          {confirmDelete ? (
            <Button
              variant="danger"
              className="flex-1"
              onClick={async () => {
                await deleteGame(game.id)
                navigate('/games', { replace: true })
              }}
            >
              Really delete?
            </Button>
          ) : (
            <Button variant="ghost" className="flex-1 text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash className="size-4" /> Delete game
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

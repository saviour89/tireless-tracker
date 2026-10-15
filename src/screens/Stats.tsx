import { ChartColumn, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useGames, useLookups } from '../data/hooks'
import { CAUSE_LABEL, WIN_TYPE_LABEL, type EliminationCause, type WinType } from '../game/events'
import { playerHex } from '../lib/colors'
import { duration, ordinal, pct } from '../lib/format'
import { avgTurnMs, computeStats, finishedGames, winRate, type Stats as StatsData } from '../stats/stats'
import { BarRow, StatTile } from '../ui/charts'
import { Card, DeckArt, EmptyState, Header, PlayerDot, SectionTitle, Segmented } from '../ui/kit'

type Range = 'all' | '90' | '30'

export function Stats() {
  const games = useGames()
  const lookups = useLookups()
  const [range, setRange] = useState<Range>('all')
  const stats = useMemo(() => {
    if (!games) return null
    const since = range === 'all' ? undefined : Date.now() - Number(range) * 86_400_000
    return computeStats(finishedGames(games, since))
  }, [games, range])

  if (!stats || !lookups.ready) return null
  return (
    <div>
      <Header title="Stats" />
      <div className="px-4">
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: 'all', label: 'All time' },
            { value: '90', label: '90 days' },
            { value: '30', label: '30 days' },
          ]}
        />
        {stats.games === 0 ? (
          <EmptyState icon={<ChartColumn className="size-6" />} title="No finished games yet">
            Stats show up once you've finished a game.
          </EmptyState>
        ) : (
          <StatsBody stats={stats} lookups={lookups} />
        )}
      </div>
    </div>
  )
}

function StatsBody({ stats, lookups }: { stats: StatsData; lookups: ReturnType<typeof useLookups> }) {
  const navigate = useNavigate()
  const [allDecks, setAllDecks] = useState(false)
  const name = (id: string) => lookups.player.get(id)?.name ?? '?'
  const color = (id: string) => playerHex(lookups.player.get(id)?.color)
  const byTurnTime = [...stats.players].filter((p) => p.turns > 0).sort((a, b) => avgTurnMs(b) - avgTurnMs(a))
  const maxTurn = Math.max(1, ...byTurnTime.map(avgTurnMs))
  const decks = allDecks ? stats.decks : stats.decks.slice(0, 6)

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <StatTile label="Games" value={stats.games} sub={`${Math.round(stats.totalMs / 3_600_000)}h played`} />
        <StatTile label="Avg game" value={duration(stats.totalMs / stats.games)} sub={`${(stats.totalRounds / stats.games).toFixed(1)} rounds`} />
        <StatTile label="Avg turn" value={duration(stats.totalTurns ? stats.totalTurnMs / stats.totalTurns : 0)} />
        <StatTile label="Combo wins" value={pct(stats.winTypes.combo ?? 0, stats.games)} sub={`${stats.winTypes.combo ?? 0} of ${stats.games}`} />
      </div>

      <SectionTitle>Players</SectionTitle>
      <Card className="divide-y divide-line">
        {stats.players.map((p, i) => (
          <button key={p.id} onClick={() => navigate(`/pod/player/${p.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
            <span className="tabular w-4 text-sm text-faint">{i + 1}</span>
            <PlayerDot player={lookups.player.get(p.id)} size={30} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{name(p.id)}</p>
              <p className="text-xs text-muted">
                {p.wins}W · {p.games - p.wins}L · {p.kills} kills
              </p>
            </div>
            <div className="text-right">
              <p className="tabular font-semibold">{pct(p.wins, p.games)}</p>
              <p className="text-xs text-faint">avg place {(p.placeSum / p.games).toFixed(1)}</p>
            </div>
            <ChevronRight className="size-4 text-faint" />
          </button>
        ))}
      </Card>

      <SectionTitle>Decks</SectionTitle>
      <Card className="divide-y divide-line">
        {decks.map((d) => {
          const deck = lookups.deck.get(d.id)
          return (
            <button key={d.id} onClick={() => navigate(`/pod/deck/${d.id}`)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-surface-2">
              <DeckArt deck={deck} className="h-10 w-14 shrink-0" rounded="rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{deck?.name ?? 'Deleted deck'}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="size-2 rounded-full" style={{ background: color(d.ownerId) }} />
                  {name(d.ownerId)} · {d.games} {d.games === 1 ? 'game' : 'games'}
                </p>
              </div>
              <p className="tabular font-semibold">{pct(d.wins, d.games)}</p>
            </button>
          )
        })}
        {stats.decks.length > 6 && (
          <button onClick={() => setAllDecks(!allDecks)} className="w-full py-3 text-sm text-muted active:bg-surface-2">
            {allDecks ? 'Show fewer' : `Show all ${stats.decks.length} decks`}
          </button>
        )}
      </Card>

      {byTurnTime.length > 0 && (
        <>
          <SectionTitle>Average turn length</SectionTitle>
          <Card className="px-4 py-2">
            {byTurnTime.map((p) => (
              <BarRow
                key={p.id}
                label={
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: color(p.id) }} />
                    <span className="truncate">{name(p.id)}</span>
                  </span>
                }
                value={duration(avgTurnMs(p))}
                fraction={avgTurnMs(p) / maxTurn}
                color={color(p.id)}
                title={`Longest turn: ${duration(p.longestTurnMs)}`}
              />
            ))}
          </Card>
        </>
      )}

      <KillMatrix stats={stats} name={name} />

      <SectionTitle>How games end</SectionTitle>
      <Card className="px-4 py-2">
        {(Object.entries(stats.winTypes) as [WinType, number][])
          .sort((a, b) => b[1] - a[1])
          .map(([t, n]) => (
            <BarRow key={t} label={WIN_TYPE_LABEL[t]} value={`${n} · ${pct(n, stats.games)}`} fraction={n / stats.games} />
          ))}
      </Card>

      <SectionTitle>How players go out</SectionTitle>
      <Card className="px-4 py-2">
        {(() => {
          const entries = (Object.entries(stats.causes) as [EliminationCause, number][]).sort((a, b) => b[1] - a[1])
          const total = entries.reduce((s, [, n]) => s + n, 0)
          return entries.map(([c, n]) => <BarRow key={c} label={CAUSE_LABEL[c]} value={`${n} · ${pct(n, total)}`} fraction={n / total} />)
        })()}
      </Card>

      <SectionTitle>Win rate by turn order</SectionTitle>
      <Card className="px-4 py-2">
        {stats.positions.map((p, i) => (
          <BarRow key={i} label={`Going ${ordinal(i + 1)}`} value={pct(p.wins, p.games)} fraction={winRate(p)} title={`${p.wins} wins in ${p.games} games`} />
        ))}
        <p className="pt-1 pb-1 text-xs text-faint">Is going first an advantage in your pod?</p>
      </Card>

      <Records stats={stats} name={name} />
    </>
  )
}

/** Who eliminated whom: rows are killers, columns are victims. */
function KillMatrix({ stats, name }: { stats: StatsData; name: (id: string) => string }) {
  const ids = stats.players.map((p) => p.id)
  const max = Math.max(1, ...ids.flatMap((k) => ids.map((v) => stats.kills[k]?.[v] ?? 0)))
  if (!Object.keys(stats.kills).length) return null
  return (
    <>
      <SectionTitle>Who kills whom</SectionTitle>
      <Card className="overflow-x-auto p-3">
        <table className="w-full border-separate border-spacing-[3px] text-center text-sm">
          <thead>
            <tr>
              <th className="text-left text-[10px] font-normal text-faint">killer ↓ victim →</th>
              {ids.map((v) => (
                <th key={v} className="max-w-12 truncate px-1 text-xs font-medium text-muted">
                  {name(v).slice(0, 5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ids.map((k) => (
              <tr key={k}>
                <th className="max-w-20 truncate pr-2 text-left text-xs font-medium text-muted">{name(k)}</th>
                {ids.map((v) => {
                  const n = stats.kills[k]?.[v] ?? 0
                  return (
                    <td
                      key={v}
                      title={k === v ? undefined : `${name(k)} eliminated ${name(v)} ${n}×`}
                      className={`tabular h-9 min-w-9 rounded-md ${k === v ? 'bg-transparent' : ''} ${n ? 'font-semibold' : 'text-faint'}`}
                      style={k === v ? undefined : { background: `color-mix(in srgb, var(--color-danger) ${n ? 18 + (n / max) * 62 : 0}%, var(--color-surface-2))` }}
                    >
                      {k === v ? '' : n || '·'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

function Records({ stats, name }: { stats: StatsData; name: (id: string) => string }) {
  const navigate = useNavigate()
  const r = stats.records
  const items = [
    r.longestGame && { label: 'Longest game', value: duration(r.longestGame.value), who: r.longestGame.playerId && `won by ${name(r.longestGame.playerId)}`, ref: r.longestGame },
    r.shortestGame && { label: 'Shortest game', value: duration(r.shortestGame.value), who: r.shortestGame.playerId && `won by ${name(r.shortestGame.playerId)}`, ref: r.shortestGame },
    r.fastestWin && { label: 'Fastest win', value: `Round ${r.fastestWin.value}`, who: name(r.fastestWin.playerId), ref: r.fastestWin },
    r.longestTurn && r.longestTurn.value > 0 && { label: 'Longest turn', value: duration(r.longestTurn.value), who: name(r.longestTurn.playerId), ref: r.longestTurn },
    r.mostDamage && r.mostDamage.value > 0 && { label: 'Most damage in a game', value: r.mostDamage.value, who: name(r.mostDamage.playerId), ref: r.mostDamage },
  ].filter(Boolean) as { label: string; value: React.ReactNode; who: string; ref: { gameId: string } }[]
  return (
    <>
      <SectionTitle>Records</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <button key={it.label} onClick={() => navigate(`/games/${it.ref.gameId}`)} className="rounded-2xl border border-line bg-surface p-3.5 text-left active:bg-surface-2">
            <p className="text-xs text-muted">{it.label}</p>
            <p className="tabular mt-1 text-xl font-bold">{it.value}</p>
            <p className="mt-0.5 truncate text-xs text-faint">{it.who}</p>
          </button>
        ))}
      </div>
    </>
  )
}

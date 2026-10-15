import { Crown } from 'lucide-react'
import type { Lookups } from '../data/hooks'
import type { Game } from '../data/types'
import { WIN_TYPE_LABEL } from '../game/events'
import { playerHex } from '../lib/colors'
import { duration, relativeDay, timeOfDay } from '../lib/format'
import { Card, DeckArt } from './kit'

export function GameCard({ game, lookups, onClick }: { game: Game; lookups: Lookups; onClick: () => void }) {
  const s = game.summary
  const winners = s?.winners ?? []
  const name = (i: number) => lookups.player.get(game.seats[i]?.playerId)?.name ?? '?'
  return (
    <Card onClick={onClick} className="overflow-hidden">
      <div className="flex h-16">
        {game.seats.map((seat, i) => {
          const won = winners.includes(i)
          const player = lookups.player.get(seat.playerId)
          return (
            <div key={i} className="relative min-w-0 flex-1">
              <DeckArt deck={seat.deckId ? lookups.deck.get(seat.deckId) : null} rounded="rounded-none" className={`absolute inset-0 ${s && !won ? 'opacity-40 grayscale-[60%]' : ''}`} />
              <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: playerHex(player?.color) }} />
              {won && (
                <div className="absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-black/60">
                  <Crown className="size-3.5 text-gold" />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {game.status === 'active'
              ? 'In progress'
              : game.status === 'abandoned'
                ? 'Abandoned'
                : s?.winType === 'draw'
                  ? 'Draw'
                  : `${winners.map(name).join(' & ')} won`}
          </p>
          <p className="truncate text-sm text-muted">
            {s ? `${WIN_TYPE_LABEL[s.winType]} · ${duration(s.durationMs)} · ${s.rounds} ${s.rounds === 1 ? 'round' : 'rounds'}` : game.seats.map((_, i) => name(i)).join(', ')}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs text-faint">
          <p>{relativeDay(game.createdAt)}</p>
          <p>{timeOfDay(game.createdAt)}</p>
        </div>
      </div>
    </Card>
  )
}

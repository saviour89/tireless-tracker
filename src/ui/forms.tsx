import { Check, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { createPlayer, saveDeck, updatePlayer } from '../data/repo'
import type { Bracket, Commander, Deck, ManaColor, Player } from '../data/types'
import { PLAYER_COLORS, sortColors } from '../lib/colors'
import { CommanderSearch } from './CardSearch'
import { Button, DeckArt, ManaPips, Segmented, TextField } from './kit'

export const BRACKETS: Record<Bracket, string> = {
  1: 'Exhibition',
  2: 'Core',
  3: 'Upgraded',
  4: 'Optimized',
  5: 'cEDH',
}

export function PlayerForm({
  player,
  takenColors = [],
  onDone,
}: {
  player?: Player
  takenColors?: string[]
  onDone: (p: Player) => void
}) {
  const [name, setName] = useState(player?.name ?? '')
  const [color, setColor] = useState(player?.color ?? PLAYER_COLORS.find((c) => !takenColors.includes(c.key))?.key ?? 'silver')
  const valid = name.trim().length > 0
  const submit = async () => {
    if (!valid) return
    if (player) {
      await updatePlayer(player.id, { name: name.trim(), color })
      onDone({ ...player, name: name.trim(), color })
    } else {
      onDone(await createPlayer(name, color))
    }
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Who's playing?" autoFocus maxLength={24} />
      <div>
        <span className="mb-2 block text-sm text-muted">Color</span>
        <div className="flex flex-wrap gap-2.5">
          {PLAYER_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-label={c.name}
              onClick={() => setColor(c.key)}
              className={`relative flex size-10 items-center justify-center rounded-full transition ${color === c.key ? 'ring-2 ring-white ring-offset-2 ring-offset-surface' : ''}`}
              style={{ background: c.hex }}
            >
              {color === c.key && <Check className="size-5 text-black/70" />}
              {color !== c.key && takenColors.includes(c.key) && <span className="absolute inset-0 rounded-full bg-black/45" />}
            </button>
          ))}
        </div>
      </div>
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!valid}>
        {player ? 'Save' : 'Add player'}
      </Button>
    </form>
  )
}

export function DeckEditor({ ownerId, deck, onSaved }: { ownerId: string; deck?: Deck; onSaved: (d: Deck) => void }) {
  const [commanders, setCommanders] = useState<Commander[]>(deck?.commanders ?? [])
  const [name, setName] = useState(deck?.name ?? '')
  const [bracket, setBracket] = useState<Bracket | 0>(deck?.bracket ?? 0)
  const [searching, setSearching] = useState(commanders.length === 0)

  const colors = sortColors([...new Set(commanders.flatMap((c) => c.colors))] as ManaColor[])
  const defaultName = commanders.map((c) => c.name.split(',')[0]).join(' & ')
  const valid = commanders.length > 0 || name.trim().length > 0

  const save = async () => {
    const saved = await saveDeck({
      id: deck?.id,
      ownerId,
      name: name.trim() || defaultName,
      commanders,
      colors,
      bracket: bracket || undefined,
      retired: deck?.retired,
    })
    onSaved(saved)
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="mb-2 block text-sm text-muted">Commander{commanders.length > 1 ? 's' : ''}</span>
        {commanders.length > 0 && (
          <div className="mb-3 space-y-2">
            {commanders.map((c, i) => (
              <div key={c.scryfallId ?? c.name} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-2">
                <DeckArt deck={{ commanders: [c], colors: c.colors }} className="h-12 w-16 shrink-0" rounded="rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <ManaPips colors={c.colors} size={10} />
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${c.name}`}
                  onClick={() => {
                    const next = commanders.filter((_, j) => j !== i)
                    setCommanders(next)
                    if (next.length === 0) setSearching(true)
                  }}
                  className="flex size-9 items-center justify-center rounded-full text-muted active:bg-surface-3"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        {searching ? (
          <CommanderSearch
            autoFocus={commanders.length === 0}
            onPick={(c) => {
              setCommanders((cur) => [...cur, c].slice(0, 2))
              setSearching(false)
            }}
          />
        ) : (
          commanders.length < 2 && (
            <Button size="sm" variant="ghost" className="text-muted" onClick={() => setSearching(true)}>
              <Plus className="size-4" /> Partner or background
            </Button>
          )
        )}
      </div>

      <TextField label="Deck name" value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultName || 'e.g. Superfriends'} maxLength={40} />

      <div>
        <span className="mb-2 block text-sm text-muted">Bracket {bracket ? <span className="text-fg">· {BRACKETS[bracket]}</span> : '(optional)'}</span>
        <Segmented
          value={bracket}
          onChange={setBracket}
          options={[{ value: 0 as const, label: '–' }, ...([1, 2, 3, 4, 5] as const).map((b) => ({ value: b, label: String(b) }))]}
        />
      </div>

      <Button variant="primary" size="lg" className="w-full" disabled={!valid} onClick={() => void save()}>
        {deck ? 'Save deck' : 'Add deck'}
      </Button>
    </div>
  )
}

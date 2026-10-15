import { Check, CloudOff, RefreshCw, Smartphone, Wifi } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../data/db'
import { usePlayers } from '../data/hooks'
import { timeOfDay } from '../lib/format'
import { setMe, useMe } from '../lib/me'
import { useSync } from '../sync/SyncProvider'
import { Button, Card, Header, PlayerDot, SectionTitle, Sheet } from '../ui/kit'

export function Settings() {
  const sync = useSync()
  const me = useMe()
  const players = usePlayers()
  const pending = useLiveQuery(() => db.outbox.count())
  const [picking, setPicking] = useState(false)
  const mePlayer = players?.find((p) => p.id === me)

  return (
    <div className="mx-auto min-h-full max-w-lg pb-10">
      <Header title="Settings" back />
      <div className="px-4">
        <SectionTitle>This phone</SectionTitle>
        <Card onClick={() => setPicking(true)} className="flex items-center gap-3 p-4">
          {mePlayer ? <PlayerDot player={mePlayer} size={40} /> : <Smartphone className="size-10 p-2 text-muted" />}
          <div className="min-w-0 flex-1">
            <p className="font-medium">{mePlayer ? mePlayer.name : 'Not set'}</p>
            <p className="text-sm text-muted">In multi-phone games, this phone shows your seat.</p>
          </div>
          <span className="text-sm text-gold">Change</span>
        </Card>

        <SectionTitle>Sync</SectionTitle>
        <Card className="p-4">
          {sync.phase === 'local' ? (
            <div className="flex gap-3">
              <CloudOff className="size-5 shrink-0 text-muted" />
              <div>
                <p className="font-medium">This phone only</p>
                <p className="mt-1 text-sm text-muted">
                  Games are saved on this device. Connect a Supabase project (see the README) to share games across everyone's phones. Existing games will be uploaded.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                {sync.live ? <Wifi className="size-5 text-good" /> : <CloudOff className="size-5 text-muted" />}
                <div className="flex-1">
                  <p className="font-medium">{sync.live ? 'Live' : navigator.onLine ? 'Connecting…' : 'Offline'}</p>
                  <p className="text-sm text-muted">
                    {pending ? `${pending} changes waiting to upload` : (
                      <span className="inline-flex items-center gap-1">
                        <Check className="size-3.5" /> Everything uploaded
                      </span>
                    )}
                    {sync.lastSyncedAt && ` · synced ${timeOfDay(sync.lastSyncedAt)}`}
                  </p>
                </div>
                <Button size="sm" onClick={sync.syncNow} disabled={sync.syncing}>
                  <RefreshCw className={`size-4 ${sync.syncing ? 'animate-spin' : ''}`} /> Sync
                </Button>
              </div>
              {sync.error && <p className="mt-3 text-sm text-danger">{sync.error}</p>}
            </>
          )}
        </Card>

        <p className="mt-10 text-center text-xs text-faint">
          Tireless Tracker · card data and art from Scryfall
          <br />
          Magic: The Gathering is © Wizards of the Coast
        </p>
      </div>

      <Sheet open={picking} onClose={() => setPicking(false)} title="Who uses this phone?">
        <div className="space-y-2">
          {players?.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setMe(p.id)
                setPicking(false)
              }}
              className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${p.id === me ? 'bg-gold-soft ring-2 ring-gold' : 'bg-surface-2 active:bg-surface-3'}`}
            >
              <PlayerDot player={p} size={36} />
              <span className="font-medium">{p.name}</span>
            </button>
          ))}
          {me && (
            <Button
              variant="ghost"
              className="w-full text-muted"
              onClick={() => {
                setMe(null)
                setPicking(false)
              }}
            >
              Nobody in particular
            </Button>
          )}
        </div>
      </Sheet>
    </div>
  )
}

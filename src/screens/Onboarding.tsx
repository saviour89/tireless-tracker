import { LoaderCircle, LockKeyhole } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { usePlayers } from '../data/hooks'
import { setMe, useMe } from '../lib/me'
import { useSync } from '../sync/SyncProvider'
import { PlayerForm } from '../ui/forms'
import { Button, PlayerDot } from '../ui/kit'
import { Logo } from '../ui/Logo'

const SKIP_KEY = 'tt.meSkipped'

/** Everything a device sees before the app itself: the group password, then "who are you?". */
export function Onboarding({ children }: { children: ReactNode }) {
  const sync = useSync()
  const me = useMe()
  const [skipped, setSkipped] = useState(() => {
    try {
      return localStorage.getItem(SKIP_KEY) === '1'
    } catch {
      return false
    }
  })

  if (sync.phase === 'starting') return <Splash />
  if (sync.phase === 'gate') return <PasswordGate />
  if (sync.phase === 'ready' && !me && !skipped)
    return (
      <WhoAreYou
        onSkip={() => {
          try {
            localStorage.setItem(SKIP_KEY, '1')
          } catch {
            // ignore
          }
          setSkipped(true)
        }}
      />
    )
  return <>{children}</>
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo className="size-16" />
        <h1 className="mt-4 text-2xl font-bold">Tireless Tracker</h1>
      </div>
      {children}
    </div>
  )
}

function Splash() {
  return (
    <Shell>
      <LoaderCircle className="mx-auto size-6 animate-spin text-faint" />
    </Shell>
  )
}

function PasswordGate() {
  const sync = useSync()
  const [password, setPassword] = useState('')
  const [state, setState] = useState<'idle' | 'checking' | 'wrong' | 'offline'>('idle')
  const submit = async () => {
    if (!password) return
    setState('checking')
    const res = await sync.joinGroup(password)
    setState(res === 'ok' ? 'idle' : res)
  }
  return (
    <Shell>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="space-y-3"
      >
        <p className="text-center text-muted">Enter your pod's password to join.</p>
        <div className={`relative ${state === 'wrong' ? 'animate-[shake_300ms]' : ''}`} key={state === 'wrong' ? password : undefined}>
          <LockKeyhole className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-faint" />
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (state !== 'checking') setState('idle')
            }}
            placeholder="Group password"
            className="h-14 w-full rounded-2xl border border-line bg-surface-2 pr-4 pl-12 text-lg text-fg placeholder:text-faint focus:border-gold/60 focus:outline-none"
          />
        </div>
        <p className="h-5 text-center text-sm text-danger">
          {state === 'wrong' && "That's not it."}
          {state === 'offline' && "Can't reach the server. Check your connection."}
        </p>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!password || state === 'checking'}>
          {state === 'checking' ? <LoaderCircle className="size-5 animate-spin" /> : 'Join'}
        </Button>
      </form>
    </Shell>
  )
}

function WhoAreYou({ onSkip }: { onSkip: () => void }) {
  const players = usePlayers()
  const sync = useSync()
  const [creating, setCreating] = useState(false)
  // Wait for the first sync before offering to create a profile, or everyone would make duplicates.
  const loading = !players || (players.length === 0 && sync.lastSyncedAt === null && !sync.error)

  return (
    <Shell>
      <p className="mb-4 text-center text-lg font-semibold">Who are you?</p>
      {loading ? (
        <LoaderCircle className="mx-auto size-6 animate-spin text-faint" />
      ) : creating || players.length === 0 ? (
        <div className="rounded-3xl border border-line bg-surface p-5">
          <PlayerForm takenColors={players.map((p) => p.color)} onDone={(p) => setMe(p.id)} />
        </div>
      ) : (
        <div className="space-y-2">
          {players.map((p) => (
            <button key={p.id} onClick={() => setMe(p.id)} className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 p-3 text-left active:bg-surface-3">
              <PlayerDot player={p} size={40} />
              <span className="text-lg font-medium">{p.name}</span>
            </button>
          ))}
          <Button variant="ghost" className="w-full text-gold" onClick={() => setCreating(true)}>
            I'm new here
          </Button>
        </div>
      )}
      <button onClick={onSkip} className="mt-6 text-sm text-faint">
        Skip for now
      </button>
    </Shell>
  )
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { onLocalWrite } from '../data/repo'
import { calibrate } from '../lib/clock'
import { syncConfigured } from './config'
import { SyncEngine } from './engine'

/** The Supabase client is big; only load it on devices that actually sync. */
const loadSupabase = () => import('./supabase')

/**
 * - local:    no server configured; everything stays on this device.
 * - starting: signing in / checking membership.
 * - gate:     this device hasn't entered the group password yet.
 * - ready:    syncing.
 */
export type SyncPhase = 'local' | 'starting' | 'gate' | 'ready'

export interface SyncStatus {
  phase: SyncPhase
  /** Realtime connection is up. */
  live: boolean
  syncing: boolean
  lastSyncedAt: number | null
  error: string | null
  syncNow: () => void
  joinGroup: (password: string) => Promise<'ok' | 'wrong' | 'offline'>
}

const SyncCtx = createContext<SyncStatus | null>(null)

export function useSync(): SyncStatus {
  const ctx = useContext(SyncCtx)
  if (!ctx) throw new Error('useSync outside SyncProvider')
  return ctx
}

const MEMBER_KEY = 'tt.member'

function cachedMember(userId: string): boolean {
  try {
    return localStorage.getItem(MEMBER_KEY) === userId
  } catch {
    return false
  }
}

function cacheMember(userId: string | null) {
  try {
    if (userId) localStorage.setItem(MEMBER_KEY, userId)
    else localStorage.removeItem(MEMBER_KEY)
  } catch {
    // Fine: we'll just check with the server next launch.
  }
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<SyncPhase>(syncConfigured ? 'starting' : 'local')
  const [live, setLive] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const engine = useRef<SyncEngine | null>(null)

  const syncNow = useCallback(() => {
    const e = engine.current
    if (!e || !navigator.onLine) return
    setSyncing(true)
    e.sync()
      .then(() => {
        setLastSyncedAt(Date.now())
        setError(null)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setSyncing(false))
  }, [])

  // Sign in (anonymously) and find out whether this device is already in the group.
  useEffect(() => {
    if (!syncConfigured) return
    let cancelled = false
    void (async () => {
      const sb = (await loadSupabase()).supabase()
      let { data } = await sb.auth.getSession()
      if (!data.session) {
        if (!navigator.onLine) return !cancelled && setPhase('gate')
        const res = await sb.auth.signInAnonymously()
        if (res.error) {
          if (!cancelled) {
            setError(res.error.message)
            setPhase('gate')
          }
          return
        }
        data = { session: res.data.session }
      }
      const userId = data.session!.user.id
      if (cachedMember(userId)) {
        if (!cancelled) setPhase('ready')
        return
      }
      const { data: member, error: err } = await sb.rpc('is_member')
      if (cancelled) return
      if (err) setError(err.message)
      if (member === true) {
        cacheMember(userId)
        setPhase('ready')
      } else {
        setPhase('gate')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Once in: sync now, on every local write, when coming back online or to the foreground, and on a timer.
  useEffect(() => {
    if (phase !== 'ready') return
    let disposed = false
    let cleanup = () => {}
    void loadSupabase().then(({ SupabaseBackend }) => {
      if (disposed) return
      const backend = new SupabaseBackend()
      const e = new SyncEngine(backend)
      engine.current = e
      void calibrate(() => backend.serverNow()).catch(() => {})
      syncNow()

      let debounce: ReturnType<typeof setTimeout> | undefined
      const soon = () => {
        clearTimeout(debounce)
        debounce = setTimeout(syncNow, 300)
      }
      let wasLive = false
      const unsubscribe = e.subscribe((isLive) => {
        setLive(isLive)
        // Reconnected after a drop: catch up on anything missed.
        if (isLive && !wasLive) soon()
        wasLive = isLive
      })
      const offWrite = onLocalWrite(soon)
      const onVisible = () => document.visibilityState === 'visible' && soon()
      window.addEventListener('online', soon)
      document.addEventListener('visibilitychange', onVisible)
      const timer = setInterval(syncNow, 60_000)
      cleanup = () => {
        engine.current = null
        clearTimeout(debounce)
        clearInterval(timer)
        unsubscribe()
        offWrite()
        window.removeEventListener('online', soon)
        document.removeEventListener('visibilitychange', onVisible)
      }
    })
    return () => {
      disposed = true
      cleanup()
    }
  }, [phase, syncNow])

  const joinGroup = useCallback(async (password: string): Promise<'ok' | 'wrong' | 'offline'> => {
    if (!navigator.onLine) return 'offline'
    const sb = (await loadSupabase()).supabase()
    let { data } = await sb.auth.getSession()
    if (!data.session) {
      const res = await sb.auth.signInAnonymously()
      if (res.error) return 'offline'
      data = { session: res.data.session }
    }
    const { data: ok, error: err } = await sb.rpc('join_group', { password })
    if (err) {
      setError(err.message)
      return 'offline'
    }
    if (!ok) return 'wrong'
    cacheMember(data.session!.user.id)
    setPhase('ready')
    return 'ok'
  }, [])

  const value = useMemo<SyncStatus>(
    () => ({ phase, live, syncing, lastSyncedAt, error, syncNow, joinGroup }),
    [phase, live, syncing, lastSyncedAt, error, syncNow, joinGroup],
  )
  return <SyncCtx.Provider value={value}>{children}</SyncCtx.Provider>
}

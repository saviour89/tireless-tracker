import { useSyncExternalStore } from 'react'

const KEY = 'tt.me'
const listeners = new Set<() => void>()

function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** Which player this device belongs to. Used to show "your seat" in multi-phone games. */
export function setMe(playerId: string | null) {
  try {
    if (playerId) localStorage.setItem(KEY, playerId)
    else localStorage.removeItem(KEY)
  } catch {
    // Private mode: identity just won't persist.
  }
  listeners.forEach((l) => l())
}

export function useMe(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      window.addEventListener('storage', cb)
      return () => {
        listeners.delete(cb)
        window.removeEventListener('storage', cb)
      }
    },
    read,
    () => null,
  )
}

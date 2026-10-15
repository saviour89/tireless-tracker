import { useEffect } from 'react'

/** Keeps the screen on while `active`. Re-acquires the lock after the app comes back to the foreground. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        if (document.visibilityState === 'visible' && !cancelled) lock = await navigator.wakeLock.request('screen')
      } catch {
        // Denied (e.g. low battery mode). Nothing useful to do.
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => {})
    }
  }, [active])
}

let iosSwitch: HTMLLabelElement | null = null

/**
 * A short tap of haptic feedback. Android supports the Vibration API; iOS Safari (18+) doesn't,
 * but toggling a native switch control produces a system haptic, so we click a hidden one.
 */
export function haptic(pattern: number | number[] = 8) {
  try {
    if ('vibrate' in navigator && navigator.vibrate(pattern)) return
    if (!/iPhone|iPad/.test(navigator.userAgent)) return
    if (!iosSwitch) {
      iosSwitch = document.createElement('label')
      iosSwitch.ariaHidden = 'true'
      iosSwitch.style.display = 'none'
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.setAttribute('switch', '')
      iosSwitch.appendChild(input)
      document.body.appendChild(iosSwitch)
    }
    iosSwitch.click()
  } catch {
    // Haptics are a nicety.
  }
}

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'

/** Re-renders every `ms` while `active`; returns the current time. */
export function useNow(ms = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms, active])
  return now
}

/** Fires once on press, then repeats (accelerating) while held. */
export function usePressRepeat(onStep: () => void) {
  const step = useRef(onStep)
  step.current = onStep
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const stop = useCallback(() => clearTimeout(timer.current), [])
  useEffect(() => stop, [stop])

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      step.current()
      stop()
      let delay = 120
      const tick = () => {
        step.current()
        delay = Math.max(45, delay * 0.9)
        timer.current = setTimeout(tick, delay)
      }
      timer.current = setTimeout(tick, 450)
    },
    [stop],
  )

  return {
    onPointerDown,
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  }
}

/**
 * Accumulates quick taps into one change, committing after `delay` ms without taps (or when
 * `flush` is called, or on unmount). Keeps the event log to one entry per real-world change.
 */
export function useBufferedDelta(commit: (amount: number) => void, delay: number) {
  const [pending, setPending] = useState(0)
  const ref = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const commitRef = useRef(commit)
  commitRef.current = commit

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    const amount = ref.current
    ref.current = 0
    setPending(0)
    if (amount !== 0) commitRef.current(amount)
  }, [])

  const bump = useCallback(
    (delta: number) => {
      ref.current += delta
      setPending(ref.current)
      clearTimeout(timer.current)
      if (ref.current !== 0) timer.current = setTimeout(flush, delay)
    },
    [delay, flush],
  )

  useEffect(() => flush, [flush])
  return { pending, bump, flush }
}

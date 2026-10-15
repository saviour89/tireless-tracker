const KEY = 'tt.clockOffset'

function load(): number {
  try {
    return Number(localStorage.getItem(KEY)) || 0
  } catch {
    return 0
  }
}

let offset = load()

/**
 * The current time, corrected toward the server's clock. Turn timers compare timestamps from
 * different phones, so a phone whose clock is a minute off would otherwise skew everyone's turns.
 */
export function now(): number {
  return Date.now() + offset
}

/** Measures the offset from a server-time call: `fetchServerMs` should return the server's epoch ms. */
export async function calibrate(fetchServerMs: () => Promise<number>) {
  const t0 = Date.now()
  const server = await fetchServerMs()
  const t1 = Date.now()
  // Assume the server read its clock halfway through the round trip.
  offset = Math.round(server - (t0 + t1) / 2)
  try {
    localStorage.setItem(KEY, String(offset))
  } catch {
    // Not fatal; we'll recalibrate next launch.
  }
}

export function newId(): string {
  return crypto.randomUUID()
}

const DEVICE_KEY = 'tt.deviceId'

/** A stable id for this browser, stamped on every event it records. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = newId()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return 'unknown-device'
  }
}

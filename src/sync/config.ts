export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Sync is optional: without these env vars the app runs fully local on one device. */
export const syncConfigured = !!SUPABASE_URL && !!SUPABASE_KEY

import type { Commander, ManaColor } from '../data/types'

const API = 'https://api.scryfall.com'

interface ScryfallImageUris {
  art_crop?: string
  normal?: string
}

interface ScryfallCard {
  id: string
  name: string
  color_identity: ManaColor[]
  type_line?: string
  image_uris?: ScryfallImageUris
  card_faces?: { image_uris?: ScryfallImageUris }[]
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  const res = await fetch(`${API}${path}`, { signal, headers: { Accept: 'application/json' } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Scryfall ${res.status}`)
  return (await res.json()) as T
}

function toCommander(card: ScryfallCard): Commander {
  const images = card.image_uris ?? card.card_faces?.[0]?.image_uris
  return {
    name: card.name,
    scryfallId: card.id,
    artUrl: images?.art_crop,
    imageUrl: images?.normal,
    colors: card.color_identity,
  }
}

const commanderCache = new Map<string, Commander[]>()

/** Cards that can lead a deck (plus Backgrounds), most popular first. */
export async function searchCommanders(term: string, signal?: AbortSignal): Promise<Commander[]> {
  const q = term.trim()
  if (q.length < 2) return []
  const key = q.toLowerCase()
  const cached = commanderCache.get(key)
  if (cached) return cached
  const query = encodeURIComponent(`${q} (is:commander or t:background) game:paper`)
  const res = await get<{ data: ScryfallCard[] }>(`/cards/search?q=${query}&order=edhrec&unique=cards`, signal)
  const results = (res?.data ?? []).slice(0, 12).map(toCommander)
  commanderCache.set(key, results)
  return results
}

/** Card name suggestions for any card. */
export async function autocompleteCards(term: string, signal?: AbortSignal): Promise<string[]> {
  const q = term.trim()
  if (q.length < 2) return []
  const res = await get<{ data: string[] }>(`/cards/autocomplete?q=${encodeURIComponent(q)}`, signal)
  return (res?.data ?? []).slice(0, 8)
}

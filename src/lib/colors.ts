import type { ManaColor } from '../data/types'

export interface PlayerColor {
  key: string
  name: string
  hex: string
}

/**
 * Player identity colors. Any two can share a table, so the set is checked all-pairs (dataviz
 * validator, dark surface): every pair clears the normal-vision floor, and the worst
 * colorblind pair is in the 6–8 band, which is OK because a color is never shown without the
 * player's name or initial next to it.
 */
export const PLAYER_COLORS: PlayerColor[] = [
  { key: 'crimson', name: 'Red', hex: '#e5482c' },
  { key: 'amber', name: 'Amber', hex: '#f5a00b' },
  { key: 'green', name: 'Green', hex: '#30a46c' },
  { key: 'sky', name: 'Sky', hex: '#38bdf8' },
  { key: 'violet', name: 'Violet', hex: '#5b5bd6' },
  { key: 'pink', name: 'Pink', hex: '#ea5fb0' },
  { key: 'silver', name: 'Silver', hex: '#d4d4d8' },
]

export function playerHex(key: string | undefined): string {
  return PLAYER_COLORS.find((c) => c.key === key)?.hex ?? '#d4d4d8'
}

export const MANA: Record<ManaColor, { name: string; hex: string; fg: string }> = {
  W: { name: 'White', hex: '#f4efd2', fg: '#3a3524' },
  U: { name: 'Blue', hex: '#3d8fd6', fg: '#fff' },
  B: { name: 'Black', hex: '#3b3540', fg: '#e8e3ee' },
  R: { name: 'Red', hex: '#e2493b', fg: '#fff' },
  G: { name: 'Green', hex: '#2e9d5b', fg: '#fff' },
}

export const WUBRG: ManaColor[] = ['W', 'U', 'B', 'R', 'G']

export function sortColors(colors: ManaColor[]): ManaColor[] {
  return WUBRG.filter((c) => colors.includes(c))
}

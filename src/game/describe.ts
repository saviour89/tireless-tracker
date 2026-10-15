import { CAUSE_LABEL, WIN_TYPE_LABEL, type GameEvent } from './events'

/** One-line human description of an event, for the in-game log and history timeline. */
export function describeEvent(e: GameEvent, name: (seat: number) => string, commanderName?: (seat: number, idx: number) => string): string {
  switch (e.type) {
    case 'start':
      return `${name(e.firstSeat)} goes first`
    case 'life': {
      const who = name(e.target)
      if (e.source === undefined) return e.amount < 0 ? `${who} lost ${-e.amount}` : `${who} gained ${e.amount}`
      const src = e.commander !== undefined ? (commanderName?.(e.source, e.commander) ?? `${name(e.source)}'s commander`) : name(e.source)
      if (e.amount < 0) return `${src} dealt ${-e.amount} to ${who}${e.commander !== undefined && commanderName ? ' (commander)' : ''}`
      return `Corrected: ${who} +${e.amount} from ${src}`
    }
    case 'poison': {
      const who = name(e.target)
      const src = e.source !== undefined ? ` from ${name(e.source)}` : ''
      return e.amount > 0 ? `${who} got ${e.amount} poison${src}` : `${who} removed ${-e.amount} poison${src}`
    }
    case 'pass':
      return `Turn ${e.turn} ended`
    case 'pause':
      return 'Game paused'
    case 'resume':
      return 'Game resumed'
    case 'eliminate':
      return `${name(e.target)} is out (${CAUSE_LABEL[e.cause].toLowerCase()}${e.by !== undefined ? ` by ${name(e.by)}` : ''})`
    case 'end':
      if (e.winType === 'draw') return 'Game ended in a draw'
      return `${e.winners.map(name).join(' & ')} won (${WIN_TYPE_LABEL[e.winType].toLowerCase()}${e.card ? `: ${e.card}` : ''})`
    case 'undo':
      return 'Undo'
  }
}

# Tireless Tracker — spec

A life counter for our Commander pod that records everything that happens in a game, so we get
real stats per player and per deck afterwards.

## Principles

- **It is the life counter.** Logging happens as a side effect of tracking life, never as extra work.
- **Attribution costs at most one tap.** After a life change, opponents' chips appear for ~3 seconds;
  tap one to say who did it (or their commander icon for commander damage). Ignore it and the change
  is saved unattributed.
- **Everything is an event.** A game is an append-only list of events. Life totals, turn timers and
  every stat are computed from that list. That gives us undo, easy syncing and stats we can add later
  that still work on old games.
- **Works offline.** Everything is stored on the device first and synced when there is a connection.

## Access (no accounts)

- One shared **group password** gets a device into the app. It's checked on the server, so it's real
  protection, not just a screen to click past.
- After that you pick your profile from the list, or create one. The device remembers who you are.
- Under the hood each device gets an anonymous Supabase session. Only sessions that entered the
  password can read or write data (enforced by database row-level security).

## Screens

| Screen | What it does |
| --- | --- |
| **Play** (home) | Start a new game, resume the current one, recent games |
| **New game** | Pick 3–6 players and their decks in seat (turn) order, starting life (40), one phone vs. every phone |
| **Table view** | Classic life-counter layout for one phone in the middle of the table. Each panel faces its player |
| **My seat view** | Multi-phone mode. Your panel is large, opponents are small along the top |
| **Game over** | Winner, how they won, length, turn times, damage dealt, who killed whom |
| **Stats** | Leaderboards for players and decks, turn-time leaderboard, nemesis matrix, how games end, seat-position win rates |
| **Decks** | Per player: name, commander(s) via Scryfall search (partners/backgrounds supported), bracket 1–5, colors |
| **Players** | Profiles: name and color |
| **History** | Past games with a full event timeline |

## In-game features

- Tap the left/right halves of a panel to change life by 1; hold to repeat. Keypad for big numbers.
- Commander damage tracked per opponent commander (two tracks for partners); reaching 21 suggests elimination.
- Poison counters (10 suggests elimination).
- Turn tracking: "End turn" on the active panel, live turn timer, pause for breaks (paused time isn't counted).
- Random first-player roll.
- When someone hits 0 life, 21 commander damage or 10 poison, the app asks "Out?" and suggests the cause and killer.
- Declare a win at any time for combo/alt-win cons, with an optional key card.
- Undo, plus an event log where any single event can be undone.
- Screen stays awake during a game.

## Data

```
Player   id, name, color
Deck     id, ownerId, name, commanders[{name, scryfallId, artUrl, colors}], bracket, colors
Game     id, status, startingLife, seats[{playerId, deckId}], mode, startedAt, endedAt, summary
Event    id, gameId, at, deviceId, type + payload
```

Event types: `start`, `life` (target, amount, source?, commander?), `poison`, `pass`, `pause`,
`resume`, `eliminate` (target, cause, by?), `end` (winners, winType, note?), `undo` (eventId).

## Tech

- Installable web app: Vite + React + TypeScript + Tailwind.
- Local store: IndexedDB (Dexie). The UI only reads from the local store.
- Backend: Supabase (Postgres + realtime). A sync engine pushes local changes and pulls remote ones.
  During a multi-phone game, events stream between phones in real time.
- Hosting: Vercel (free).

## Phases

1. Full game on one phone (table view, event log, undo, turns, eliminations, game over)
2. Players, decks (Scryfall), history, stats
3. Supabase sync, group password, multi-phone rooms (QR code join), my seat view
4. Polish

# Tireless Tracker

A life counter for our Commander pod that records everything that happens in a game (damage,
commander damage, poison, turn times, who knocked out whom, combo wins), then turns it into
stats per player and per deck.

- **One phone** in the middle of the table, with each panel facing its player, or **everyone's
  phone**, where each player gets their own seat view and everything syncs live.
- Installable web app: open it in Safari/Chrome and "Add to Home Screen". Works offline.
- No accounts. One shared group password gets a phone in, then you pick who you are.

See [docs/SPEC.md](docs/SPEC.md) for the design.

## Running it

```bash
npm ci
npm run dev
```

Open the printed URL. To try it on your phone, use the "Network" URL while both are on the same wifi.

Without any configuration the app runs in **one-phone mode**: everything is saved on that device.
Turning on sync later uploads what's already there.

```bash
npm test        # game logic, stats, sync engine, and the database schema (against an in-process Postgres)
npm run build   # production build in dist/
```

## Turning on sync (everyone's phone)

1. Create a free project at [supabase.com](https://supabase.com).
2. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins**.
3. **SQL Editor**: paste and run [supabase/migrations/20261015000000_init.sql](supabase/migrations/20261015000000_init.sql).
4. Still in the SQL editor, set your group password:
   ```sql
   select public.set_group_password('pick something');
   ```
   Run it again any time to change the password. Phones already in stay in.
5. **Project Settings → API**: copy the project URL and the anon (or publishable) key into
   `.env.local` (see [.env.example](.env.example)).
6. Restart `npm run dev`. The app now asks for the group password.

### Hosting

Deploy to [Vercel](https://vercel.com): import the GitHub repo, add the two `VITE_SUPABASE_*`
environment variables, deploy. `vercel.json` already handles routing. Share the URL with the pod
and have everyone add it to their home screen.

## How it works

- **A game is a list of events** (`src/game/events.ts`): life changes with an optional source and
  commander, poison, turn passes, pauses, eliminations, the end. Everything you see, from life
  totals to turn timers to the stats page, is computed from that list (`src/game/project.ts`).
  Undo is just another event.
- **Offline first.** The UI only reads the local IndexedDB (`src/data`). Every write also goes into
  an outbox; the sync engine (`src/sync/engine.ts`) pushes it to Supabase and pulls everyone
  else's changes, plus a realtime subscription for live games. Players, decks and games are
  last-write-wins; events are append-only and the server gives them one shared order.
- **Security.** Every phone signs in anonymously, but row-level security only lets in sessions
  that called `join_group()` with the right password. The password is stored as a bcrypt hash and
  wrong guesses are slowed down.

```
src/
  game/      event types, projection (events → state), summaries
  stats/     aggregation for the stats pages
  data/      IndexedDB schema, writes (repo.ts), React hooks
  sync/      sync engine, Supabase backend, password gate
  screens/   pages; screens/game/ is the in-game table and seat views
  ui/        shared components
supabase/    database schema
scripts/     icon generator
```

Card data and art come from [Scryfall](https://scryfall.com). Magic: The Gathering is © Wizards
of the Coast; this is an unofficial fan project.

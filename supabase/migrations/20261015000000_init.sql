-- Tireless Tracker schema. Safe to run more than once.
--
-- Access model: there are no accounts. Every device signs in anonymously, then proves it knows
-- the group password by calling join_group(). Only members can read or write anything.
--
-- Data model: players, decks and games are stored as JSON documents with last-write-wins on
-- `updated_at` (the client's clock). Game events are append-only rows; `seq` gives every device
-- the same order.

-- Membership ---------------------------------------------------------------------------------

create table if not exists public.members (
  user_id uuid primary key references auth.users on delete cascade,
  joined_at timestamptz not null default now()
);

create table if not exists public.group_secret (
  id int primary key default 1 check (id = 1),
  password_hash text not null
);

alter table public.members enable row level security;
alter table public.group_secret enable row level security;
-- No policies: neither table is readable or writable directly by clients.

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from members where user_id = auth.uid()) $$;

create or replace function public.join_group(password text) returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
declare
  ok boolean;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select password_hash = crypt(password, password_hash) into ok from group_secret where id = 1;
  if not coalesce(ok, false) then
    perform pg_sleep(1); -- slows down guessing
    return false;
  end if;
  insert into members (user_id) values (auth.uid()) on conflict do nothing;
  return true;
end $$;

-- Run from the SQL editor to set or change the password:
--   select public.set_group_password('your password');
create or replace function public.set_group_password(password text) returns void
language sql security definer set search_path = public, extensions
as $$
  insert into group_secret (id, password_hash) values (1, crypt(password, gen_salt('bf')))
  on conflict (id) do update set password_hash = excluded.password_hash
$$;

create or replace function public.server_now() returns bigint
language sql stable
as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

-- Documents ----------------------------------------------------------------------------------

create table if not exists public.docs (
  kind text not null check (kind in ('player', 'deck', 'game')),
  id uuid not null,
  data jsonb not null,
  updated_at bigint not null,
  -- Server clock; devices pull everything synced since their last pull.
  synced_at timestamptz not null default clock_timestamp(),
  primary key (kind, id)
);
create index if not exists docs_synced_at on public.docs (synced_at);

alter table public.docs enable row level security;
drop policy if exists "members read docs" on public.docs;
drop policy if exists "members insert docs" on public.docs;
drop policy if exists "members update docs" on public.docs;
create policy "members read docs" on public.docs for select to authenticated using (public.is_member());
create policy "members insert docs" on public.docs for insert to authenticated with check (public.is_member());
create policy "members update docs" on public.docs for update to authenticated using (public.is_member()) with check (public.is_member());

create or replace function public.touch_synced_at() returns trigger
language plpgsql
as $$ begin new.synced_at := clock_timestamp(); return new; end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before update on public.docs for each row execute function public.touch_synced_at();

-- Upserts a batch, keeping whichever version of each document was edited last.
create or replace function public.push_docs(rows jsonb) returns void
language sql security invoker set search_path = public
as $$
  insert into docs (kind, id, data, updated_at)
  select r->>'kind', (r->>'id')::uuid, r->'data', (r->>'updated_at')::bigint
  from jsonb_array_elements(rows) r
  on conflict (kind, id) do update
    set data = excluded.data, updated_at = excluded.updated_at
    where docs.updated_at < excluded.updated_at
$$;

-- Events -------------------------------------------------------------------------------------

create table if not exists public.events (
  seq bigint generated always as identity primary key,
  id uuid not null unique,
  game_id uuid not null,
  data jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists events_game on public.events (game_id, seq);
create index if not exists events_created_at on public.events (created_at);

alter table public.events enable row level security;
drop policy if exists "members read events" on public.events;
drop policy if exists "members insert events" on public.events;
create policy "members read events" on public.events for select to authenticated using (public.is_member());
create policy "members insert events" on public.events for insert to authenticated with check (public.is_member());

-- Inserts a batch (ignoring ones already there) and returns the server order of each.
create or replace function public.push_events(rows jsonb) returns table (id uuid, seq bigint)
language sql security invoker set search_path = public
as $$
  with ins as (
    insert into events (id, game_id, data)
    select (r->>'id')::uuid, (r->>'game_id')::uuid, r->'data'
    from jsonb_array_elements(rows) r
    on conflict (id) do nothing
    returning events.id, events.seq
  )
  select ins.id, ins.seq from ins
  union all
  select e.id, e.seq from events e
  where e.id in (select (r->>'id')::uuid from jsonb_array_elements(rows) r)
    and e.id not in (select ins.id from ins)
$$;

-- Permissions --------------------------------------------------------------------------------
-- Explicit, so this works whether or not the project exposes new tables automatically.

revoke all on public.members, public.group_secret, public.docs, public.events from anon, authenticated;
grant select, insert, update on public.docs to authenticated;
grant select, insert on public.events to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_member(), public.join_group(text), public.server_now(), public.push_docs(jsonb), public.push_events(jsonb) to authenticated;

-- Live updates for every device.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'docs') then
    alter publication supabase_realtime add table public.docs;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'events') then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;

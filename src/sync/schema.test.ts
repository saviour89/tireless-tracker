import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * Runs the real Supabase migrations against an in-process Postgres, with the bits of Supabase
 * they rely on (auth.uid(), the anon/authenticated roles, the realtime publication) stubbed.
 */
const SUPABASE_STUBS = `
  create schema extensions;
  create extension pgcrypto with schema extensions;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  create publication supabase_realtime;
`

const U1 = '11111111-1111-1111-1111-111111111111'
const U2 = '22222222-2222-2222-2222-222222222222'
const P1 = 'aaaaaaaa-0000-0000-0000-000000000001'
const G1 = 'bbbbbbbb-0000-0000-0000-000000000001'
const E1 = 'cccccccc-0000-0000-0000-000000000001'
const E2 = 'cccccccc-0000-0000-0000-000000000002'

let pg: PGlite

/** Runs `sql` as a signed-in client (role authenticated), like a PostgREST request would. */
async function as<T>(user: string, sql: string, params: unknown[] = []) {
  await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`)
  try {
    return await pg.query<T>(sql, params)
  } finally {
    await pg.exec('reset role;')
  }
}

beforeAll(async () => {
  pg = await PGlite.create({ extensions: { pgcrypto } })
  await pg.exec(SUPABASE_STUBS)
  const dir = join(__dirname, '../../supabase/migrations')
  // Twice: the script has to be safe to re-run after a partial or repeated paste.
  for (let pass = 0; pass < 2; pass++) {
    for (const file of readdirSync(dir).sort()) await pg.exec(readFileSync(join(dir, file), 'utf8'))
  }
  await pg.exec(`insert into auth.users (id) values ('${U1}'), ('${U2}'); select public.set_group_password('tireless');`)
}, 30_000)

describe('supabase schema', () => {
  it('keeps everything private until the group password is entered', async () => {
    expect((await as<{ is_member: boolean }>(U1, 'select public.is_member()')).rows[0].is_member).toBe(false)
    await expect(as(U1, `select public.push_docs($1)`, [JSON.stringify([{ kind: 'player', id: P1, data: {}, updated_at: 1 }])])).rejects.toThrow(/row-level security/)
    expect((await as<{ ok: boolean }>(U1, `select public.join_group('nope') as ok`)).rows[0].ok).toBe(false)
    expect((await as<{ ok: boolean }>(U1, `select public.join_group('tireless') as ok`)).rows[0].ok).toBe(true)
    expect((await as<{ is_member: boolean }>(U1, 'select public.is_member()')).rows[0].is_member).toBe(true)
  })

  it('upserts docs with last-write-wins', async () => {
    const push = (name: string, updatedAt: number) =>
      as(U1, `select public.push_docs($1)`, [JSON.stringify([{ kind: 'player', id: P1, data: { id: P1, name, updatedAt }, updated_at: updatedAt }])])
    await push('Ben', 100)
    await push('Older', 50)
    let row = (await as<{ data: { name: string } }>(U1, `select data from docs where id = $1`, [P1])).rows[0]
    expect(row.data.name).toBe('Ben')
    await push('Newer', 200)
    row = (await as<{ data: { name: string } }>(U1, `select data from docs where id = $1`, [P1])).rows[0]
    expect(row.data.name).toBe('Newer')
  })

  it('assigns event order and is idempotent', async () => {
    const rows = (ids: string[]) => JSON.stringify(ids.map((id) => ({ id, game_id: G1, data: { id, type: 'pass' } })))
    const first = (await as<{ id: string; seq: number }>(U1, `select * from public.push_events($1)`, [rows([E1])])).rows
    expect(first).toHaveLength(1)
    const again = (await as<{ id: string; seq: number }>(U1, `select * from public.push_events($1)`, [rows([E1, E2])])).rows
    const seqOf = (id: string) => Number(again.find((r) => r.id === id)?.seq)
    expect(again).toHaveLength(2)
    expect(seqOf(E1)).toBe(Number(first[0].seq))
    expect(seqOf(E2)).toBeGreaterThan(seqOf(E1))
  })

  it('hides data from devices that are not members', async () => {
    expect((await as(U2, `select * from docs`)).rows).toHaveLength(0)
    expect((await as(U2, `select * from events`)).rows).toHaveLength(0)
    await expect(as(U2, `select * from public.push_events($1)`, [JSON.stringify([{ id: E2, game_id: G1, data: {} }])])).rejects.toThrow()
  })

  it('does not let clients change the password or read the members list', async () => {
    await expect(as(U1, `select public.set_group_password('mine now')`)).rejects.toThrow(/permission denied/)
    await expect(as(U1, `select * from members`)).rejects.toThrow(/permission denied/)
    await expect(as(U1, `select * from group_secret`)).rejects.toThrow(/permission denied/)
  })

  it('reports server time in epoch ms', async () => {
    const t = Number((await as<{ server_now: number }>(U1, 'select public.server_now()')).rows[0].server_now)
    expect(Math.abs(t - Date.now())).toBeLessThan(5_000)
  })
})

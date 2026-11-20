import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stg-sb-'));
process.env.CLUB_DATA_FILE = path.join(dir, 'club-data.json');
process.env.SUPABASE_URL = 'https://zloluzqzswdwaimlqlqx.supabase.co';
process.env.SUPABASE_ANON_KEY = '';
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { writeClub, readClub } = await import('../lib/clubData.mjs');
const {
  saveCloudConfig,
  syncOnce,
  stopCloudSync,
  cloudStatus,
  conflictRecord,
  DEFAULT_SUPABASE_URL
} = await import('../lib/supabaseSync.mjs');

const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key-value';
const CLUB = 'coach-write-secret-16';

after(() => {
  stopCloudSync();
});

describe('supabase club sync', () => {
  it('uses the given project URL by default', () => {
    const s = cloudStatus();
    assert.equal(s.url, DEFAULT_SUPABASE_URL);
    assert.equal(s.configured, false);
  });

  it('pulls a newer remote snapshot into the local club file', async () => {
    saveCloudConfig({ url: DEFAULT_SUPABASE_URL, anonKey: KEY, clubKey: CLUB });
    writeClub({
      updatedAt: '2020-01-01T00:00:00.000Z',
      updatedBy: 'local',
      payload: { players: [{ id: 'old' }], schemaVersion: 2, updatedAt: '2020-01-01T00:00:00.000Z' }
    });
    const remotePayload = { players: [{ id: 'new' }], schemaVersion: 2, type: 'metalist_full_migration' };
    global.fetch = async (url, opts) => {
      assert.match(String(url), /\/rest\/v1\/rpc\/club_pull$/);
      assert.equal(opts.headers.apikey, KEY);
      const body = JSON.parse(opts.body);
      assert.equal(body.club_key, CLUB);
      assert.equal(body.init_data, null);
      return {
        status: 200,
        async text() {
          return JSON.stringify({
            updated_at: '2024-06-01T12:00:00.000Z',
            updated_by: 'other-pc',
            payload: remotePayload
          });
        }
      };
    };
    const res = await syncOnce();
    assert.equal(res.ok, true);
    assert.equal(res.direction, 'pull');
    const local = readClub();
    assert.equal(local.payload.players[0].id, 'new');
    assert.equal(local.updatedBy, 'other-pc');
  });

  it('pushes a newer local snapshot', async () => {
    writeClub({
      updatedAt: '2026-01-02T00:00:00.000Z',
      updatedBy: 'windows-app',
      payload: { players: [{ id: 'local' }], schemaVersion: 2 }
    });
    let posted = null;
    global.fetch = async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (String(url).endsWith('/rpc/club_pull')) {
        return {
          status: 200,
          async text() {
            return JSON.stringify({
              updated_at: '2024-06-01T12:00:00.000Z',
              updated_by: 'other-pc',
              payload: { players: [{ id: 'new' }] }
            });
          }
        };
      }
      assert.match(String(url), /\/rpc\/club_push$/);
      posted = body;
      return { status: 200, async text() { return JSON.stringify({ ok: true, updated_at: body.updated_at }); } };
    };
    const res = await syncOnce();
    assert.equal(res.direction, 'push');
    assert.equal(posted.club_key, CLUB);
    assert.equal(posted.payload.players[0].id, 'local');
  });

  it('reports a missing table instead of crashing', async () => {
    global.fetch = async () => ({
      status: 404,
      async text() {
        return JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.club_pull in the schema cache' });
      }
    });
    const res = await syncOnce();
    assert.equal(res.ok, false);
    assert.match(res.error, /club_state\.sql/);
    assert.equal(cloudStatus().tableMissing, true);
  });

  it('applies a 409 snapshot instead of retrying a stale push', async () => {
    writeClub({
      updatedAt: '2026-01-02T00:00:00.000Z',
      updatedBy: 'windows-app',
      payload: { players: [{ id: 'local' }], chat: [{ id: 'old' }] }
    });
    const remotePayload = { players: [{ id: 'remote' }], chat: [{ id: 'kept' }] };
    global.fetch = async (url) => {
      if (String(url).endsWith('/rpc/club_pull')) {
        return {
          status: 200,
          async text() {
            return JSON.stringify({
              updated_at: '2024-06-01T12:00:00.000Z',
              payload: { players: [{ id: 'older' }] }
            });
          }
        };
      }
      return {
        status: 409,
        async text() {
          return JSON.stringify({
            code: 'PT409',
            message: 'stale',
            details: JSON.stringify({
              error: 'stale',
              updatedAt: '2026-02-01T00:00:00.000Z',
              updatedBy: 'other',
              payload: remotePayload
            })
          });
        }
      };
    };
    const res = await syncOnce();
    assert.equal(res.ok, true);
    assert.equal(res.direction, 'pull');
    assert.equal(readClub().payload.players[0].id, 'remote');
    assert.equal(conflictRecord({ details: JSON.stringify({ payload: { ok: 1 } }) }).payload.ok, 1);
  });

  it('does not grant anon direct access to club_state', () => {
    const sql = fs.readFileSync(new URL('../supabase/club_state.sql', import.meta.url), 'utf8');
    assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(sql, /with check\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(sql, /errcode\s*=\s*'40001'/);
    assert.match(sql, /revoke all on table public\.club_state from public, anon, authenticated/i);
    assert.match(sql, /private\.tg_user/);
    assert.match(sql, /grant execute on function public\.club_pull/);
    assert.match(sql, /errcode = 'PT409'/);
    assert.match(sql, /private\.norm_nick\(player->>'telegramUsername'\)/);
    assert.match(sql, /nick = 'serdiuk_artem'/);
    assert.match(sql, /private\.merge_chat\(row\.payload->'chat', payload->'chat', null\)/);
    assert.match(sql, /private\.merge_self_profile\(next_payload, payload, actor\)/);
    assert.match(sql, /player->>'linkedTelegramId'/);
  });
});

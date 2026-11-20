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
  DEFAULT_SUPABASE_URL
} = await import('../lib/supabaseSync.mjs');

const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key-value';

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
    saveCloudConfig({ url: DEFAULT_SUPABASE_URL, anonKey: KEY });
    writeClub({
      updatedAt: '2020-01-01T00:00:00.000Z',
      updatedBy: 'local',
      payload: { players: [{ id: 'old' }], schemaVersion: 2, updatedAt: '2020-01-01T00:00:00.000Z' }
    });
    const remotePayload = { players: [{ id: 'new' }], schemaVersion: 2, type: 'metalist_full_migration' };
    global.fetch = async (url, opts) => {
      assert.match(String(url), /zloluzqzswdwaimlqlqx\.supabase\.co\/rest\/v1\/club_state/);
      assert.equal(opts.headers.apikey, KEY);
      return {
        status: 200,
        async text() {
          return JSON.stringify([{
            id: 'metalist',
            updated_at: '2024-06-01T12:00:00.000Z',
            updated_by: 'other-pc',
            payload: remotePayload
          }]);
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
      if (!opts || opts.method === 'GET' || !opts.method) {
        return {
          status: 200,
          async text() {
            return JSON.stringify([{
              id: 'metalist',
              updated_at: '2024-06-01T12:00:00.000Z',
              updated_by: 'other-pc',
              payload: { players: [{ id: 'new' }] }
            }]);
          }
        };
      }
      posted = JSON.parse(opts.body);
      return { status: 201, async text() { return JSON.stringify([posted]); } };
    };
    const res = await syncOnce();
    assert.equal(res.direction, 'push');
    assert.equal(posted.id, 'metalist');
    assert.equal(posted.payload.players[0].id, 'local');
  });

  it('reports a missing table instead of crashing', async () => {
    global.fetch = async () => ({
      status: 404,
      async text() {
        return JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.club_state' in the schema cache" });
      }
    });
    const res = await syncOnce();
    assert.equal(res.ok, false);
    assert.match(res.error, /club_state\.sql/);
    assert.equal(cloudStatus().tableMissing, true);
  });
});

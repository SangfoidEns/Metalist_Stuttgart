import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as ClubStore from '../server/clubStore.mjs';

describe('clubStore', () => {
  let dir;

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-club-'));
  });

  after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects invalid role', () => {
    assert.equal(ClubStore.normalizeRole('admin'), null);
    assert.equal(ClubStore.normalizeRole('coach'), 'coach');
    assert.equal(ClubStore.normalizeRole('PLAYER'), 'player');
  });

  it('saves and loads coach club JSON', () => {
    const meta = ClubStore.saveClub(
      'coach',
      {
        type: 'metalist_full_migration',
        schemaVersion: 2,
        club: 'МЕТАЛІСТ ШТУТГАРТ',
        players: [{ id: 'p1', lastName: 'Test' }],
        trainings: []
      },
      dir
    );
    assert.equal(meta.role, 'coach');
    assert.ok(meta.size > 0);
    assert.equal(meta.club, 'МЕТАЛІСТ ШТУТГАРТ');

    const loaded = ClubStore.loadClub('coach', dir);
    assert.ok(loaded);
    assert.equal(loaded.data.players[0].lastName, 'Test');
    assert.equal(loaded.data._metalistRole, 'coach');
  });

  it('status reports both roles', () => {
    ClubStore.saveClub(
      'player',
      { type: 'metalist_roster_migration', players: [{ id: 'p2' }] },
      dir
    );
    const st = ClubStore.status(dir);
    assert.equal(st.roles.coach.present, true);
    assert.equal(st.roles.player.present, true);
  });

  it('normalizes bare export payload', () => {
    const meta = ClubStore.saveClub(
      'coach',
      { schemaVersion: 2, settings: { clubName: 'X' }, players: [] },
      dir
    );
    assert.equal(meta.type, 'metalist_full_migration');
  });
});

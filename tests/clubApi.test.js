import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const PORT = 18787;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-club-api-'));

process.env.PORT = String(PORT);
process.env.HOST = '127.0.0.1';
process.env.CLUB_DATA_DIR = DIR;
process.env.SERVE_UI = '0';
process.env.OPEN_UI = '0';
process.env.TELEGRAM_BOT_TOKEN = '';

function req(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body != null ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: urlPath,
        method,
        headers: data
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
          : {}
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch (_) {}
          resolve({ status: res.statusCode, json, text, headers: res.headers });
        });
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

describe('club HTTP API', () => {
  let server;

  before(async () => {
    const mod = await import('../server/index.mjs');
    server = await mod.startServer(PORT, '127.0.0.1');
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(DIR, { recursive: true, force: true });
  });

  it('GET /health', async () => {
    const r = await req('GET', '/health');
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
  });

  it('upload and download coach club JSON', async () => {
    const club = {
      type: 'metalist_full_migration',
      schemaVersion: 2,
      club: 'МЕТАЛІСТ ШТУТГАРТ',
      players: [{ id: 'a1', lastName: 'Serdiuk' }],
      trainings: [{ id: 't1', date: '2026-11-20', status: 'planned' }]
    };
    const up = await req('POST', '/api/club/upload?role=coach', club);
    assert.equal(up.status, 200);
    assert.equal(up.json.ok, true);
    assert.equal(up.json.role, 'coach');

    const st = await req('GET', '/api/club/status');
    assert.equal(st.json.roles.coach.present, true);

    const down = await req('GET', '/api/club/download?role=coach');
    assert.equal(down.status, 200);
    assert.equal(down.json.club.players[0].lastName, 'Serdiuk');
  });

  it('player role file is separate', async () => {
    const up = await req('POST', '/api/club/upload?role=player', {
      type: 'metalist_roster_migration',
      players: [{ id: 'p9', lastName: 'Player' }]
    });
    assert.equal(up.status, 200);
    const down = await req('GET', '/api/club/download?role=player');
    assert.equal(down.json.club.players[0].id, 'p9');
  });

  it('rejects bad role', async () => {
    const r = await req('GET', '/api/club/download?role=admin');
    assert.equal(r.status, 400);
  });
});

import { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stg-win-'));
process.env.CLUB_DATA_FILE = path.join(dir, 'club-data.json');
process.env.TELEGRAM_BOT_TOKEN = '';
process.env.CLUB_WRITE_SECRET = '';
process.env.BOT_API_SECRET = '';
process.env.CORS_ORIGIN = '';
process.env.HOST = '127.0.0.1';

const { startServer, stopServer, assertSafeListen, importClubFile } = await import('../server.mjs');
const { classifyClubWrite, clubReadAllowed, mergeChat } = await import('../lib/clubData.mjs');
const { buildTestInitData } = await import('../lib/validateInitData.mjs');

function req(port, method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body != null ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: Object.assign(
          data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
          headers
        )
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch (_) {}
          resolve({ status: res.statusCode, json, headers: res.headers, text });
        });
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

describe('windows-server security', () => {
  afterEach(async () => {
    await stopServer();
    process.env.CLUB_WRITE_SECRET = '';
    process.env.TELEGRAM_BOT_TOKEN = '';
    process.env.COACH_TELEGRAM_ID = '';
    process.env.BOT_API_SECRET = '';
    process.env.CORS_ORIGIN = '';
  });

  it('blocks open LAN bind without secret', () => {
    assert.throws(() => assertSafeListen('0.0.0.0'), /LAN bind/);
  });

  it('allows LAN bind when CLUB_WRITE_SECRET is set', () => {
    process.env.CLUB_WRITE_SECRET = 'test-secret';
    assert.equal(assertSafeListen('0.0.0.0'), true);
  });

  it('loopback club write works without secrets', async () => {
    const status = await startServer({ port: 18788, host: '127.0.0.1' });
    assert.equal(status.running, true);
    assert.equal(status.lanMode, false);

    const up = await req(18788, 'POST', '/api/club-data', {
      updatedAt: '2026-11-18T12:00:00.000Z',
      updatedBy: 'coach',
      payload: { players: [{ id: 'p1', firstName: 'Test' }], trainings: [] }
    });
    assert.equal(up.status, 200);
    assert.equal(up.json.ok, true);

    const down = await req(18788, 'GET', '/api/club-data');
    assert.equal(down.status, 200);
    assert.equal(down.json.payload.players[0].firstName, 'Test');
  });

  it('does not reflect arbitrary CORS origins', async () => {
    await startServer({ port: 18789, host: '127.0.0.1' });
    const r = await req(18789, 'GET', '/health', null, { Origin: 'https://evil.example' });
    assert.equal(r.status, 200);
    assert.notEqual(r.headers['access-control-allow-origin'], 'https://evil.example');
    assert.notEqual(r.headers['access-control-allow-origin'], '*');
    const club = await req(18789, 'GET', '/api/club-data', null, { Origin: 'https://evil.example' });
    assert.equal(club.status, 200);
    assert.notEqual(club.headers['access-control-allow-origin'], '*');
    assert.notEqual(club.headers['access-control-allow-origin'], 'https://evil.example');
  });

  it('forged coach username does not grant a full write', () => {
    process.env.TELEGRAM_BOT_TOKEN = '123456:telegram-bot-token';
    process.env.CLUB_WRITE_SECRET = 'club-write-secret-16';
    process.env.COACH_TELEGRAM_ID = '9001';
    const forged = 'user=' + encodeURIComponent(JSON.stringify({ id: 1, username: 'serdiuk_artem' })) + '&auth_date=1&hash=' + 'ab'.repeat(32);
    const req = {
      headers: { host: '192.168.1.20', 'x-club-key': 'wrong' },
      socket: { remoteAddress: '192.168.1.20' }
    };
    assert.equal(classifyClubWrite(req, { initData: forged }, { players: [] }), 'deny');
    const signed = buildTestInitData('123456:telegram-bot-token', { id: 9001, username: 'someone_else' });
    assert.equal(classifyClubWrite(req, { initData: signed }, { players: [] }), 'full');
    const keyReq = {
      headers: { host: '192.168.1.20', 'x-club-key': 'club-write-secret-16' },
      socket: { remoteAddress: '192.168.1.20' }
    };
    assert.equal(classifyClubWrite(keyReq, { initData: forged }, { players: [] }), 'full');
  });

  it('LAN club read requires a key or validated initData', () => {
    process.env.TELEGRAM_BOT_TOKEN = '123456:telegram-bot-token';
    process.env.CLUB_WRITE_SECRET = 'club-write-secret-16';
    process.env.COACH_TELEGRAM_ID = '9001';
    const remote = { headers: { host: '10.0.0.5' }, socket: { remoteAddress: '10.0.0.8' } };
    assert.equal(clubReadAllowed(remote), false);
    assert.equal(clubReadAllowed({
      headers: { host: '10.0.0.5', 'x-club-key': 'club-write-secret-16' },
      socket: { remoteAddress: '10.0.0.8' }
    }), true);
    assert.equal(clubReadAllowed({
      headers: { host: '127.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' }
    }), true);
  });

  it('player chat cannot impersonate the coach', () => {
    const actor = { id: 42, first_name: 'Гравець' };
    const merged = mergeChat(
      [{ id: 'c1', text: 'план', authorRole: 'coach', authorName: 'Тренер', telegramId: '9001', createdAt: '1' }],
      [{ id: 'c1', text: 'підміна', authorRole: 'coach', authorName: 'Тренер', createdAt: '2' },
        { id: 'p1', text: 'я тут', authorRole: 'coach', authorName: 'Тренер', createdAt: '3' }],
      actor
    );
    const coach = merged.find((m) => m.id === 'c1');
    const own = merged.find((m) => m.id === 'p1');
    assert.equal(coach.text, 'план');
    assert.equal(coach.authorRole, 'coach');
    assert.equal(own.authorRole, 'player');
    assert.equal(own.authorName, 'Гравець');
    assert.equal(own.telegramId, '42');
  });

  it('desktop importClubFile stores payload', () => {
    const saved = importClubFile({
      updatedAt: '2026-11-18T13:00:00.000Z',
      payload: { players: [{ id: 'x' }], schemaVersion: 2 }
    });
    assert.equal(saved.updatedBy, 'windows-app');
    assert.ok(saved.payload.players.length === 1);
  });
});

after(async () => {
  await stopServer();
  fs.rmSync(dir, { recursive: true, force: true });
});

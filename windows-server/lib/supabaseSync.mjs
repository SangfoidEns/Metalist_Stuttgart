/**
 * Club JSON sync with the coach Supabase project.
 * One row public.club_state id='metalist' replaces handing a JSON file around.
 * The anon key stays in data/supabase.json (gitignored) or SUPABASE_ANON_KEY.
 */
import fs from 'node:fs';
import path from 'node:path';
import { clubDataFile, readClub, writeClub } from './clubData.mjs';

export const DEFAULT_SUPABASE_URL = 'https://zloluzqzswdwaimlqlqx.supabase.co';
export const CLUB_ROW_ID = 'metalist';

const cloud = {
  url: DEFAULT_SUPABASE_URL,
  configured: false,
  lastSyncAt: null,
  lastError: null,
  direction: 'idle',
  remoteUpdatedAt: null,
  tableMissing: false
};

let timer = null;
let running = null;
let pushTimer = null;

function configPath() {
  return path.join(path.dirname(clubDataFile()), 'supabase.json');
}

export function loadCloudConfig() {
  const fromEnvUrl = String(process.env.SUPABASE_URL || '').trim();
  const fromEnvKey = String(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  let file = {};
  try {
    file = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch (_) {}
  const url = String(file.url || fromEnvUrl || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
  const anonKey = String(file.anonKey || fromEnvKey || '').trim();
  cloud.url = url;
  cloud.configured = anonKey.length >= 20;
  return { url, anonKey, path: configPath(), configured: cloud.configured };
}

export function saveCloudConfig({ url, anonKey }) {
  const next = {
    url: String(url || DEFAULT_SUPABASE_URL).replace(/\/+$/, ''),
    anonKey: String(anonKey || '').trim()
  };
  if (next.anonKey.length < 20) {
    const err = new Error('Потрібен anon key з Supabase → Project Settings → API (довгий ключ, не URL).');
    err.code = 'supabase_key_required';
    throw err;
  }
  const file = configPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next), { encoding: 'utf8', mode: 0o600 });
  cloud.url = next.url;
  cloud.configured = true;
  cloud.lastError = null;
  return { url: next.url, configured: true, path: file };
}

export function cloudStatus() {
  const cfg = loadCloudConfig();
  return {
    url: cfg.url,
    configured: cfg.configured,
    lastSyncAt: cloud.lastSyncAt,
    lastError: cloud.lastError,
    direction: cloud.direction,
    remoteUpdatedAt: cloud.remoteUpdatedAt,
    tableMissing: cloud.tableMissing
  };
}

function stamp(value) {
  const n = Date.parse(value || '');
  return Number.isFinite(n) ? n : 0;
}

function slimPayload(payload) {
  const text = JSON.stringify(payload);
  if (text.length < 4_500_000) return payload;
  const copy = JSON.parse(text);
  const cut = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (typeof v === 'string' && v.length > 800 && (key.toLowerCase().includes('photo') || v.startsWith('data:'))) {
        obj[key] = '';
      } else if (v && typeof v === 'object') cut(v);
    }
  };
  cut(copy);
  return copy;
}

async function rest(cfg, method, query, body) {
  const url = cfg.url + '/rest/v1/club_state' + (query || '');
  const headers = {
    apikey: cfg.anonKey,
    Authorization: 'Bearer ' + cfg.anonKey,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  if (method === 'POST') headers.Prefer = 'resolution=merge-duplicates,return=representation';
  const res = await fetch(url, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}
  return { status: res.status, json, text };
}

function explain(res) {
  const msg = (res.json && (res.json.message || res.json.error || res.json.hint)) || res.text || ('HTTP ' + res.status);
  if (res.status === 401 || res.status === 403) return 'Supabase відхилив ключ (' + res.status + '). Перевір anon key.';
  const code = res.json && res.json.code;
  if (code === 'PGRST205' || /club_state/.test(String(msg)) && /schema cache|does not exist|not find/i.test(String(msg))) {
    cloud.tableMissing = true;
    return 'Таблиці club_state ще немає. У Supabase → SQL Editor виконай файл supabase/club_state.sql';
  }
  return String(msg).slice(0, 280);
}

export async function syncOnce() {
  if (running) return running;
  running = (async () => {
    const cfg = loadCloudConfig();
    if (!cfg.configured) {
      cloud.configured = false;
      cloud.direction = 'idle';
      cloud.lastError = null;
      return { ok: false, skipped: true, reason: 'no_key', status: cloudStatus() };
    }
    try {
      const remoteRes = await rest(cfg, 'GET', '?id=eq.' + encodeURIComponent(CLUB_ROW_ID) + '&select=id,updated_at,updated_by,payload');
      if (remoteRes.status === 401 || remoteRes.status === 403 || remoteRes.status >= 400) {
        cloud.lastError = explain(remoteRes);
        cloud.direction = 'error';
        return { ok: false, error: cloud.lastError, status: cloudStatus() };
      }
      cloud.tableMissing = false;
      const row = Array.isArray(remoteRes.json) ? remoteRes.json[0] : null;
      const local = readClub();
      const localAt = stamp(local.updatedAt);
      const remoteAt = row ? stamp(row.updated_at) : 0;
      cloud.remoteUpdatedAt = row ? row.updated_at : null;

      if (row && row.payload && remoteAt > localAt) {
        writeClub({
          updatedAt: row.updated_at,
          updatedBy: row.updated_by || 'supabase',
          payload: row.payload
        });
        cloud.direction = 'pull';
        cloud.lastError = null;
        cloud.lastSyncAt = new Date().toISOString();
        return { ok: true, direction: 'pull', status: cloudStatus() };
      }

      if (local.payload && localAt > remoteAt) {
        const body = {
          id: CLUB_ROW_ID,
          updated_at: local.updatedAt || new Date().toISOString(),
          updated_by: local.updatedBy || 'windows-app',
          payload: slimPayload(local.payload)
        };
        const up = await rest(cfg, 'POST', '?on_conflict=id', body);
        if (up.status >= 400) {
          cloud.lastError = explain(up);
          cloud.direction = 'error';
          return { ok: false, error: cloud.lastError, status: cloudStatus() };
        }
        cloud.direction = 'push';
        cloud.remoteUpdatedAt = body.updated_at;
        cloud.lastError = null;
        cloud.lastSyncAt = new Date().toISOString();
        return { ok: true, direction: 'push', status: cloudStatus() };
      }

      cloud.direction = 'idle';
      cloud.lastError = null;
      cloud.lastSyncAt = new Date().toISOString();
      return { ok: true, direction: 'idle', status: cloudStatus() };
    } catch (err) {
      cloud.lastError = err.message || String(err);
      cloud.direction = 'error';
      return { ok: false, error: cloud.lastError, status: cloudStatus() };
    }
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
}

export function scheduleCloudPush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    syncOnce().catch(() => {});
  }, 400);
}

export function startCloudSync() {
  loadCloudConfig();
  if (timer) return;
  timer = setInterval(() => {
    syncOnce().catch(() => {});
  }, 8000);
  if (typeof timer.unref === 'function') timer.unref();
  syncOnce().catch(() => {});
}

export function stopCloudSync() {
  clearInterval(timer);
  timer = null;
  clearTimeout(pushTimer);
  pushTimer = null;
}

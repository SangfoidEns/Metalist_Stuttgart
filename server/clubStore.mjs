/**
 * JSON club file store for coach / player roles.
 * Files live under data/club/ (override with CLUB_DATA_DIR).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.join(__dirname, 'data', 'club');

const ROLES = new Set(['coach', 'player']);

export function resolveDataDir(override) {
  return path.resolve(override || process.env.CLUB_DATA_DIR || DEFAULT_DIR);
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (!ROLES.has(r)) return null;
  return r;
}

export function filePathFor(role, dataDir) {
  const r = normalizeRole(role);
  if (!r) throw new Error('invalid_role');
  return path.join(ensureDir(dataDir || resolveDataDir()), `metalist_club_${r}.json`);
}

export function metaPathFor(role, dataDir) {
  const r = normalizeRole(role);
  if (!r) throw new Error('invalid_role');
  return path.join(ensureDir(dataDir || resolveDataDir()), `metalist_club_${r}.meta.json`);
}

function readMeta(role, dataDir) {
  try {
    const raw = fs.readFileSync(metaPathFor(role, dataDir), 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function writeMeta(role, dataDir, meta) {
  fs.writeFileSync(metaPathFor(role, dataDir), JSON.stringify(meta, null, 2), 'utf8');
}

/**
 * Validate / normalize incoming club JSON.
 * Accepts full migration packs and coach export payloads.
 */
export function normalizeClubPayload(raw, role) {
  let data = raw;
  if (typeof raw === 'string') {
    data = JSON.parse(raw);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('invalid_club_json');
  }

  const type = data.type || null;
  const allowed =
    type === 'metalist_full_migration' ||
    type === 'metalist_roster_migration' ||
    type == null ||
    data.players != null ||
    data.settings != null ||
    data.schemaVersion != null;

  if (!allowed) {
    throw new Error('unrecognized_club_payload');
  }

  const now = new Date().toISOString();
  if (!data.type) {
    data = Object.assign({}, data, {
      type: role === 'player' ? 'metalist_roster_migration' : 'metalist_full_migration',
      legacyType: data.legacyType || 'metalist_roster_migration'
    });
  }
  if (!data.updatedAt) data.updatedAt = now;
  if (!data.exportedAt) data.exportedAt = data.exportedAt || now;
  data._metalistRole = role;
  data._storedAt = now;
  return data;
}

export function saveClub(role, payload, dataDir) {
  const r = normalizeRole(role);
  if (!r) throw new Error('invalid_role');
  const dir = resolveDataDir(dataDir);
  const data = normalizeClubPayload(payload, r);
  const text = JSON.stringify(data, null, 2);
  const fp = filePathFor(r, dir);
  fs.writeFileSync(fp, text, 'utf8');
  const meta = {
    role: r,
    updatedAt: data.updatedAt || new Date().toISOString(),
    storedAt: new Date().toISOString(),
    size: Buffer.byteLength(text, 'utf8'),
    type: data.type || null,
    club: data.club || (data.settings && data.settings.clubName) || null,
    schemaVersion: data.schemaVersion != null ? data.schemaVersion : null,
    filename: path.basename(fp)
  };
  writeMeta(r, dir, meta);
  return meta;
}

export function loadClub(role, dataDir) {
  const r = normalizeRole(role);
  if (!r) throw new Error('invalid_role');
  const fp = filePathFor(r, dataDir);
  if (!fs.existsSync(fp)) return null;
  const text = fs.readFileSync(fp, 'utf8');
  const data = JSON.parse(text);
  const meta = readMeta(r, dataDir) || {
    role: r,
    updatedAt: data.updatedAt || data.exportedAt || null,
    size: Buffer.byteLength(text, 'utf8'),
    type: data.type || null,
    filename: path.basename(fp)
  };
  return { data, text, meta };
}

export function status(dataDir) {
  const dir = resolveDataDir(dataDir);
  ensureDir(dir);
  const out = { ok: true, dataDir: dir, roles: {} };
  for (const role of ROLES) {
    const loaded = loadClub(role, dir);
    out.roles[role] = loaded
      ? { present: true, ...loaded.meta }
      : { present: false, role, updatedAt: null, size: 0 };
  }
  return out;
}

export function downloadFilename(role, meta) {
  const r = normalizeRole(role) || 'coach';
  const day = (meta && meta.updatedAt ? String(meta.updatedAt) : new Date().toISOString()).slice(0, 10);
  return `metalist_stuttgart_${r}_${day}.json`;
}

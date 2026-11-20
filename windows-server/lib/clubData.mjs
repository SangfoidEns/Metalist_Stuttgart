/**
 * Shared club JSON. One file on the server, last write wins by updatedAt.
 * Coach browsers push; every browser pulls. Without TELEGRAM_BOT_TOKEN and
 * CLUB_WRITE_SECRET the local server accepts writes (club machine / dev).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateInitData } from './validateInitData.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function clubDataFile() {
  return process.env.CLUB_DATA_FILE || path.join(ROOT, 'data', 'club-data.json');
}

export function readClub() {
  try {
    const data = JSON.parse(fs.readFileSync(clubDataFile(), 'utf8'));
    if (!data || typeof data !== 'object') return emptyClub();
    return {
      updatedAt: data.updatedAt || null,
      updatedBy: data.updatedBy || null,
      payload: data.payload || null
    };
  } catch {
    return emptyClub();
  }
}

export function writeClub(record) {
  const file = clubDataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const next = {
    updatedAt: record.updatedAt || new Date().toISOString(),
    updatedBy: record.updatedBy || 'coach',
    payload: record.payload
  };
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next));
  fs.renameSync(tmp, file);
  return next;
}

function emptyClub() {
  return { updatedAt: null, updatedBy: null, payload: null };
}

function messageId(message) {
  return String(message && message.id || '').slice(0, 80);
}

function ownedByActor(message, actor) {
  if (!message || !actor || actor.id == null) return false;
  const id = String(actor.id);
  return String(message.telegramId || '') === id || String(message.playerId || '') === id;
}

/**
 * Union of team-chat messages. Later copy of the same id wins.
 * When actor is set (player chat write), new rows are stamped from that
 * validated Telegram user and cannot replace someone else's message.
 */
export function mergeChat(current, incoming, actor) {
  const map = new Map();
  const addTrusted = (list) => {
    (Array.isArray(list) ? list : []).forEach((m) => {
      if (!m || typeof m !== 'object') return;
      const id = messageId(m);
      if (!id) return;
      const text = String(m.text || '').trim().slice(0, 500);
      if (!text) return;
      const role = ['coach', 'player', 'guest'].includes(m.authorRole) ? m.authorRole : 'guest';
      map.set(id, {
        id,
        text,
        authorName: String(m.authorName || 'Учасник').slice(0, 80),
        authorRole: role,
        playerId: m.playerId ? String(m.playerId).slice(0, 80) : null,
        telegramId: m.telegramId != null ? String(m.telegramId).slice(0, 40) : null,
        createdAt: String(m.createdAt || '')
      });
    });
  };
  addTrusted(current);
  (Array.isArray(incoming) ? incoming : []).forEach((m) => {
    if (!m || typeof m !== 'object') return;
    const id = messageId(m);
    if (!id) return;
    const text = String(m.text || '').trim().slice(0, 500);
    if (!text) return;
    if (!actor) {
      addTrusted([m]);
      return;
    }
    const existing = map.get(id);
    if (existing && !ownedByActor(existing, actor)) return;
    const name = String(actor.first_name || actor.username || 'Гравець').slice(0, 80);
    map.set(id, {
      id,
      text,
      authorName: name,
      authorRole: 'player',
      playerId: String(actor.id).slice(0, 40),
      telegramId: String(actor.id).slice(0, 40),
      createdAt: String(m.createdAt || '')
    });
  });
  return [...map.values()]
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .slice(-300);
}

export function openClubWrites() {
  return !process.env.TELEGRAM_BOT_TOKEN && !process.env.CLUB_WRITE_SECRET;
}

/**
 * Чи можна взагалі прийняти POST.
 * Роль (тренер / гравець / гість) вирішує classifyClubWrite уже після цього.
 * З токеном бота приймається лише підписаний Telegram initData.
 */
export function clubWriteAllowed(req, body) {
  if (clubKeyMatches(req)) return true;
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  if (token) return !!verifiedTelegramUser(body && body.initData);
  return openClubWrites();
}

function clubKeyMatches(req) {
  const secret = process.env.CLUB_WRITE_SECRET || '';
  const header = req && req.headers ? String(req.headers['x-club-key'] || '') : '';
  return !!(secret && header && header === secret);
}

export function coachTelegramId() {
  return String(process.env.COACH_TELEGRAM_ID || '').trim();
}

/** User object only after HMAC. Unsigned initData never grants a role. */
export function verifiedTelegramUser(initData) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!token || !initData) return null;
  const maxAgeSec = Number(process.env.INITDATA_MAX_AGE_SEC || 86400);
  const result = validateInitData(String(initData), token, { maxAgeSec });
  if (!result.ok || !result.user || result.user.id == null || result.user.id === '') return null;
  return result.user;
}

export function clientIsLoopback(req) {
  const remote = req && req.socket ? String(req.socket.remoteAddress || '') : '';
  const normalized = remote.replace(/^::ffff:/, '');
  if (normalized) return isLoopbackHost(normalized);
  return isLoopbackHost(requestHost(req));
}

export function normNick(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase();
}

export function telegramUserFromInitData(initData) {
  try {
    const params = new URLSearchParams(String(initData || ''));
    const raw = params.get('user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user || user.id == null || user.id === '') return null;
    return user;
  } catch {
    return null;
  }
}

export function requestHost(req) {
  const raw = String((req && req.headers && (req.headers.host || req.headers[':authority'])) || '');
  return raw.split(':')[0].replace(/^\[|\]$/g, '').toLowerCase();
}

export function isLoopbackHost(host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function linkedPlayer(payload, user) {
  const players = payload && Array.isArray(payload.players) ? payload.players : [];
  const id = String(user.id);
  return players.some((player) => {
    if (!player) return false;
    if (player.telegramId != null && String(player.telegramId) === id) return true;
    if (player.linkedTelegramId != null && String(player.linkedTelegramId) === id) return true;
    return false;
  });
}

function playerMatches(player, user) {
  if (!player || !user) return false;
  if (player.telegramId != null && String(player.telegramId) === String(user.id)) return true;
  const nick = normNick(user.username);
  return !!(nick && normNick(player.telegramUsername) === nick);
}

function clipText(value, max) {
  return String(value == null ? '' : value).slice(0, max);
}

function validBirth(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

/**
 * Гравець може оновити лише свою анкету і свій подарунок біля імені.
 * Чужі гравці, тренування і чужі подарунки лишаються як були.
 */
export function mergeSelfProfile(currentPayload, incomingPayload, user) {
  if (!currentPayload || !incomingPayload || !user) return currentPayload;
  const players = Array.isArray(currentPayload.players) ? currentPayload.players : [];
  const incomingPlayers = Array.isArray(incomingPayload.players) ? incomingPayload.players : [];
  const mine = players.find((player) => playerMatches(player, user));
  if (!mine) return currentPayload;
  const incoming = incomingPlayers.find((player) => player && String(player.id) === String(mine.id));
  if (!incoming) return currentPayload;

  if (incoming.firstName != null) mine.firstName = clipText(incoming.firstName, 40);
  if (incoming.lastName != null) mine.lastName = clipText(incoming.lastName, 40);
  if (incoming.birthDate != null) {
    const birth = validBirth(incoming.birthDate);
    if (birth != null) mine.birthDate = birth;
  }
  if (incoming.phone != null) mine.phone = clipText(incoming.phone, 40);
  if (incoming.bio != null) mine.bio = clipText(incoming.bio, 400);
  if (incoming.statusText != null) mine.statusText = clipText(incoming.statusText, 80);
  for (const key of ['profilePhoto', 'photoUrl']) {
    if (incoming[key] == null) continue;
    const photo = String(incoming[key]);
    if (!photo) {
      mine[key] = '';
      continue;
    }
    if (photo.startsWith('data:image/') && photo.length <= 400000) mine[key] = photo;
    else if (/^https:\/\//.test(photo) && photo.length <= 500) mine[key] = photo;
  }
  const profile = incoming.profile && typeof incoming.profile === 'object' ? incoming.profile : null;
  if (profile) {
    if (!mine.profile || typeof mine.profile !== 'object') mine.profile = {};
    if (profile.phone != null) mine.profile.phone = clipText(profile.phone, 40);
    if (profile.social != null) mine.profile.social = clipText(profile.social, 200);
    if (profile.status != null) mine.profile.status = clipText(profile.status, 80);
    if (profile.bio != null) mine.profile.bio = clipText(profile.bio, 400);
    if (profile.birthDate != null) {
      const profileBirth = validBirth(profile.birthDate);
      if (profileBirth != null) mine.profile.birthDate = profileBirth;
    }
  }
  if (mine.birthDate) {
    if (!mine.profile || typeof mine.profile !== 'object') mine.profile = {};
    mine.profile.birthDate = mine.birthDate;
  }

  const gifts = Array.isArray(currentPayload.gifts) ? currentPayload.gifts : [];
  const incomingGifts = Array.isArray(incomingPayload.gifts) ? incomingPayload.gifts : [];
  const wanted = incomingGifts.find((gift) => gift && gift.featured && String(gift.playerId) === String(mine.id));
  if (wanted) {
    const key = String(wanted.uid || wanted.id || '');
    const owns = gifts.some((gift) => gift && String(gift.playerId) === String(mine.id) && String(gift.uid || gift.id || '') === key);
    if (owns && key) {
      gifts.forEach((gift) => {
        if (!gift || String(gift.playerId) !== String(mine.id)) return;
        gift.featured = String(gift.uid || gift.id || '') === key;
        if (gift.featured && gift.hue != null) {
          mine.themeHue = gift.hue;
          mine.featuredGiftId = gift.giftId || mine.featuredGiftId || '';
        }
      });
    }
  }
  return currentPayload;
}

/**
 * full — coach replaces the club; chat — linked player adds messages and their profile; deny — guest.
 * Coach privilege is the signed Telegram user id (COACH_TELEGRAM_ID) or the club write key.
 * The write key does not consult initData, so a forged username cannot widen it.
 */
export function classifyClubWrite(req, body, currentPayload) {
  if (clubKeyMatches(req)) return 'full';
  const user = verifiedTelegramUser(body && body.initData);
  if (!user) {
    if (clientIsLoopback(req) && openClubWrites()) return 'full';
    return 'deny';
  }
  if (coachTelegramId() && String(user.id) === coachTelegramId()) return 'full';
  if (linkedPlayer(currentPayload, user)) return 'chat';
  return 'deny';
}

/** Loopback reads stay open for the local app. LAN reads need the write key or a validated Telegram user. */
export function clubReadAllowed(req) {
  if (clientIsLoopback(req)) return true;
  if (clubKeyMatches(req)) return true;
  const initData = req && req.headers ? String(req.headers['x-telegram-init-data'] || '') : '';
  const user = verifiedTelegramUser(initData);
  if (!user) return false;
  if (coachTelegramId() && String(user.id) === coachTelegramId()) return true;
  return linkedPlayer(readClub().payload, user);
}

function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('body_too_large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(Object.assign(new Error('invalid_json'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function corsOrigin(req) {
  const configured = String(process.env.CORS_ORIGIN || '').trim();
  if (configured && configured !== '*') return configured;
  const origin = String((req && req.headers && req.headers.origin) || '');
  if (!origin) return 'http://127.0.0.1';
  try {
    const host = new URL(origin).hostname;
    if (isLoopbackHost(host)) return origin;
  } catch (_) {}
  return 'null';
}

function sendJson(res, status, body, req) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': corsOrigin(req),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Bot-Secret, X-Club-Key',
    'Vary': 'Origin',
    'Cache-Control': 'no-store'
  });
  res.end(json);
}

/**
 * @returns {boolean} true if the request was for /api/club-data
 * @param {(req: import('http').IncomingMessage, body: object) => Promise<boolean>|boolean} mayWrite
 */
export async function handleClubRequest(req, res, mayWrite) {
  const url = new URL(req.url || '/', 'http://local');
  if (url.pathname !== '/api/club-data') return false;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': corsOrigin(req),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Bot-Secret, X-Club-Key',
      'Vary': 'Origin',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return true;
  }

  if (req.method === 'GET') {
    if (!clubReadAllowed(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized', message: 'Потрібен ключ клубу або Telegram initData' }, req);
      return true;
    }
    const club = readClub();
    sendJson(res, 200, { ok: true, ...club }, req);
    return true;
  }

  if (req.method === 'POST') {
    let body = {};
    try {
      body = await readBody(req);
    } catch (e) {
      sendJson(res, e.status || 400, { ok: false, error: e.message || 'bad_request' }, req);
      return true;
    }
    const allowed = await mayWrite(req, body);
    if (!allowed) {
      sendJson(res, 403, { ok: false, error: 'coach_only', message: 'Запис лише для тренера' }, req);
      return true;
    }
    if (!body.payload || typeof body.payload !== 'object') {
      sendJson(res, 400, { ok: false, error: 'payload_required' }, req);
      return true;
    }
    const incomingAt = body.updatedAt || body.payload.updatedAt || new Date().toISOString();
    const current = readClub();
    const mode = classifyClubWrite(req, body, current.payload);
    const actor = verifiedTelegramUser(body && body.initData);
    if (mode === 'deny') {
      sendJson(res, 403, { ok: false, error: 'guest_readonly', message: 'Гість лише переглядає клуб' }, req);
      return true;
    }
    if (mode === 'chat') {
      if (!current.payload || !actor) {
        sendJson(res, 403, { ok: false, error: 'coach_only', message: 'Запис клубу створює лише тренер' }, req);
        return true;
      }
      const payload = Object.assign({}, current.payload, {
        chat: mergeChat(current.payload.chat, body.payload.chat, actor)
      });
      mergeSelfProfile(payload, body.payload, actor);
      const saved = writeClub({
        updatedAt: new Date().toISOString(),
        updatedBy: body.updatedBy || 'player',
        payload
      });
      sendJson(res, 200, { ok: true, updatedAt: saved.updatedAt, updatedBy: saved.updatedBy }, req);
      return true;
    }
    if (current.updatedAt && Date.parse(incomingAt) < Date.parse(current.updatedAt)) {
      sendJson(res, 409, { ok: false, error: 'stale', ...current }, req);
      return true;
    }
    const payload = body.payload;
    if (current.payload) {
      const incomingChat = Array.isArray(payload.chat) ? payload.chat : [];
      const currentChat = Array.isArray(current.payload.chat) ? current.payload.chat : [];
      if (currentChat.length || incomingChat.length) payload.chat = mergeChat(currentChat, incomingChat);
    } else if (Array.isArray(payload.chat)) {
      payload.chat = mergeChat([], payload.chat);
    }
    const saved = writeClub({
      updatedAt: incomingAt,
      updatedBy: body.updatedBy || 'coach',
      payload
    });
    sendJson(res, 200, { ok: true, ...saved, payload: undefined }, req);
    return true;
  }

  sendJson(res, 405, { ok: false, error: 'method_not_allowed' }, req);
  return true;
}

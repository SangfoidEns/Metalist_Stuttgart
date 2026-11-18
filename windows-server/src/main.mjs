/**
 * Windows companion entry: start MetaList API + open control panel.
 * Stack: Node.js (matches existing client server) — no .NET required.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const OPEN_UI = process.env.OPEN_UI !== '0';

process.env.UI_ROOT = process.env.UI_ROOT || path.join(ROOT, 'ui');
process.env.CLUB_DATA_DIR =
  process.env.CLUB_DATA_DIR || path.join(ROOT, 'data', 'club');
process.env.SERVE_UI = process.env.SERVE_UI || '1';
process.env.PORT = String(PORT);
process.env.HOST = HOST;

const { startServer } = await import(path.join(REPO, 'server', 'index.mjs'));

function openBrowser(url) {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
      return;
    }
    if (platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
      return;
    }
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  } catch (e) {
    console.warn('[ui] could not open browser:', e.message || e);
  }
}

await startServer(PORT, HOST);
const url = `http://127.0.0.1:${PORT}/`;
console.info(`[windows-server] Control panel: ${url}`);
console.info('[windows-server] Club JSON API: GET/POST /api/club/*  (roles: coach|player)');
console.info('[windows-server] Press Ctrl+C to stop.');

if (OPEN_UI) {
  setTimeout(() => openBrowser(url), 400);
}

/**
 * STGmetal Windows desktop companion — Electron shell.
 * Simple window UI; HTTP API matches SangfoidEns/STGmetal.
 */
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let mainWindow = null;
let api = null;

async function loadApi() {
  if (api) return api;
  // Windows needs file:// URLs for dynamic ESM import (ERR_UNSUPPORTED_ESM_URL_SCHEME)
  api = await import(pathToFileURL(path.join(__dirname, 'server.mjs')).href);
  return api;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 760,
    height: 860,
    minWidth: 560,
    minHeight: 640,
    title: 'STGmetal — Локальний сервер',
    backgroundColor: '#f6f3ee',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('server:status', async () => {
  const mod = await loadApi();
  return mod.getStatus();
});

ipcMain.handle('server:start', async (_e, opts) => {
  const mod = await loadApi();
  try {
    return { ok: true, status: await mod.startServer(opts || {}) };
  } catch (err) {
    return { ok: false, error: err.message || String(err), status: mod.getStatus() };
  }
});

ipcMain.handle('server:stop', async () => {
  const mod = await loadApi();
  return { ok: true, status: await mod.stopServer() };
});

ipcMain.handle('club:export', async () => {
  const mod = await loadApi();
  const data = mod.exportClubFile();
  if (!data) return { ok: false, error: 'empty' };
  const defaultPath = path.join(
    app.getPath('documents'),
    `metalist_stuttgart_club_${new Date().toISOString().slice(0, 10)}.json`
  );
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Зберегти JSON клубу',
    defaultPath,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { ok: false, error: 'cancelled' };
  fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf8');
  return { ok: true, path: result.filePath, meta: { updatedAt: data.updatedAt, updatedBy: data.updatedBy } };
});

ipcMain.handle('club:import', async () => {
  const mod = await loadApi();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Завантажити JSON клубу',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return { ok: false, error: 'cancelled' };
  }
  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf8');
    const saved = mod.importClubFile(raw);
    return { ok: true, path: result.filePaths[0], meta: saved };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('folder:statusPaths', async () => {
  const mod = await loadApi();
  const s = mod.getStatus();
  return { ok: true, dataDir: s.dataDir, dataFile: s.dataFile };
});

ipcMain.handle('folder:choose', async () => {
  const mod = await loadApi();
  const current = mod.getDataDir();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Обрати папку даних клубу',
    defaultPath: current,
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return { ok: false, error: 'cancelled' };
  }
  try {
    const paths = mod.setDataDir(result.filePaths[0], { migrate: true });
    return { ok: true, ...paths, status: mod.getStatus() };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('folder:open', async () => {
  const mod = await loadApi();
  const dir = mod.getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const err = await shell.openPath(dir);
  if (err) return { ok: false, error: err, path: dir };
  return { ok: true, path: dir };
});

ipcMain.handle('folder:migrateIn', async () => {
  const mod = await loadApi();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Міграція: обрати JSON клубу з іншої папки',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return { ok: false, error: 'cancelled' };
  }
  const src = result.filePaths[0];
  try {
    const raw = fs.readFileSync(src, 'utf8');
    const saved = mod.importClubFile(raw);
    // Also keep a copy named club-data.json in the active data folder
    const dest = mod.getStatus().dataFile;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest + '.migrated-source.json');
    return { ok: true, from: src, to: dest, meta: saved, status: mod.getStatus() };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('cloud:saveKey', async (_e, body) => {
  const mod = await loadApi();
  try {
    const saved = mod.saveSupabaseKey(body && body.anonKey, body && body.url);
    const sync = await mod.syncCloudNow();
    return { ok: true, saved, sync, status: mod.getStatus() };
  } catch (err) {
    return { ok: false, error: err.message || String(err), status: (await loadApi()).getStatus() };
  }
});

ipcMain.handle('cloud:sync', async () => {
  const mod = await loadApi();
  const sync = await mod.syncCloudNow();
  return { ok: !!sync.ok || sync.direction === 'idle', sync, status: mod.getStatus() };
});

ipcMain.handle('folder:migrateOut', async () => {
  const mod = await loadApi();
  const data = mod.exportClubFile();
  if (!data) return { ok: false, error: 'empty' };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Міграція: обрати папку призначення',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return { ok: false, error: 'cancelled' };
  }
  const destDir = result.filePaths[0];
  const dest = path.join(destDir, 'club-data.json');
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(data, null, 2), 'utf8');
  return { ok: true, path: dest };
});

app.whenReady().then(async () => {
  createWindow();
  // Auto-start on loopback so STGmetal can connect immediately
  try {
    const mod = await loadApi();
    await mod.startServer({
      port: Number(process.env.PORT || 8787),
      host: process.env.HOST || '127.0.0.1'
    });
  } catch (err) {
    console.error('[startup]', err.message || err);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  try {
    const mod = await loadApi();
    await mod.stopServer();
  } catch (_) {}
  if (process.platform !== 'darwin') app.quit();
});

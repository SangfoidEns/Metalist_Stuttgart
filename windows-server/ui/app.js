(() => {
  const $ = (id) => document.getElementById(id);
  const api = window.desktop;

  function msg(text, kind) {
    const el = $('msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function paint(status) {
    const running = !!(status && status.running);
    const badge = $('badge');
    badge.textContent = running ? 'працює' : 'вимкнено';
    badge.className = 'badge ' + (running ? 'on' : 'off');
    $('statusText').textContent = running
      ? ('онлайн · ' + (status.host || '127.0.0.1') + (status.lanMode ? ' (LAN)' : ' (локально)'))
      : 'сервер зупинено';
    $('urlText').textContent = (status && status.url) || ('http://127.0.0.1:' + (($('portInput').value) || 8787));
    if (status && status.port) $('portInput').value = String(status.port);

    $('dataDirText').textContent = (status && status.dataDir) || '—';
    $('dataFileText').textContent = (status && status.dataFile) || '—';

    const cloud = status && status.cloud;
    if ($('cloudUrl') && cloud && cloud.url) $('cloudUrl').textContent = cloud.url;
    if ($('cloudMeta')) {
      if (!cloud || !cloud.configured) {
        $('cloudMeta').textContent = 'ключ ще не збережено — встав anon key один раз';
      } else if (cloud.lastError) {
        $('cloudMeta').textContent = cloud.lastError;
      } else {
        const dir = cloud.direction === 'pull' ? 'отримано з сервера'
          : cloud.direction === 'push' ? 'надіслано на сервер'
          : 'синхронно';
        const when = cloud.lastSyncAt ? String(cloud.lastSyncAt).slice(0, 19).replace('T', ' ') : 'очікування';
        $('cloudMeta').textContent = dir + ' · ' + when
          + (cloud.remoteUpdatedAt ? ' · на сервері ' + String(cloud.remoteUpdatedAt).slice(0, 19).replace('T', ' ') : '');
      }
    }

    const club = status && status.club;
    if (!club || !club.hasPayload) {
      $('clubMeta').textContent = 'файлу ще немає — імпортуйте або мігруйте JSON тренера';
    } else {
      const when = club.updatedAt ? String(club.updatedAt).slice(0, 19).replace('T', ' ') : '—';
      $('clubMeta').textContent =
        (club.playerCount || 0) + ' гравців · оновлено ' + when +
        (club.updatedBy ? ' · ' + club.updatedBy : '');
    }

    $('btnStart').disabled = running;
    $('btnStop').disabled = !running;
    $('portInput').disabled = running;
  }

  async function refresh() {
    if (!api) {
      msg('Відкрийте STGmetal-Server.exe (не в браузері)', 'err');
      return;
    }
    try {
      paint(await api.status());
    } catch (e) {
      msg(String(e.message || e), 'err');
    }
  }

  $('btnStart').addEventListener('click', async () => {
    msg('Запуск…');
    const port = Number($('portInput').value || 8787);
    const res = await api.start({ port, host: '127.0.0.1' });
    if (!res.ok) {
      msg(res.error || 'не вдалося стартувати', 'err');
      if (res.status) paint(res.status);
      return;
    }
    paint(res.status);
    msg('Сервер запущено на ' + res.status.url, 'ok');
  });

  $('btnStop').addEventListener('click', async () => {
    const res = await api.stop();
    paint(res.status);
    msg('Сервер зупинено', 'ok');
  });

  $('btnCopy').addEventListener('click', async () => {
    const url = $('urlText').textContent;
    try {
      await navigator.clipboard.writeText(url);
      msg('URL скопійовано', 'ok');
    } catch (_) {
      msg(url, 'ok');
    }
  });

  $('btnChooseFolder').addEventListener('click', async () => {
    const res = await api.chooseFolder();
    if (!res.ok) {
      if (res.error !== 'cancelled') msg(res.error || 'помилка', 'err');
      return;
    }
    if (res.status) paint(res.status);
    else await refresh();
    msg('Папку даних змінено: ' + res.dataDir, 'ok');
  });

  $('btnOpenFolder').addEventListener('click', async () => {
    const res = await api.openFolder();
    if (!res.ok) msg(res.error || 'не вдалося відкрити', 'err');
    else msg('Відкрито: ' + res.path, 'ok');
  });

  $('btnImport').addEventListener('click', async () => {
    const res = await api.importClub();
    if (!res.ok) {
      if (res.error !== 'cancelled') msg(res.error || 'помилка імпорту', 'err');
      return;
    }
    await refresh();
    msg('JSON клубу завантажено на сервер', 'ok');
  });

  $('btnExport').addEventListener('click', async () => {
    const res = await api.exportClub();
    if (!res.ok) {
      if (res.error === 'empty') msg('На сервері ще немає клубного JSON', 'err');
      else if (res.error !== 'cancelled') msg(res.error || 'помилка експорту', 'err');
      return;
    }
    msg('Збережено: ' + res.path, 'ok');
  });

  $('btnCloudSave').addEventListener('click', async () => {
    const anonKey = $('cloudKey').value.trim();
    const clubKey = $('clubKey').value.trim();
    if (!anonKey || clubKey.length < 16) {
      msg('Потрібні anon key і ключ запису клубу (щонайменше 16 символів)', 'err');
      return;
    }
    msg('Підключення до Supabase…');
    const res = await api.saveCloudKey({
      anonKey,
      clubKey,
      url: ($('cloudUrl').textContent || '').trim()
    });
    $('cloudKey').value = '';
    $('clubKey').value = '';
    if (res.status) paint(res.status);
    if (!res.ok) {
      msg(res.error || 'не вдалося зберегти ключ', 'err');
      return;
    }
    const dir = res.sync && res.sync.direction;
    if (res.sync && res.sync.error) msg(res.sync.error, 'err');
    else if (dir === 'pull') msg('Дані клубу завантажено з Supabase', 'ok');
    else if (dir === 'push') msg('Локальні дані надіслано в Supabase', 'ok');
    else msg('Supabase підключено', 'ok');
  });

  $('btnCloudSync').addEventListener('click', async () => {
    msg('Синхронізація…');
    const res = await api.syncCloud();
    if (res.status) paint(res.status);
    if (res.sync && res.sync.skipped) {
      msg('Спочатку збережи anon key', 'err');
      return;
    }
    if (res.sync && !res.sync.ok) {
      msg(res.sync.error || 'помилка синхронізації', 'err');
      return;
    }
    const dir = res.sync && res.sync.direction;
    if (dir === 'pull') msg('Отримано новіші дані з Supabase', 'ok');
    else if (dir === 'push') msg('Надіслано новіші дані в Supabase', 'ok');
    else msg('Уже синхронно з Supabase', 'ok');
  });

  $('btnMigrateIn').addEventListener('click', async () => {
    const res = await api.migrateIn();
    if (!res.ok) {
      if (res.error !== 'cancelled') msg(res.error || 'помилка міграції', 'err');
      return;
    }
    if (res.status) paint(res.status);
    else await refresh();
    msg('Мігровано з ' + res.from + ' → сервер', 'ok');
  });

  $('btnMigrateOut').addEventListener('click', async () => {
    const res = await api.migrateOut();
    if (!res.ok) {
      if (res.error === 'empty') msg('На сервері ще немає клубного JSON', 'err');
      else if (res.error !== 'cancelled') msg(res.error || 'помилка міграції', 'err');
      return;
    }
    msg('Скопійовано в ' + res.path, 'ok');
  });

  refresh();
  setInterval(refresh, 4000);
})();

(() => {
  const $ = (id) => document.getElementById(id);
  const msg = (text, kind) => {
    const el = $('clubMsg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'msg' + (kind ? ' ' + kind : '');
  };

  function fmtMeta(info) {
    if (!info || !info.present) return 'немає файлу / no file';
    const kb = info.size ? Math.round(info.size / 1024) : 0;
    const when = info.updatedAt || info.storedAt || '—';
    const club = info.club ? ` · ${info.club}` : '';
    return `${kb} КБ · ${when}${club}`;
  }

  async function refresh() {
    try {
      const res = await fetch('/api/club/status');
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.message || data.error || 'status failed');

      $('srvState').textContent = 'працює / running';
      $('srvState').className = 'is-up';
      $('srvUrl').textContent = data.url || location.origin;
      $('srvPort').textContent = String(data.port || location.port || 8787);
      $('srvData').textContent = data.dataDir || '—';
      $('meta-coach').textContent = fmtMeta(data.roles && data.roles.coach);
      $('meta-player').textContent = fmtMeta(data.roles && data.roles.player);
    } catch (e) {
      $('srvState').textContent = 'недоступний / down';
      $('srvState').className = 'is-down';
      msg(String(e.message || e), 'err');
    }

    try {
      const res = await fetch('/api/bot/status');
      const data = await res.json();
      if (res.ok && data.ok) {
        const name = data.bot && data.bot.username ? '@' + data.bot.username : '—';
        $('botMeta').textContent = data.hasToken
          ? `токен задано · бот ${name} · chat ${data.defaultChat || '—'}`
          : 'TELEGRAM_BOT_TOKEN не задано (клуб JSON працює без токена)';
      } else {
        $('botMeta').textContent = data.message || data.error || 'bot status unavailable';
      }
    } catch (_) {
      $('botMeta').textContent = 'bot status unavailable';
    }
  }

  async function upload(role, file) {
    if (!file) return;
    msg(`Завантаження ${role}…`);
    try {
      const text = await file.text();
      JSON.parse(text); // validate JSON early
      const res = await fetch('/api/club/upload?role=' + encodeURIComponent(role), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.message || data.error || ('HTTP ' + res.status));
      msg(`OK: ${role} збережено (${Math.round((data.meta && data.meta.size || 0) / 1024)} КБ)`, 'ok');
      await refresh();
    } catch (e) {
      msg(String(e.message || e), 'err');
    }
  }

  function download(role) {
    window.location.href = '/api/club/download/file?role=' + encodeURIComponent(role);
  }

  $('btnRefresh')?.addEventListener('click', () => {
    msg('');
    refresh();
  });
  $('btnCopyUrl')?.addEventListener('click', async () => {
    const url = $('srvUrl')?.textContent || location.origin;
    try {
      await navigator.clipboard.writeText(url);
      msg('URL скопійовано', 'ok');
    } catch (_) {
      msg(url, 'ok');
    }
  });

  document.querySelectorAll('input[data-upload]').forEach((inp) => {
    inp.addEventListener('change', () => {
      const role = inp.getAttribute('data-upload');
      const file = inp.files && inp.files[0];
      upload(role, file).finally(() => { inp.value = ''; });
    });
  });
  document.querySelectorAll('[data-download]').forEach((btn) => {
    btn.addEventListener('click', () => download(btn.getAttribute('data-download')));
  });

  refresh();
  setInterval(refresh, 15000);
})();

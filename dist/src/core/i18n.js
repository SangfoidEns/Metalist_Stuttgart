/** i18n — українська / німецька (Metalist Stuttgart) */
const I18n = (() => {
  const DICT = {
    uk: {
      lang_name: 'Українська',
      lang_label: 'Мова',
      // nav
      nav_home: 'Головна',
      nav_trainings: 'Тренування',
      nav_stats: 'Статистика',
      nav_calendar: 'Календар',
      nav_tactics: 'Схеми',
      nav_squad: 'Склад',
      nav_more: 'Ще',
      nav_board: 'Дошка',
      nav_exercises: 'Вправи',
      nav_diary: 'Щоденник',
      nav_settings: 'Налаштування',
      nav_main: 'Головна навігація',
      // header
      next_label: 'Далі',
      next_training: 'Наступне тренування',
      coach: 'Тренер',
      player: 'Гравець',
      guest: 'Гість',
      // common
      save: 'Зберегти',
      cancel: 'Скасувати',
      delete: 'Видалити',
      edit: 'Редагувати',
      open: 'Відкрити',
      close: 'Закрити',
      back: 'Повернутися',
      import_json: 'Імпорт JSON',
      export_json: 'Експорт JSON',
      search: 'Пошук',
      all: 'Усі',
      // settings
      settings_title: 'Налаштування',
      settings_photos: 'Фото та логотип',
      settings_logo: 'Логотип клубу',
      settings_coach_photo: 'Фото тренера',
      settings_photos_note: 'Фото тренера — на головній картці. Логотип — в емблемі шапки.',
      settings_club: 'Клуб',
      settings_club_name: 'Назва клубу',
      settings_club_short: 'Скорочення',
      settings_coach_name: 'Імʼя тренера',
      settings_colors: 'Кольори',
      settings_primary: 'Основний',
      settings_accent: 'Акцент',
      settings_language: 'Мова інтерфейсу',
      settings_language_hint: 'Українська або німецька. Зберігається на цьому пристрої та в Cloud.',
      settings_saved: 'Налаштування збережено',
      settings_data: 'Дані',
      // squad
      squad_title: 'Склад',
      squad_view_compare: 'перегляд · порівняння',
      head_coach: 'Головний тренер',
      attendance: 'Відвідуваність',
      starter: 'Основа',
      reserve: 'Резерв',
      // trainings
      trainings_title: 'Тренування',
      planned: 'Заплановано',
      done: 'Проведено',
      cancelled: 'Скасовано',
      draft: 'Чернетка',
      // board
      bench: 'ЗАПАС',
      exit_board: 'ВИЙТИ З ДОШКИ',
      // roles toast
      role_coach: 'Тренер',
      role_player: 'Гравець',
      role_guest: 'Гість',
      // home
      available_players: 'Доступні гравці',
      load: 'Навантаження',
      new_training: 'Нове тренування',
      schemes: 'Схеми',
      stats: 'Статистика',
      tools_coach: 'Інструменти тренера'
    },
    de: {
      lang_name: 'Deutsch',
      lang_label: 'Sprache',
      nav_home: 'Start',
      nav_trainings: 'Training',
      nav_stats: 'Statistik',
      nav_calendar: 'Kalender',
      nav_tactics: 'Taktik',
      nav_squad: 'Kader',
      nav_more: 'Mehr',
      nav_board: 'Tafel',
      nav_exercises: 'Übungen',
      nav_diary: 'Tagebuch',
      nav_settings: 'Einstellungen',
      nav_main: 'Hauptnavigation',
      next_label: 'Als Nächstes',
      next_training: 'Nächstes Training',
      coach: 'Trainer',
      player: 'Spieler',
      guest: 'Gast',
      save: 'Speichern',
      cancel: 'Abbrechen',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      open: 'Öffnen',
      close: 'Schließen',
      back: 'Zurück',
      import_json: 'JSON importieren',
      export_json: 'JSON exportieren',
      search: 'Suche',
      all: 'Alle',
      settings_title: 'Einstellungen',
      settings_photos: 'Foto und Logo',
      settings_logo: 'Vereinslogo',
      settings_coach_photo: 'Trainerfoto',
      settings_photos_note: 'Trainerfoto — auf der Hauptkarte. Logo — im Header-Emblem.',
      settings_club: 'Verein',
      settings_club_name: 'Vereinsname',
      settings_club_short: 'Kürzel',
      settings_coach_name: 'Trainername',
      settings_colors: 'Farben',
      settings_primary: 'Primär',
      settings_accent: 'Akzent',
      settings_language: 'Oberflächensprache',
      settings_language_hint: 'Ukrainisch oder Deutsch. Wird auf diesem Gerät und in der Cloud gespeichert.',
      settings_saved: 'Einstellungen gespeichert',
      settings_data: 'Daten',
      squad_title: 'Kader',
      squad_view_compare: 'Ansicht · Vergleich',
      head_coach: 'Cheftrainer',
      attendance: 'Anwesenheit',
      starter: 'Stamm',
      reserve: 'Bank',
      trainings_title: 'Training',
      planned: 'Geplant',
      done: 'Durchgeführt',
      cancelled: 'Abgesagt',
      draft: 'Entwurf',
      bench: 'BANK',
      exit_board: 'TAFEL BEENDEN',
      role_coach: 'Trainer',
      role_player: 'Spieler',
      role_guest: 'Gast',
      available_players: 'Verfügbare Spieler',
      load: 'Belastung',
      new_training: 'Neues Training',
      schemes: 'Taktiken',
      stats: 'Statistik',
      tools_coach: 'Trainer-Tools'
    }
  };

  let lang = 'uk';

  function normalize(code) {
    const c = String(code || '').toLowerCase().slice(0, 2);
    if (c === 'de') return 'de';
    return 'uk';
  }

  function t(key, fallback) {
    const pack = DICT[lang] || DICT.uk;
    if (pack[key] != null) return pack[key];
    if (DICT.uk[key] != null) return DICT.uk[key];
    return fallback != null ? fallback : key;
  }

  function getLang() { return lang; }

  function setLang(code, opts) {
    lang = normalize(code);
    try {
      document.documentElement.setAttribute('lang', lang === 'de' ? 'de' : 'uk');
    } catch (_) {}
    try {
      if (typeof Store !== 'undefined' && Store.get) {
        const s = Store.get();
        if (s) {
          if (!s.settings) s.settings = {};
          s.settings.lang = lang;
          if (!(opts && opts.skipSave) && typeof StorageManager !== 'undefined' && StorageManager.save) {
            StorageManager.save();
          }
        }
      }
    } catch (_) {}
    try { localStorage.setItem('metalist_lang', lang); } catch (_) {}
    applyChrome();
    if (!(opts && opts.silent) && typeof App !== 'undefined' && App.renderCurrent) {
      try { App.renderCurrent(); } catch (_) {}
    }
    return lang;
  }

  function initFromStore() {
    let code = 'uk';
    try {
      if (typeof Store !== 'undefined' && Store.get) {
        const s = Store.get();
        if (s && s.settings && s.settings.lang) code = s.settings.lang;
      }
    } catch (_) {}
    try {
      const ls = localStorage.getItem('metalist_lang');
      if (ls) code = ls;
    } catch (_) {}
    // Telegram language hint (optional)
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) {
        const lc = String(tg.initDataUnsafe.user.language_code).toLowerCase();
        // only auto if user never chose
        let chosen = false;
        try { chosen = !!localStorage.getItem('metalist_lang'); } catch (_) {}
        if (!chosen && (lc === 'de' || lc.indexOf('de') === 0)) code = 'de';
      }
    } catch (_) {}
    setLang(code, { skipSave: true, silent: true });
  }

  /** Оновити фіксований chrome (nav, header) без повного ре-рендеру */
  function applyChrome() {
    const map = [
      ['[data-view="dashboard"] .mni-label, [data-view="dashboard"] .nl', 'nav_home'],
      ['[data-view="trainings"] .mni-label, [data-view="trainings"] .nl', 'nav_trainings'],
      ['[data-view="analytics"] .mni-label, [data-view="analytics"] .nl', 'nav_stats'],
      ['[data-view="calendar"] .mni-label, [data-view="calendar"] .nl', 'nav_calendar'],
      ['[data-view="tactics"] .mni-label, [data-view="tactics"] .nl', 'nav_tactics'],
      ['[data-view="players"] .mni-label, [data-view="players"] .nl', 'nav_squad'],
      ['.mni-more .mni-label', 'nav_more'],
      ['#nextTrBtn .tg-next-label', 'next_label'],
      ['#fsExitBtn', 'exit_board']
    ];
    map.forEach(([sel, key]) => {
      try {
        document.querySelectorAll(sel).forEach(el => {
          if (key === 'exit_board') el.textContent = '✕ ' + t(key);
          else el.textContent = t(key);
        });
      } catch (_) {}
    });
    try {
      document.querySelectorAll('[data-view="dashboard"]').forEach(el => el.setAttribute('aria-label', t('nav_home')));
      document.querySelectorAll('[data-view="trainings"]').forEach(el => el.setAttribute('aria-label', t('nav_trainings')));
      document.querySelectorAll('[data-view="analytics"]').forEach(el => el.setAttribute('aria-label', t('nav_stats')));
      document.querySelectorAll('[data-view="calendar"]').forEach(el => el.setAttribute('aria-label', t('nav_calendar')));
      document.querySelectorAll('[data-view="tactics"]').forEach(el => el.setAttribute('aria-label', t('nav_tactics')));
      document.querySelectorAll('[data-view="players"]').forEach(el => el.setAttribute('aria-label', t('nav_squad')));
      const nav = document.getElementById('mobileNav');
      if (nav) nav.setAttribute('aria-label', t('nav_main'));
      const nbtn = document.getElementById('nextTrBtn');
      if (nbtn) nbtn.setAttribute('title', t('next_training'));
    } catch (_) {}
  }

  return { t, setLang, getLang, initFromStore, applyChrome, DICT, normalize };
})();

// global shorthand
function t(key, fallback) {
  return (typeof I18n !== 'undefined' && I18n.t) ? I18n.t(key, fallback) : (fallback != null ? fallback : key);
}

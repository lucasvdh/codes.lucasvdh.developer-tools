'use strict';

// Intl locale per Homey language, used for number and time formatting only.
const LOCALES = {
  en: 'en-GB',
  nl: 'nl-NL',
  de: 'de-DE',
  fr: 'fr-FR',
  it: 'it-IT',
  sv: 'sv-SE',
  no: 'nb-NO',
  es: 'es-ES',
  da: 'da-DK',
  pl: 'pl-PL',
};

const REFRESH_MS = 60000;
const BUSY_RETRY_MS = 5000;

function lang(value) {
  const code = String(value || 'en').split('-')[0];
  return LOCALES[code] ? code : 'en';
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function fmt(n, l, digits = 0) {
  try {
    return new Intl.NumberFormat(LOCALES[l] || 'en-GB', { maximumFractionDigits: digits }).format(Number(n) || 0);
  } catch (_) {
    return String(Number(n) || 0);
  }
}

// Compact notation (12.3K) only kicks in from 10,000 upwards.
function compact(n, l) {
  const value = Number(n) || 0;
  if (Math.abs(value) < 10000) return fmt(value, l, 0);
  try {
    return new Intl.NumberFormat(LOCALES[l] || 'en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  } catch (_) {
    return fmt(value, l, 0);
  }
}

// Growth is null when there is not enough history yet.
function signed(n, l) {
  if (n === null || n === undefined) return '—';
  const value = Number(n) || 0;
  return (value > 0 ? '+' : '') + fmt(value, l);
}

function trendClass(n) {
  if (n === null || n === undefined) return '';
  if (Number(n) > 0) return 'positive';
  if (Number(n) < 0) return 'negative';
  return '';
}

function time(ts, l, timeZone) {
  try {
    return new Intl.DateTimeFormat(LOCALES[l] || 'en-GB', { timeZone, hour: '2-digit', minute: '2-digit' })
      .format(new Date(Number(ts) || Date.now()));
  } catch (_) {
    return '';
  }
}

function thumb(url) {
  return `<img class="app-thumb" src="${esc(url || 'icon.svg')}" alt="" onerror="this.onerror=null;this.src='icon.svg'">`;
}

function onHomeyReady(Homey) {
  const content = document.getElementById('content');
  const modal = document.getElementById('modal');
  const sheetIcon = document.getElementById('sheetIcon');
  const sheetName = document.getElementById('sheetName');
  const sheetId = document.getElementById('sheetId');
  const sheetBody = document.getElementById('sheetBody');
  const closeButton = document.getElementById('closeModal');

  let timer = null;
  let busy = false;
  let hasData = false;
  let currentData = null;
  let currentApps = [];

  const settings = () => Homey.getSettings() || {};
  const deviceId = () => (Homey.getDeviceIds() || [])[0] || '';

  closeButton.setAttribute('aria-label', Homey.__('widgets.install_overview.close'));

  function schedule(ms = REFRESH_MS) {
    clearTimeout(timer);
    if (document.hidden) return;
    timer = setTimeout(run, ms);
  }

  function tile(value, label, valueClass = '') {
    return `<div class="tile">
      <div class="homey-text-bold ellipsis ${valueClass}">${value}</div>
      <div class="homey-text-small-light ellipsis">${esc(label)}</div>
    </div>`;
  }

  function versionLine(label, value) {
    return `<div class="version-line">
      <span class="homey-text-small-light">${esc(label)}</span>
      <span class="homey-text-small">${esc(value)}</span>
    </div>`;
  }

  function closePopup() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function openPopup(index) {
    const app = currentApps[index];
    if (!app || !currentData) return;
    const l = lang(currentData.locale);

    sheetIcon.src = app.iconUrl || 'icon.svg';
    sheetIcon.onerror = () => {
      sheetIcon.onerror = null;
      sheetIcon.src = 'icon.svg';
    };
    sheetName.textContent = app.name || app.id;
    sheetId.textContent = app.id || '';

    const rating = app.hasRating ? fmt(app.rating, l, 2) : '—';
    const review = app.testState || Homey.__('widgets.install_overview.none');
    const test = app.testVersion ? `v${app.testVersion}` : '—';
    const live = app.liveVersion ? `v${app.liveVersion}` : '—';
    const age = Number(app.liveBuildAgeDays)
      ? Homey.__('widgets.install_overview.age_days', { count: fmt(app.liveBuildAgeDays, l) })
      : '—';

    sheetBody.innerHTML = `
      <div class="homey-text-small-light">${esc(Homey.__('widgets.install_overview.details'))}</div>
      <div class="detail-grid">
        ${tile(esc(fmt(app.installs, l)), Homey.__('widgets.install_overview.total'))}
        ${tile(esc(signed(app.growth7d, l)), Homey.__('widgets.install_overview.growth'), trendClass(app.growth7d))}
        ${tile(esc(fmt(app.cloud, l)), Homey.__('widgets.install_overview.cloud'))}
        ${tile(esc(fmt(app.local, l)), Homey.__('widgets.install_overview.local'))}
        ${tile(esc(fmt(app.deviceCount, l)), Homey.__('widgets.install_overview.devices'))}
        ${tile(esc(rating), Homey.__('widgets.install_overview.rating'))}
        ${tile(esc(fmt(app.suggestionsCount, l)), Homey.__('widgets.install_overview.suggestions'))}
        ${tile(esc(fmt(app.buildCount, l)), Homey.__('widgets.install_overview.builds'))}
      </div>
      <div class="tile version-box">
        ${versionLine(Homey.__('widgets.install_overview.live'), live)}
        ${versionLine(Homey.__('widgets.install_overview.test'), test)}
        ${versionLine(Homey.__('widgets.install_overview.status'), review)}
        ${versionLine(Homey.__('widgets.install_overview.age'), age)}
      </div>`;

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  closeButton.addEventListener('click', closePopup);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closePopup();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePopup();
  });

  async function run() {
    if (busy) {
      schedule(BUSY_RETRY_MS);
      return;
    }
    busy = true;
    try {
      const s = settings();
      const url = `/?deviceId=${encodeURIComponent(deviceId())}`
        + `&sort=${encodeURIComponent(s.sort || 'installs')}`
        + `&limit=${encodeURIComponent(s.limit || '8')}`;
      const data = await Homey.api('GET', url, {});
      draw(data);
      hasData = true;
    } catch (e) {
      // Keep showing the last good data on a failed refresh.
      if (!hasData) content.innerHTML = `<div class="state homey-text-regular error">${esc(e.message || e)}</div>`;
    } finally {
      busy = false;
      schedule();
    }
  }

  function appSubtitle(app, l) {
    const parts = [];
    if (app.liveVersion) parts.push(Homey.__('widgets.install_overview.live_version', { version: app.liveVersion }));
    if (Number(app.deviceCount)) parts.push(Homey.__('widgets.install_overview.device_count', { count: fmt(app.deviceCount, l) }));
    if (app.testState === 'in_review') parts.push(Homey.__('widgets.install_overview.review'));
    if (Number(app.suggestionsCount)) parts.push(Homey.__('widgets.install_overview.suggestion_count', { count: fmt(app.suggestionsCount, l) }));
    return parts.join(' · ') || app.id;
  }

  function appRow(app, index, l) {
    const cloud = Number(app.cloud) || 0;
    const local = Number(app.local) || 0;
    const splitTotal = cloud + local;
    const cloudPct = splitTotal > 0 ? Math.max(0, Math.min(100, (cloud / splitTotal) * 100)) : 0;
    const localPct = splitTotal > 0 ? Math.max(0, 100 - cloudPct) : 0;
    const growth = Homey.__('widgets.install_overview.growth_per_week', { value: signed(app.growth7d, l) });

    return `<article class="row tile" data-app-index="${index}" tabindex="0">
      ${thumb(app.iconUrl)}
      <div class="meta">
        <div class="homey-text-medium ellipsis">${esc(app.name || app.id)}</div>
        <div class="homey-text-small-light ellipsis">${esc(appSubtitle(app, l))}</div>
        <div class="distribution" aria-hidden="true">
          <i class="cloud" style="width:${cloudPct.toFixed(1)}%"></i>
          <i class="local" style="width:${localPct.toFixed(1)}%"></i>
        </div>
      </div>
      <div class="numbers">
        <div class="homey-text-bold">${esc(fmt(app.installs, l))}</div>
        <div class="homey-text-small ${trendClass(app.growth7d)}">${esc(growth)}</div>
      </div>
    </article>`;
  }

  function draw(data) {
    const l = lang(data.locale);
    const apps = Array.isArray(data.apps) ? data.apps : [];
    currentData = data;
    currentApps = apps;

    if (!apps.length) {
      content.innerHTML = `<div class="state homey-text-regular">${esc(Homey.__('widgets.install_overview.empty'))}</div>`;
      return;
    }

    const growth = Homey.__('widgets.install_overview.summary_growth', { value: signed(data.growth7d, l) });
    const accountMeta = [
      Homey.__('widgets.install_overview.app_count', { count: fmt(data.appCount, l) }),
      Homey.__('widgets.install_overview.updated_at', { time: time(data.updatedAt, l, data.timeZone) }),
    ].join(' · ');

    content.innerHTML = `
      <section class="summary tile">
        <div>
          <div class="homey-text-small-light">${esc(Homey.__('widgets.install_overview.total'))}</div>
          <div class="total">${esc(fmt(data.totalInstalls, l))}</div>
          <div class="homey-text-small ${trendClass(data.growth7d)}">${esc(growth)}</div>
        </div>
        <div class="account">
          <div class="homey-text-medium ellipsis">${esc(data.name || '')}</div>
          <div class="homey-text-small-light">${esc(accountMeta)}</div>
        </div>
      </section>
      <div class="quick">
        ${tile(esc(compact(data.totalCloud, l)), Homey.__('widgets.install_overview.cloud'))}
        ${tile(esc(compact(data.totalLocal, l)), Homey.__('widgets.install_overview.local'))}
        ${tile(esc(compact(data.totalDevices, l)), Homey.__('widgets.install_overview.devices'))}
        ${tile(esc(fmt(data.appCount, l)), Homey.__('widgets.install_overview.apps'))}
      </div>
      <div class="list">
        ${apps.map((app, index) => appRow(app, index, l)).join('')}
      </div>`;

    content.querySelectorAll('[data-app-index]').forEach((el) => {
      const open = () => openPopup(Number(el.dataset.appIndex));
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (!document.hidden) run();
  });

  run().finally(() => Homey.ready());
}

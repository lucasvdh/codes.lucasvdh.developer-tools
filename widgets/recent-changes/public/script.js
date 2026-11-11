'use strict';

// Intl locale per Homey language; only used for number and date formatting.
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

function lang(value) {
  const language = String(value || 'en').split('-')[0];
  return LOCALES[language] ? language : 'en';
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

function sign(n, l) {
  const value = Number(n) || 0;
  return (value > 0 ? '+' : '') + fmt(value, l);
}

function stamp(ts, l, timeZone) {
  try {
    return new Intl.DateTimeFormat(LOCALES[l] || 'en-GB', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(Number(ts)));
  } catch (_) {
    return '';
  }
}

function trendClass(n) {
  if (Number(n) > 0) return 'positive';
  if (Number(n) < 0) return 'negative';
  return '';
}

// Falls back to the widget icon when an app icon fails to load.
function useFallbackIcon(img) {
  img.addEventListener('error', () => {
    img.src = 'icon.svg';
  }, { once: true });
}

function onHomeyReady(Homey) {
  const t = (key, tokens) => Homey.__(`widgets.recent_changes.${key}`, tokens);

  const content = document.getElementById('content');
  const modal = document.getElementById('modal');
  const closeButton = document.getElementById('closeModal');
  const sheetIcon = document.getElementById('sheetIcon');
  const sheetName = document.getElementById('sheetName');
  const sheetId = document.getElementById('sheetId');
  const sheetBody = document.getElementById('sheetBody');

  let timer;
  let busy = false;
  let hasData = false;
  let currentData = null;
  let currentRows = [];

  const settings = () => Homey.getSettings() || {};
  const deviceId = () => (Homey.getDeviceIds() || [])[0] || '';

  closeButton.setAttribute('aria-label', t('close'));

  // Describes one change: icon badge, summary line and the value on the right.
  function view(item, l) {
    const type = item.type || 'install';
    const fromText = item.from || '—';
    const toText = item.to || '—';

    switch (type) {
      case 'install': {
        const up = Number(item.diff) > 0;
        return {
          cls: up ? 'up' : 'down',
          icon: up ? '↑' : '↓',
          sub: t('install_change', { from: fmt(item.from, l), to: fmt(item.to, l) }),
          right: sign(item.diff, l),
          rightCls: up ? 'positive' : 'negative',
        };
      }
      case 'rating':
        return {
          cls: 'info',
          icon: '★',
          sub: t('rating_change', { from: fmt(item.from, l, 1), to: fmt(item.to, l, 1) }),
          right: sign(item.diff, l),
          rightCls: trendClass(item.diff),
        };
      case 'live_version':
        return { cls: 'info', icon: 'L', sub: t('live_change', { from: fromText, to: toText }), right: `v${toText}` };
      case 'test_version':
        return { cls: 'info', icon: 'T', sub: t('test_change', { from: fromText, to: toText }), right: `v${toText}` };
      case 'review_state':
        return { cls: 'info', icon: 'R', sub: t('review_change', { from: fromText, to: toText }), right: toText };
      case 'suggestion':
        return { cls: 'info', icon: '!', sub: item.detail || t('suggestion'), right: t('suggestion') };
      case 'devices':
        return {
          cls: 'info',
          icon: 'D',
          sub: t('devices_change', { from: fmt(item.from, l), to: fmt(item.to, l) }),
          right: sign(item.diff, l),
          rightCls: trendClass(item.diff),
        };
      case 'build':
        return { cls: 'info', icon: 'B', sub: item.detail || t('build'), right: t('build') };
      case 'app_added':
        return { cls: 'up', icon: '+', sub: t('added'), right: item.to || '' };
      case 'app_deleted':
        return { cls: 'down', icon: '×', sub: t('deleted'), right: item.from || '' };
      default:
        return { cls: 'info', icon: '•', sub: item.detail || type, right: '' };
    }
  }

  function schedule(ms = 60000) {
    clearTimeout(timer);
    if (document.hidden) return;
    timer = setTimeout(run, ms);
  }

  function closePopup() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function detail(value, label, valueCls = '') {
    return `
      <div class="box detail">
        <b class="truncate ${esc(valueCls)}">${esc(value)}</b>
        <span class="homey-text-small-light">${esc(label)}</span>
      </div>`;
  }

  function versionLine(label, value) {
    return `
      <div class="version-line">
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
      </div>`;
  }

  function openPopup(index) {
    const item = currentRows[index];
    const data = currentData;
    if (!item || !data) return;

    const l = lang(data.locale);
    const v = view(item, l);

    sheetIcon.src = item.iconUrl || 'icon.svg';
    sheetIcon.onerror = () => {
      sheetIcon.onerror = null;
      sheetIcon.src = 'icon.svg';
    };
    sheetName.textContent = item.app || item.appId;
    sheetId.textContent = item.appId || '';

    const rating = item.hasRating ? fmt(item.rating, l, 2) : '—';
    const live = item.liveVersion ? `v${item.liveVersion}` : '—';
    const test = item.testVersion ? `v${item.testVersion}` : '—';
    const status = item.testState || t('none');
    const age = Number(item.liveBuildAgeDays) ? t('days_count', { count: fmt(item.liveBuildAgeDays, l) }) : '—';
    const growth = item.growth7d === null || item.growth7d === undefined ? '—' : sign(item.growth7d, l);

    sheetBody.innerHTML = `
      <div class="section-title">${esc(t('change'))}</div>
      <div class="box change-box">
        <strong>${esc(v.sub)}</strong>
        <span class="homey-text-small-light">${esc(v.right || '')}${v.right ? ' · ' : ''}${esc(stamp(item.t, l, data.timeZone))}</span>
      </div>

      <div class="section-title spaced">${esc(t('current'))}</div>
      <div class="detail-grid">
        ${detail(fmt(item.installs, l), t('installs'))}
        ${detail(growth, t('growth'), trendClass(item.growth7d))}
        ${detail(fmt(item.cloud, l), t('cloud'))}
        ${detail(fmt(item.local, l), t('local'))}
        ${detail(fmt(item.deviceCount, l), t('devices'))}
        ${detail(rating, t('rating'))}
        ${detail(fmt(item.suggestionsCount, l), t('suggestions'))}
        ${detail(fmt(item.buildCount, l), t('builds'))}
      </div>

      <div class="box versions">
        ${versionLine(t('live'), live)}
        ${versionLine(t('test'), test)}
        ${versionLine(t('review'), status)}
        ${versionLine(t('age'), age)}
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
    if (busy) return schedule(5000);
    busy = true;
    try {
      const s = settings();
      const query = `/?deviceId=${encodeURIComponent(deviceId())}`
        + `&range=${encodeURIComponent(s.range || '7d')}`
        + `&filter=${encodeURIComponent(s.filter || 'all')}`;
      const data = await Homey.api('GET', query, {});
      draw(data);
      hasData = true;
    } catch (e) {
      if (!hasData) content.innerHTML = `<div class="state error">${esc(e.message || e)}</div>`;
    } finally {
      busy = false;
      schedule();
    }
  }

  function draw(data) {
    const l = lang(data.locale);
    const rows = Array.isArray(data.changes) ? data.changes : [];
    currentData = data;
    currentRows = rows;

    if (!rows.length) {
      content.innerHTML = `<div class="state">${esc(t('empty'))}</div>`;
      return;
    }

    let html = `
      <div class="summary homey-text-small-light">
        <span class="truncate">${esc(t('summary_count', { count: fmt(rows.length, l) }))}</span>
        <span class="truncate">${esc(data.name || '')}</span>
      </div>
      <div class="list">`;

    rows.forEach((item, index) => {
      const v = view(item, l);
      html += `
        <article class="row" data-change-index="${index}" tabindex="0">
          <div class="visual">
            <img class="app-icon" src="${esc(item.iconUrl || 'icon.svg')}" alt="">
            <span class="mark ${esc(v.cls)}">${esc(v.icon)}</span>
          </div>
          <div class="meta">
            <div class="name truncate">${esc(item.app || item.appId)}</div>
            <div class="homey-text-small-light truncate">${esc(v.sub)}</div>
          </div>
          <div class="delta">
            <strong class="${esc(v.rightCls || '')}">${esc(v.right || '')}</strong>
            <span class="homey-text-small-light">${esc(stamp(item.t, l, data.timeZone))}</span>
          </div>
        </article>`;
    });

    html += '</div>';
    content.innerHTML = html;

    content.querySelectorAll('.app-icon').forEach(useFallbackIcon);
    content.querySelectorAll('[data-change-index]').forEach((el) => {
      const open = () => openPopup(Number(el.dataset.changeIndex));
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

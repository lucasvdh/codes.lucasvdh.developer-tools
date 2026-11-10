
// Intl locales for number formatting, keyed by the Homey language code.
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

function growth(n, l) {
  if (n === null || n === undefined) return '—';
  const value = Number(n) || 0;
  return (value > 0 ? '+' : '') + fmt(value, l);
}

function cls(n) {
  if (n === null || n === undefined) return '';
  if (Number(n) > 0) return 'positive';
  if (Number(n) < 0) return 'negative';
  return '';
}

function validColor(value) {
  return /^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? String(value) : '';
}

function onHomeyReady(Homey) {
  const content = document.getElementById('content');
  const t = (key, tokens) => Homey.__(`widgets.app_spotlight.${key}`, tokens);
  let timer;
  let busy = false;

  const settings = () => Homey.getSettings() || {};

  function schedule(ms = REFRESH_MS) {
    clearTimeout(timer);
    if (document.hidden) return;
    timer = setTimeout(run, ms);
  }

  async function run() {
    if (busy) return schedule(BUSY_RETRY_MS);
    busy = true;
    try {
      const s = settings();
      const dev = s.device || {};
      const app = s.app || {};
      const deviceId = typeof dev === 'string' ? dev : (dev.id || '');
      // Ignore an app that was picked from another overview device.
      const linked = typeof app === 'object' && app.deviceId ? String(app.deviceId) : '';
      const appId = linked && linked !== String(deviceId) ? '' : (typeof app === 'string' ? app : (app.id || ''));
      const data = await Homey.api('GET', `/?deviceId=${encodeURIComponent(deviceId)}&appId=${encodeURIComponent(appId)}`, {});
      draw(data);
    } catch (e) {
      content.innerHTML = `<div class="state error">${esc(e.message || e)}</div>`;
    } finally {
      busy = false;
      schedule();
    }
  }

  function stat(label, value, extraClass = '') {
    return `
      <div class="stat">
        <span class="homey-text-small-light truncate">${esc(label)}</span>
        <strong class="stat-value ${extraClass} truncate">${value}</strong>
      </div>`;
  }

  function draw(data) {
    const l = lang(data.locale);
    const a = data.app;
    const review = a.testState === 'in_review' ? ` · ${t('review')}` : '';
    const rating = a.hasRating === false || Number(a.rating) <= 0 ? '—' : fmt(a.rating, l, 2);
    const live = (a.liveVersion ? `v${esc(a.liveVersion)}` : '—')
      + (a.liveBuildAgeDays ? ` · ${esc(t('age', { days: fmt(a.liveBuildAgeDays, l) }))}` : '');
    const test = (a.testVersion ? `v${esc(a.testVersion)}` : '—')
      + (a.testState ? ` · ${esc(a.testState)}` : '');
    const history = data.history || [];

    content.innerHTML = `
      <div class="hero">
        <img class="app-icon" id="appIcon" src="${esc(a.iconUrl || 'icon.svg')}" alt="">
        <div class="app-name">
          <span class="homey-text-bold truncate">${esc(a.name || a.id)}</span>
          <span class="homey-text-small-light truncate">${esc(a.owner || data.deviceName || '')} · ${esc(a.id)}${esc(review)}</span>
        </div>
        <div class="installs">
          <span class="installs-value">${fmt(a.installs, l)}</span>
          <span class="homey-text-small-light">
            ${esc(t('installs'))} · <b class="${cls(data.growth7d)}">${esc(growth(data.growth7d, l))} / ${esc(t('g7'))}</b>
          </span>
        </div>
      </div>
      <div class="stats">
        ${stat(t('cloud'), fmt(a.cloud, l))}
        ${stat(t('local'), fmt(a.local, l))}
        ${stat(t('rating'), rating)}
        ${stat(t('devices'), fmt(a.deviceCount, l))}
        ${stat(t('live'), live, 'detail')}
        ${stat(t('test'), test, 'detail')}
        ${stat(t('suggestions'), fmt(a.suggestionsCount, l), 'detail')}
        ${stat(t('builds'), fmt(a.buildCount, l), 'detail')}
      </div>
      <div class="chart">
        <div class="chart-head homey-text-small-light">
          <span class="truncate">${esc(data.historySource === 'athom' ? t('history_athom') : t('history_local'))}</span>
          <span class="growths">
            <b class="${cls(data.growth24h)}">${esc(t('g24'))} ${esc(growth(data.growth24h, l))}</b>
            <b class="${cls(data.growth7d)}">${esc(t('g7'))} ${esc(growth(data.growth7d, l))}</b>
            <b class="${cls(data.growth30d)}">${esc(t('g30'))} ${esc(growth(data.growth30d, l))}</b>
          </span>
        </div>
        <svg id="spark" viewBox="0 0 640 130" preserveAspectRatio="none"></svg>
        ${history.length < 2 ? `<div class="hint homey-text-small-light">${esc(t('not_enough_history'))}</div>` : ''}
      </div>`;

    const icon = document.getElementById('appIcon');
    icon.onerror = () => {
      icon.onerror = null;
      icon.src = 'icon.svg';
    };
    // The app's own brand colour is data, used as accent behind its icon.
    const brand = validColor(a.brandColor);
    if (brand) icon.style.backgroundColor = brand;

    drawChart(history);
  }

  function drawChart(history) {
    const svg = document.getElementById('spark');
    if (!svg) return;

    let pts = history
      .map((p) => ({ t: Number(p.t), v: Number(p.v) }))
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
      .sort((a, b) => a.t - b.t);
    if (pts.length < 2) {
      svg.innerHTML = '';
      return;
    }
    if (pts.length > 240) {
      const step = (pts.length - 1) / 239;
      pts = Array.from({ length: 240 }, (_, i) => pts[Math.round(i * step)]);
    }

    const W = 640;
    const H = 130;
    const L = 8;
    const R = 8;
    const T = 8;
    const B = 7;
    const first = pts[0];
    const last = pts[pts.length - 1];
    const minT = first.t;
    const maxT = last.t === first.t ? first.t + 1 : last.t;
    let minV = Math.min(...pts.map((p) => p.v));
    let maxV = Math.max(...pts.map((p) => p.v));
    if (minV === maxV) {
      minV -= 1;
      maxV += 1;
    }
    const pad = Math.max(1, (maxV - minV) * 0.12);
    minV -= pad;
    maxV += pad;

    const x = (t) => L + ((t - minT) / (maxT - minT)) * (W - L - R);
    const y = (v) => T + ((maxV - v) / (maxV - minV)) * (H - T - B);

    let grid = '';
    for (let i = 0; i < 3; i++) {
      const yy = T + i * ((H - T - B) / 2);
      grid += `<line class="grid" x1="${L}" y1="${yy}" x2="${W - R}" y2="${yy}"/>`;
    }
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    const area = `${path} L${x(last.t).toFixed(1)} ${H - B} L${x(first.t).toFixed(1)} ${H - B} Z`;

    svg.innerHTML = `${grid}
      <path class="area" d="${area}"/>
      <path class="actual" d="${path}"/>
      <circle class="dot" cx="${x(last.t)}" cy="${y(last.v)}" r="3.5"/>`;
  }

  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (!document.hidden) run();
  });

  run().finally(() => Homey.ready());
}

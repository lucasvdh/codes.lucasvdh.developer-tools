
// Intl locales for number and time formatting, keyed by the Homey language code.
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

function fmt(n, l) {
  try {
    return new Intl.NumberFormat(LOCALES[l] || 'en-GB').format(Number(n) || 0);
  } catch (_) {
    return String(Number(n) || 0);
  }
}

function cls(n) {
  if (n === null || n === undefined) return '';
  if (Number(n) > 0) return 'positive';
  if (Number(n) < 0) return 'negative';
  return '';
}

function sign(n, l) {
  if (n === null || n === undefined) return '—';
  const value = Number(n) || 0;
  return (value > 0 ? '+' : '') + fmt(value, l);
}

function time(ts, l, timeZone) {
  try {
    return new Intl.DateTimeFormat(LOCALES[l] || 'en-GB', { timeZone, hour: '2-digit', minute: '2-digit' })
      .format(new Date(Number(ts) || Date.now()));
  } catch (_) {
    return '';
  }
}

function onHomeyReady(Homey) {
  const content = document.getElementById('content');
  const t = (key, tokens) => Homey.__(`widgets.milestones.${key}`, tokens);
  let timer;
  let busy = false;
  let hasData = false;

  const deviceId = () => ((Homey.getDeviceIds() || [])[0] || '');
  const settings = () => Homey.getSettings() || {};

  // App icons come from third parties; fall back to the widget icon when one fails to load.
  content.addEventListener('error', (event) => {
    const img = event.target;
    if (img.tagName !== 'IMG' || img.dataset.fallback) return;
    img.dataset.fallback = '1';
    img.src = 'icon.svg';
  }, true);

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
      const data = await Homey.api('GET', `/?deviceId=${encodeURIComponent(deviceId())}&count=${encodeURIComponent(s.count || '6')}`, {});
      draw(data);
      hasData = true;
    } catch (e) {
      // Keep showing the last good data on a failed refresh.
      if (!hasData) content.innerHTML = `<div class="state error">${esc(e.message || e)}</div>`;
    } finally {
      busy = false;
      schedule();
    }
  }

  function row(a, l) {
    const pct = Math.max(0, Math.min(100, Number(a.stageProgress || 0) * 100));
    const growth = a.growth7d === null ? '—' : sign(a.growth7d, l);
    const eta = a.etaDays ? ` · ${t('eta', { days: fmt(a.etaDays, l) })}` : '';
    return `
      <article class="row">
        <div class="top">
          <img class="app-icon" src="${esc(a.iconUrl || 'icon.svg')}" alt="">
          <div class="homey-text-bold truncate">${esc(a.name || a.id)}</div>
          <div class="goal homey-text-medium">${fmt(a.installs, l)} / ${fmt(a.target, l)}</div>
        </div>
        <div class="sub homey-text-small-light">
          <span class="truncate ${cls(a.growth7d)}">${esc(t('growth_7d'))} ${esc(growth)}${esc(eta)}</span>
          <span class="truncate">${esc(t('remaining', { count: fmt(a.remaining, l) }))}</span>
        </div>
        <div class="bar" title="${esc(`${fmt(a.previous, l)} → ${fmt(a.target, l)}`)}">
          <div class="fill" style="width: ${pct.toFixed(2)}%"></div>
        </div>
      </article>`;
  }

  function draw(data) {
    const l = lang(data.locale);
    const apps = Array.isArray(data.apps) ? data.apps : [];
    if (!apps.length) {
      content.innerHTML = `<div class="state">${esc(t('empty'))}</div>`;
      return;
    }
    content.innerHTML = `
      <div class="summary homey-text-small-light">
        <span class="truncate">${esc(data.name || '')}</span>
        <span>${esc(t('updated', { time: time(data.updatedAt, l, data.timeZone) }))}</span>
      </div>
      <div class="list">${apps.map((a) => row(a, l)).join('')}</div>`;
  }

  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (!document.hidden) run();
  });

  run().finally(() => Homey.ready());
}

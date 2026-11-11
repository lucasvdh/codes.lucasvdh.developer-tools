'use strict';

// Intl locale per Homey language; only used for number formatting.
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

// Compact notation (e.g. 12K) from 10,000 upwards.
function compact(n, l) {
  const value = Number(n) || 0;
  if (Math.abs(value) < 10000) return fmt(value, l, 0);
  try {
    return new Intl.NumberFormat(LOCALES[l] || 'en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  } catch (_) {
    return fmt(value, l, 0);
  }
}

// Signed number, or a dash when growth is unknown (null).
function sign(n, l, digits = 0) {
  if (n === null || n === undefined) return '—';
  const value = Number(n) || 0;
  return (value > 0 ? '+' : '') + fmt(value, l, digits);
}

function trendClass(n) {
  if (n === null || n === undefined) return 'unknown';
  if (Number(n) > 0) return 'positive';
  if (Number(n) < 0) return 'negative';
  return '';
}

function onHomeyReady(Homey) {
  const t = (key, tokens) => Homey.__(`widgets.organization_overview.${key}`, tokens);

  const content = document.getElementById('content');

  let timer;
  let busy = false;
  let hasData = false;

  const settings = () => Homey.getSettings() || {};

  function schedule(ms = 60000) {
    clearTimeout(timer);
    if (document.hidden) return;
    timer = setTimeout(run, ms);
  }

  async function run() {
    if (busy) return schedule(5000);
    busy = true;
    try {
      const s = settings();
      const query = `/?range=${encodeURIComponent(s.range || '7d')}&sort=${encodeURIComponent(s.sort || 'installs')}`;
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

  function stat(label, value, valueCls = '') {
    return `
      <div class="stat">
        <span class="homey-text-small-light truncate">${esc(label)}</span>
        <strong class="truncate ${esc(valueCls)}">${esc(value)}</strong>
      </div>`;
  }

  function draw(data) {
    const l = lang(data.locale);
    const rows = Array.isArray(data.organizations) ? data.organizations : [];

    if (!rows.length) {
      content.innerHTML = `<div class="state">${esc(t('empty'))}</div>`;
      return;
    }

    let html = `
      <div class="stats">
        ${stat(t('organizations'), fmt(data.organizationCount, l))}
        ${stat(t('apps'), fmt(data.appCount, l))}
        ${stat(t('installs'), compact(data.totalInstalls, l))}
        ${stat(t('growth'), sign(data.growth, l), trendClass(data.growth))}
      </div>
      <div class="list">`;

    rows.forEach((item, i) => {
      const sub = [
        t('apps_count', { count: fmt(item.appCount, l) }),
        t('devices_count', { count: fmt(item.totalDevices, l) }),
      ];
      if (item.totalSuggestions) sub.push(t('suggestions_count', { count: fmt(item.totalSuggestions, l) }));
      if (item.inReviewCount) sub.push(t('review_count', { count: fmt(item.inReviewCount, l) }));
      if (item.averageRating > 0) sub.push(`★ ${fmt(item.averageRating, l, 2)}`);

      const percent = item.growthPercent === null ? '' : ` · ${sign(item.growthPercent, l, 1)}%`;

      html += `
        <article class="row">
          <div class="rank">${i + 1}</div>
          <div class="meta">
            <div class="name truncate">${esc(item.name)}</div>
            <div class="sub truncate">${esc(sub.join(' · '))}</div>
          </div>
          <div class="numbers">
            <strong>${esc(fmt(item.totalInstalls, l))}</strong>
            <span class="${trendClass(item.growth)}">${esc(sign(item.growth, l))}${esc(percent)}</span>
          </div>
        </article>`;
    });

    html += '</div>';
    content.innerHTML = html;
  }

  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (!document.hidden) run();
  });

  run().finally(() => Homey.ready());
}

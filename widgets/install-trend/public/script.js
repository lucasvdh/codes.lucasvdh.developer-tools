'use strict';

// Intl locale per Homey language, used for number and date formatting only.
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
const DAY_MS = 86400000;

// Chart geometry in SVG user units; the SVG is stretched to fit its box.
const CHART = {
  width: 640,
  height: 220,
  left: 4,
  right: 8,
  top: 10,
  bottom: 10,
};

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

function fmt(n, l, digits = 1) {
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

function sign(n, l, digits = 1) {
  const value = Number(n) || 0;
  return (value > 0 ? '+' : '') + fmt(value, l, digits);
}

function trendClass(n) {
  if (Number(n) > 0) return 'positive';
  if (Number(n) < 0) return 'negative';
  return '';
}

function sample(points, max = 260) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

// Least-squares line through the points: v = a * days + b, days counted from x0.
function regression(points) {
  if (points.length < 2) {
    return { a: 0, b: points[0]?.v || 0, x0: points[0]?.t || Date.now() };
  }
  const x0 = points[0].t;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    const x = (p.t - x0) / DAY_MS;
    const y = p.v;
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }
  const n = points.length;
  const den = n * sxx - sx * sx;
  const a = den ? (n * sxy - sx * sy) / den : 0;
  const b = (sy - a * sx) / n;
  return { a, b, x0 };
}

function onHomeyReady(Homey) {
  const content = document.getElementById('content');

  let timer;
  let busy = false;
  let hasData = false;

  const deviceId = () => (Homey.getDeviceIds() || [])[0] || '';
  const range = () => (Homey.getSettings() || {}).range || '7d';

  function schedule(ms = REFRESH_MS) {
    clearTimeout(timer);
    if (document.hidden) return;
    timer = setTimeout(run, ms);
  }

  async function run() {
    if (busy) return schedule(BUSY_RETRY_MS);
    busy = true;
    try {
      const url = `/?deviceId=${encodeURIComponent(deviceId())}&range=${encodeURIComponent(range())}`;
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

  function stat(label, value, valueClass = '') {
    return `<div class="tile">
      <div class="homey-text-small-light ellipsis">${esc(label)}</div>
      <div class="homey-text-bold ellipsis ${valueClass}">${esc(value)}</div>
    </div>`;
  }

  function draw(data) {
    const l = lang(data.locale);
    const pts = (Array.isArray(data.history) ? data.history : [])
      .map((p) => ({ t: Number(p.t), v: Number(p.v) }))
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
      .sort((a, b) => a.t - b.t);
    const reg = regression(pts);
    const perDay = reg.a || 0;
    const { percentage } = data;
    const source = data.historySource === 'athom'
      ? Homey.__('widgets.install_trend.source_athom')
      : Homey.__('widgets.install_trend.source_local');
    const hint = pts.length < 2
      ? `<div class="hint homey-text-small-light">${esc(Homey.__('widgets.install_trend.building'))}</div>`
      : '';

    content.innerHTML = `
      <div class="stats">
        ${stat(Homey.__('widgets.install_trend.current'), compact(data.endValue, l))}
        ${stat(Homey.__('widgets.install_trend.change'), sign(data.change, l, 0), trendClass(data.change))}
        ${stat(Homey.__('widgets.install_trend.percent'), percentage === null ? '—' : `${sign(percentage, l, 2)}%`, trendClass(percentage))}
        ${stat(Homey.__('widgets.install_trend.per_day'), sign(perDay, l, 1), trendClass(perDay))}
      </div>
      <div class="chart tile">
        <div class="chart-head homey-text-small-light">
          <span class="ellipsis">${esc(source)}</span>
          <span class="legend">
            <span class="actual-label">${esc(Homey.__('widgets.install_trend.actual'))}</span>
            <span>${esc(Homey.__('widgets.install_trend.trend'))}</span>
          </span>
        </div>
        <div id="plot" class="plot">
          <svg id="svg" viewBox="0 0 ${CHART.width} ${CHART.height}" preserveAspectRatio="none"></svg>
          ${hint}
        </div>
        <div id="xAxis" class="x-axis homey-text-small-light"></div>
      </div>`;

    drawChart(pts, reg, data, l);
  }

  function drawChart(pts, reg, data, l) {
    const svg = document.getElementById('svg');
    if (!svg || pts.length < 2) {
      if (svg) svg.innerHTML = '';
      return;
    }

    const shown = sample(pts);
    const { width: W, height: H, left: L, right: R, top: T, bottom: B } = CHART;
    const plotW = W - L - R;
    const plotH = H - T - B;
    const first = shown[0];
    const last = shown[shown.length - 1];
    const minT = first.t;
    const maxT = last.t === first.t ? first.t + 1 : last.t;

    const trendStart = reg.b;
    const trendEnd = reg.a * ((maxT - reg.x0) / DAY_MS) + reg.b;
    const values = shown.map((p) => p.v).concat([trendStart, trendEnd]);
    let minV = Math.min(...values);
    let maxV = Math.max(...values);
    if (minV === maxV) {
      minV -= 1;
      maxV += 1;
    }
    const pad = Math.max(1, (maxV - minV) * 0.12);
    minV -= pad;
    maxV += pad;

    const x = (t) => L + ((t - minT) / (maxT - minT)) * plotW;
    const y = (v) => T + ((maxV - v) / (maxV - minV)) * plotH;

    let grid = '';
    for (let i = 0; i < 4; i++) {
      const yy = T + i * (plotH / 3);
      grid += `<line class="grid" x1="${L}" y1="${yy}" x2="${W - R}" y2="${yy}"/>`;
    }

    const line = shown.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    const area = `${line} L${x(last.t).toFixed(1)} ${T + plotH} L${x(first.t).toFixed(1)} ${T + plotH} Z`;
    const trend = `M${x(minT).toFixed(1)} ${y(trendStart).toFixed(1)} L${x(maxT).toFixed(1)} ${y(trendEnd).toFixed(1)}`;

    svg.innerHTML = `${grid}
      <path class="area" d="${area}"/>
      <path class="trend" d="${trend}"/>
      <path class="actual" d="${line}"/>`;

    // Dot and labels are HTML on top of the SVG so they are not stretched.
    const plot = document.getElementById('plot');
    plot.insertAdjacentHTML('beforeend', `
      <span class="dot" style="left:${(x(last.t) / W) * 100}%;top:${(y(last.v) / H) * 100}%"></span>
      <span class="y-label max homey-text-small-light">${esc(fmt(maxV, l, 0))}</span>
      <span class="y-label min homey-text-small-light">${esc(fmt(minV, l, 0))}</span>`);

    const dateFormat = new Intl.DateTimeFormat(
      LOCALES[l] || 'en-GB',
      data.range === '24h'
        ? { hour: '2-digit', minute: '2-digit', timeZone: data.timeZone }
        : { month: 'short', day: 'numeric', timeZone: data.timeZone },
    );
    document.getElementById('xAxis').innerHTML = `
      <span>${esc(dateFormat.format(new Date(minT)))}</span>
      <span>${esc(dateFormat.format(new Date(maxT)))}</span>`;
  }

  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (!document.hidden) run();
  });

  run().finally(() => Homey.ready());
}

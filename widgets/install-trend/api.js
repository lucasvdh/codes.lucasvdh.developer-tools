'use strict';

const RANGE_MS = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
};


function sampleHistory(points, maxPoints = 320) {
    if (!Array.isArray(points) || points.length <= maxPoints) return points || [];
    const step = (points.length - 1) / (maxPoints - 1);
    return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * step)]);
}

function getDevice(homey, id) {
    return homey.app.getOverviewDevice(id) || null;
}

module.exports = {
    async getData({ homey, query }) {
        const device = getDevice(homey, query && query.deviceId);
        if (!device) throw new Error(homey.__('widgets.no_overview'));

        const range = RANGE_MS[query && query.range] ? query.range : '7d';
        const rangeMs = RANGE_MS[range];
        const data = device.getWidgetData();
        const athomHistory = device.getAthomTotalHistory(rangeMs);
        const historySource = athomHistory.length >= 2 ? 'athom' : 'local';
        const history = historySource === 'athom' ? athomHistory : device.getInstallHistory(rangeMs);
        const sorted = history
            .filter((item) => item && Number.isFinite(Number(item.t)) && Number.isFinite(Number(item.v)))
            .map((item) => ({ t: Number(item.t), v: Number(item.v) }))
            .sort((a, b) => a.t - b.t);
        const startValue = sorted.length ? sorted[0].v : Number(data.totalInstalls) || 0;
        const endValue = sorted.length ? sorted[sorted.length - 1].v : Number(data.totalInstalls) || 0;
        const change = endValue - startValue;
        const percentage = startValue > 0 ? (change / startValue) * 100 : null;

        return {
            deviceId: data.deviceId,
            name: data.name,
            totalInstalls: Number(data.totalInstalls) || 0,
            appCount: Number(data.appCount) || 0,
            updatedAt: Number(data.updatedAt) || Date.now(),
            history: sampleHistory(sorted),
            historySource,
            range,
            startValue,
            endValue,
            change,
            percentage,
            locale: homey.i18n.getLanguage(),
            timeZone: homey.clock.getTimezone(),
        };
    },
};

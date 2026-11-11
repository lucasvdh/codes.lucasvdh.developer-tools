'use strict';

const DAY = 24 * 60 * 60 * 1000;

function clamp(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function getDevice(homey, id) {
    return homey.app.getOverviewDevice(id) || null;
}

function compactApp(device, app) {
    return {
        id: String(app.id || ''),
        name: String(app.name || app.id || ''),
        installs: Number(app.installs) || 0,
        cloud: Number(app.cloud) || 0,
        local: Number(app.local) || 0,
        rating: Number(app.rating) || 0,
        hasRating: app.hasRating !== false && Number.isFinite(Number(app.rating)),
        iconUrl: String(app.iconUrl || ''),
        brandColor: String(app.brandColor || ''),
        deviceCount: Number(app.deviceCount) || 0,
        suggestionsCount: Number(app.suggestionsCount) || 0,
        liveVersion: String(app.liveVersion || ''),
        testVersion: String(app.testVersion || ''),
        testState: String(app.testState || ''),
        buildCount: Number(app.buildCount) || 0,
        liveBuildAgeDays: Number(app.liveBuildAgeDays) || 0,
        growth7d: device.getAppGrowth(String(app.id || ''), 7 * DAY),
    };
}

module.exports = {
    async getData({ homey, query }) {
        const device = getDevice(homey, query && query.deviceId);
        if (!device) throw new Error(homey.__('widgets.no_overview'));

        const data = device.getWidgetData();
        const sort = ['installs', 'growth', 'name'].includes(query && query.sort) ? query.sort : 'installs';
        const limit = clamp(query && query.limit, 4, 20, 8);
        const apps = (Array.isArray(data.apps) ? data.apps : []).map((app) => compactApp(device, app));

        apps.sort((a, b) => {
            if (sort === 'growth') {
                const ag = a.growth7d === null ? -Infinity : Number(a.growth7d) || 0;
                const bg = b.growth7d === null ? -Infinity : Number(b.growth7d) || 0;
                return bg - ag || b.installs - a.installs || a.name.localeCompare(b.name);
            }
            if (sort === 'name') return a.name.localeCompare(b.name) || b.installs - a.installs;
            return b.installs - a.installs || a.name.localeCompare(b.name);
        });

        return {
            deviceId: data.deviceId,
            name: data.name,
            totalInstalls: Number(data.totalInstalls) || 0,
            totalCloud: Number(data.totalCloud) || 0,
            totalLocal: Number(data.totalLocal) || 0,
            totalDevices: Number(data.totalDevices) || 0,
            totalSuggestions: Number(data.totalSuggestions) || 0,
            inReviewCount: Number(data.inReviewCount) || 0,
            averageRating: Number(data.averageRating) || 0,
            appCount: Number(data.appCount) || apps.length,
            growth7d: device.getTotalGrowth(7 * DAY),
            updatedAt: Number(data.updatedAt) || Date.now(),
            enrichmentUpdatedAt: Number(data.enrichmentUpdatedAt) || 0,
            apps: apps.slice(0, limit),
            sort,
            limit,
            locale: homey.i18n.getLanguage(),
            timeZone: homey.clock.getTimezone(),
        };
    },
};

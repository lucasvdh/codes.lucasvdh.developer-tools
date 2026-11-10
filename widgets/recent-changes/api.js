'use strict';

const RANGE_MS = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
};

const FILTERS = {
    all: () => true,
    installs: (item) => item.type === 'install',
    releases: (item) => ['live_version', 'test_version', 'review_state', 'build', 'app_added', 'app_deleted'].includes(item.type),
    activity: (item) => ['rating', 'suggestion', 'devices'].includes(item.type),
};

function getDevice(homey, id) {
    return homey.app.getOverviewDevice(id) || null;
}

module.exports = {
    async getData({ homey, query }) {
        const device = getDevice(homey, query && query.deviceId);
        if (!device) throw new Error(homey.__('widgets.no_overview'));

        const range = RANGE_MS[query && query.range] ? query.range : '7d';
        const filter = FILTERS[query && query.filter] ? query.filter : 'all';
        const data = device.getWidgetData();
        const appDetails = new Map((Array.isArray(data.apps) ? data.apps : []).map((app) => {
            const id = String(app.id || '');
            return [id, {
                id,
                name: String(app.name || app.id || ''),
                iconUrl: String(app.iconUrl || ''),
                installs: Number(app.installs) || 0,
                cloud: Number(app.cloud) || 0,
                local: Number(app.local) || 0,
                rating: Number(app.rating) || 0,
                hasRating: app.hasRating !== false && Number.isFinite(Number(app.rating)),
                deviceCount: Number(app.deviceCount) || 0,
                suggestionsCount: Number(app.suggestionsCount) || 0,
                liveVersion: String(app.liveVersion || ''),
                testVersion: String(app.testVersion || ''),
                testState: String(app.testState || ''),
                buildCount: Number(app.buildCount) || 0,
                liveBuildAgeDays: Number(app.liveBuildAgeDays) || 0,
                growth7d: device.getAppGrowth(id, 7 * 24 * 60 * 60 * 1000),
            }];
        }));
        const filtered = device.getRecentChanges(RANGE_MS[range], 100)
            .filter((item) => item.type !== 'crash')
            .filter(FILTERS[filter]);
        const changes = filtered
            .slice(0, 30)
            .map((item) => {
                const appId = String(item.appId || '');
                const current = appDetails.get(appId) || {};
                return {
                    t: Number(item.t) || Date.now(),
                    type: String(item.type || 'info'),
                    appId,
                    app: String(item.app || current.name || item.appId || ''),
                    from: item.from ?? null,
                    to: item.to ?? null,
                    diff: Number(item.diff) || 0,
                    value: item.value ?? null,
                    detail: String(item.detail || ''),
                    iconUrl: String(item.iconUrl || current.iconUrl || ''),
                    installs: Number(current.installs) || 0,
                    cloud: Number(current.cloud) || 0,
                    local: Number(current.local) || 0,
                    rating: Number(current.rating) || 0,
                    hasRating: current.hasRating === true,
                    deviceCount: Number(current.deviceCount) || 0,
                    suggestionsCount: Number(current.suggestionsCount) || 0,
                    liveVersion: String(current.liveVersion || ''),
                    testVersion: String(current.testVersion || ''),
                    testState: String(current.testState || ''),
                    buildCount: Number(current.buildCount) || 0,
                    liveBuildAgeDays: Number(current.liveBuildAgeDays) || 0,
                    growth7d: current.growth7d ?? null,
                };
            });

        return {
            deviceId: data.deviceId,
            name: data.name,
            changes,
            totalAvailable: filtered.length,
            range,
            filter,
            updatedAt: Number(data.updatedAt) || Date.now(),
            locale: homey.i18n.getLanguage(),
            timeZone: homey.clock.getTimezone(),
        };
    },
};

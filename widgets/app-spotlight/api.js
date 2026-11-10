'use strict';

const DAY = 24 * 60 * 60 * 1000;


function sampleHistory(points, maxPoints = 320) {
    if (!Array.isArray(points) || points.length <= maxPoints) return points || [];
    const step = (points.length - 1) / (maxPoints - 1);
    return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * step)]);
}

function getDevice(homey, id) {
    return homey.app.getOverviewDevice(id) || null;
}

function compactApp(app) {
    return {
        id: String(app.id || ''),
        name: String(app.name || app.id || ''),
        installs: Number(app.installs) || 0,
        cloud: Number(app.cloud) || 0,
        local: Number(app.local) || 0,
        rating: Number(app.rating) || 0,
        hasRating: app.hasRating !== false && Number.isFinite(Number(app.rating)),
        iconUrl: String(app.iconUrl || ''),
        imageLarge: String(app.imageLarge || ''),
        brandColor: String(app.brandColor || ''),
        owner: String(app.owner || ''),
        liveVersion: String(app.liveVersion || ''),
        testVersion: String(app.testVersion || ''),
        liveState: String(app.liveState || ''),
        testState: String(app.testState || ''),
        liveBuildInstalls: Number(app.liveBuildInstalls) || 0,
        liveBuildAgeDays: Number(app.liveBuildAgeDays) || 0,
        testBuildInstalls: Number(app.testBuildInstalls) || 0,
        suggestionsCount: Number(app.suggestionsCount) || 0,
        deviceCount: Number(app.deviceCount) || 0,
        buildCount: Number(app.buildCount) || 0,
    };
}

module.exports = {
    async getData({ homey, query }) {
        const deviceId = String(query && query.deviceId || '');
        const appId = String(query && query.appId || '');
        if (!deviceId) throw new Error(homey.__('widgets.select_device'));
        if (!appId) throw new Error(homey.__('widgets.select_app'));

        const device = getDevice(homey, deviceId);
        if (!device) throw new Error(homey.__('widgets.device_gone'));

        const data = device.getWidgetData();
        const apps = Array.isArray(data.apps) ? data.apps : [];
        const app = apps.find((item) => String(item.id || '') === appId);
        if (!app) throw new Error(homey.__('widgets.app_gone'));

        const history = device.getAppInstallHistory(app.id, 30 * DAY);
        const athomHistory = device.getAthomAppInstallHistory(app.id, 30 * DAY);

        return {
            deviceId: data.deviceId,
            deviceName: data.accountType === 'organization' ? (data.organization || data.name) : data.name,
            app: compactApp(app),
            growth24h: device.getAppGrowth(app.id, DAY),
            growth7d: device.getAppGrowth(app.id, 7 * DAY),
            growth30d: device.getAppGrowth(app.id, 30 * DAY),
            history: sampleHistory(history),
            historySource: athomHistory.length >= 2 ? 'athom' : 'local',
            updatedAt: Number(data.updatedAt) || Date.now(),
            enrichmentUpdatedAt: Number(data.enrichmentUpdatedAt) || 0,
            locale: homey.i18n.getLanguage(),
            timeZone: homey.clock.getTimezone(),
        };
    },
};

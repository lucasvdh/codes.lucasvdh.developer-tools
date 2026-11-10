'use strict';

const DAY = 24 * 60 * 60 * 1000;
const MILESTONES = [100, 500, 1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];

function getDevice(homey, id) {
    return homey.app.getOverviewDevice(id) || null;
}

function nextMilestone(installs) {
    const value = Math.max(0, Number(installs) || 0);
    return MILESTONES.find((target) => target > value) || Math.ceil((value + 1) / 1000000) * 1000000;
}

function previousMilestone(installs) {
    const value = Math.max(0, Number(installs) || 0);
    let previous = 0;
    for (const target of MILESTONES) {
        if (target > value) break;
        previous = target;
    }
    if (value > MILESTONES[MILESTONES.length - 1]) {
        previous = Math.floor(value / 1000000) * 1000000;
    }
    return previous;
}

module.exports = {
    async getData({ homey, query }) {
        const device = getDevice(homey, query && query.deviceId);
        if (!device) throw new Error(homey.__('widgets.no_overview'));

        const count = Math.max(1, Math.min(8, Number(query && query.count) || 6));
        const data = device.getWidgetData();
        const apps = (Array.isArray(data.apps) ? data.apps : []).map((app) => {
            const installs = Number(app.installs) || 0;
            const target = nextMilestone(installs);
            const previous = previousMilestone(installs);
            const growth7d = device.getAppGrowth(app.id, 7 * DAY);
            const perDay = growth7d === null ? null : Number(growth7d) / 7;
            const remaining = Math.max(0, target - installs);
            const stageSize = Math.max(1, target - previous);
            const stageProgress = Math.max(0, Math.min(1, (installs - previous) / stageSize));
            return {
                id: String(app.id || ''),
                name: String(app.name || app.id || ''),
                installs,
                iconUrl: String(app.iconUrl || ''),
                brandColor: String(app.brandColor || ''),
                target,
                previous,
                remaining,
                progress: target > 0 ? Math.min(1, installs / target) : 0,
                stageProgress,
                growth7d,
                etaDays: perDay && perDay > 0 ? Math.ceil(remaining / perDay) : null,
            };
        }).sort((a, b) => {
            const aEta = a.etaDays === null ? Infinity : a.etaDays;
            const bEta = b.etaDays === null ? Infinity : b.etaDays;
            return b.stageProgress - a.stageProgress || aEta - bEta || a.remaining - b.remaining || b.installs - a.installs;
        }).slice(0, count);

        return {
            deviceId: data.deviceId,
            name: data.accountType === 'organization' ? (data.organization || data.name) : data.name,
            apps,
            updatedAt: Number(data.updatedAt) || Date.now(),
            locale: homey.i18n.getLanguage(),
            timeZone: homey.clock.getTimezone(),
        };
    },
};

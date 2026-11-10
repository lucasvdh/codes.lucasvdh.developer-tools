'use strict';

const RANGE_MS = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
};

module.exports = {
    async getData({ homey, query }) {
        const range = RANGE_MS[query && query.range] ? query.range : '7d';
        const sort = ['installs', 'growth', 'name'].includes(query && query.sort) ? query.sort : 'installs';
        // Organizations are not devices here: their apps live in the App overview
        // devices. Collect them per organization, each app once.
        const byOrganization = new Map();
        for (const device of homey.app.getOverviewDevices()) {
            const data = device.getWidgetData();
            for (const app of Array.isArray(data.apps) ? data.apps : []) {
                if (!app || !app.organization || !app.organization.id) continue;
                const entry = byOrganization.get(app.organization.id) || { id: app.organization.id, name: app.organization.name || app.organization.id, apps: new Map() };
                if (!entry.apps.has(app.id)) entry.apps.set(app.id, { app, device });
                byOrganization.set(app.organization.id, entry);
            }
        }

        const organizations = [...byOrganization.values()].map((entry) => {
            const items = [...entry.apps.values()];
            const apps = items.map((item) => item.app);
            const growths = items.map(({ app, device }) => device.getAppGrowth(app.id, RANGE_MS[range]));
            const growth = growths.some((value) => value === null) ? null : growths.reduce((sum, value) => sum + Number(value || 0), 0);
            const totalInstalls = apps.reduce((sum, app) => sum + (Number(app.installs) || 0), 0);
            const baseline = growth === null ? null : totalInstalls - growth;
            const ratings = apps
                .filter((app) => app.hasRating !== false && Number(app.rating) > 0)
                .map((app) => Number(app.rating));
            const ratingSum = ratings.reduce((sum, value) => sum + value, 0);
            return {
                deviceId: entry.id,
                name: entry.name,
                role: '',
                verified: false,
                appCount: apps.length,
                totalInstalls,
                totalDevices: apps.reduce((sum, app) => sum + (Number(app.deviceCount) || 0), 0),
                totalSuggestions: apps.reduce((sum, app) => sum + (Number(app.suggestionsCount) || 0), 0),
                inReviewCount: apps.filter((app) => app.testState === 'in_review').length,
                averageRating: ratings.length ? ratingSum / ratings.length : 0,
                ratingSum,
                ratingCount: ratings.length,
                growth,
                growthPercent: growth !== null && baseline > 0 ? (growth / baseline) * 100 : null,
                updatedAt: Date.now(),
            };
        });

        organizations.sort((a, b) => {
            if (sort === 'growth') {
                const ag = a.growth === null ? -Infinity : Number(a.growth) || 0;
                const bg = b.growth === null ? -Infinity : Number(b.growth) || 0;
                return bg - ag || b.totalInstalls - a.totalInstalls || a.name.localeCompare(b.name);
            }
            if (sort === 'name') return a.name.localeCompare(b.name) || b.totalInstalls - a.totalInstalls;
            return b.totalInstalls - a.totalInstalls || a.name.localeCompare(b.name);
        });

        const completeGrowth = organizations.length > 0 && organizations.every((item) => item.growth !== null);
        const totalRatingCount = organizations.reduce((sum, item) => sum + Number(item.ratingCount || 0), 0);
        const totalRatingSum = organizations.reduce((sum, item) => sum + Number(item.ratingSum || 0), 0);

        return {
            organizations,
            organizationCount: organizations.length,
            appCount: organizations.reduce((sum, item) => sum + item.appCount, 0),
            totalInstalls: organizations.reduce((sum, item) => sum + item.totalInstalls, 0),
            totalDevices: organizations.reduce((sum, item) => sum + item.totalDevices, 0),
            totalSuggestions: organizations.reduce((sum, item) => sum + item.totalSuggestions, 0),
            inReviewCount: organizations.reduce((sum, item) => sum + item.inReviewCount, 0),
            averageRating: totalRatingCount ? totalRatingSum / totalRatingCount : 0,
            growth: completeGrowth ? organizations.reduce((sum, item) => sum + Number(item.growth || 0), 0) : null,
            growthComplete: completeGrowth,
            range,
            sort,
            locale: homey.i18n.getLanguage(),
            timeZone: homey.clock.getTimezone(),
        };
    },
};

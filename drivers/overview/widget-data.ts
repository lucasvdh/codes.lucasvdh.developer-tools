"use strict";

import AthomApi, {AppData, BuildSummary, LocalizedData, StatPoint, Suggestion} from "../../lib/AthomApi";

/**
 * Data for the dashboard widgets of one App overview device. Everything is
 * kept in the device store; capabilities and Flow cards are not touched.
 *
 * On every poll it stores the apps, an install history and a list of
 * changes. Every 15 minutes it also fetches builds, Athom's install history,
 * paired devices per driver, suggestions and the live changelog per app.
 */

const DAY = 24 * 60 * 60 * 1000;
const RETENTION_MS = 35 * DAY;
const DEVELOPER_DATA_INTERVAL = 15 * 60 * 1000;

const STORE = {
  apps: 'widget_apps_v1',
  developerData: 'widget_developer_data_v1',
  lastSync: 'widget_last_sync_v1',
  history: 'widget_install_history_v1',
  appHistory: 'widget_app_install_history_v1',
  activity: 'widget_activity_v1',
};

// Fields that come from each developer data call. When a call fails, these
// fields keep their previous value instead of dropping to zero.
const DEVELOPER_DATA_FIELDS: Record<string, string[]> = {
  builds: ['buildCount', 'latestBuild', 'liveBuild', 'testBuild', 'recentBuilds'],
  installStats: ['installStats'],
  driverStats: ['driverCounts', 'deviceCount'],
  suggestions: ['suggestionsCount', 'latestSuggestion', 'recentSuggestions'],
  liveBuildDetail: ['changelog'],
};

export interface Point {
  t: number;
  v: number;
}

interface BuildRef {
  id: number;
  version: string;
  state: string;
  date: string;
}

export interface DeveloperData {
  installStats: Point[];
  driverCounts: Record<string, number>;
  deviceCount: number;
  buildCount: number;
  latestBuild: BuildRef | null;
  liveBuild: BuildRef | null;
  testBuild: BuildRef | null;
  recentBuilds: Array<{ id: number, version: string, state: string, createdAt: string }>;
  suggestionsCount: number;
  latestSuggestion: { id: string, text: string, createdAt: string } | null;
  recentSuggestions: Array<{ id: string, text: string, createdAt: string }>;
  changelog: string;
  failed: string[];
}

export interface WidgetApp {
  id: string;
  name: string;
  installs: number;
  cloud: number;
  local: number;
  rating: number;
  hasRating: boolean;
  iconUrl: string;
  imageLarge: string;
  brandColor: string;
  owner: string;
  organization: { id: string, name: string } | null;
  liveVersion: string;
  testVersion: string;
  liveState: string;
  testState: string;
  liveBuildInstalls: number;
  testBuildInstalls: number;
  liveBuildAgeDays: number;
  hasDeveloperData: boolean;
  deviceCount: number;
  buildCount: number;
  suggestionsCount: number;
  latestSuggestion: DeveloperData['latestSuggestion'];
  latestBuild: BuildRef | null;
  changelog: string;
}

export interface Activity {
  t: number;
  type: string;
  appId: string;
  app: string;
  iconUrl: string;
  from?: string | number | null;
  to?: string | number | null;
  diff?: number;
  detail?: string;
}

/** The device methods WidgetData needs; OverviewDevice provides them. */
export interface WidgetHost {
  getStoreValue(key: string): any;
  setStoreValue(key: string, value: any): Promise<void>;
  getId(): string;
  getName(): string;
  log(...args: any[]): void;
  error(...args: any[]): void;
  homey: { i18n: { getLanguage(): string } };
}

function cleanPoints(points: unknown): Point[] {
  return (Array.isArray(points) ? points : [])
      .filter((item) => item && Number.isFinite(Number(item.t)) && Number.isFinite(Number(item.v)))
      .map((item) => ({t: Number(item.t), v: Number(item.v)}))
      .sort((a, b) => a.t - b.t);
}

/** Points inside the range, plus the last point before it as a baseline. */
function inRange(points: unknown, rangeMs: number): Point[] {
  const sorted = cleanPoints(points);
  const cutoff = Date.now() - Math.max(60 * 60 * 1000, Number(rangeMs) || 0);
  const within = sorted.filter((item) => item.t >= cutoff);
  const baseline = sorted.filter((item) => item.t < cutoff).pop();
  return baseline ? [baseline, ...within] : within;
}

function addPoint(history: unknown, bucketMs: number, value: number): Point[] {
  const now = Date.now();
  const bucket = Math.floor(now / bucketMs) * bucketMs;
  const points = cleanPoints(history);
  const point = {t: bucket, v: Number(value) || 0};
  const last = points[points.length - 1];
  if (last && last.t === bucket) points[points.length - 1] = point;
  else points.push(point);
  return points.filter((item) => item.t >= now - RETENTION_MS);
}

function daysSince(value: string | undefined): number {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / DAY));
}

function normalizeAssetUrl(value: string | undefined): string {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^(?:https?:|data:|blob:)/i.test(text)) return text;
  if (text.startsWith('//')) return `https:${text}`;
  if (text.startsWith('/')) return `https://apps-api.athom.com${text}`;
  return text;
}

function localized(value: LocalizedData | string | undefined, language: string): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const names = value as Record<string, string | undefined>;
  return names[language] || names.en || Object.values(names).find(Boolean) || '';
}

function statPoints(stats: StatPoint[] | null | undefined): Point[] {
  return (Array.isArray(stats) ? stats : [])
      .map((point) => ({t: Date.parse(point?.date || ''), v: Number(point?.value)}))
      .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.v))
      .sort((a, b) => a.t - b.t);
}

export class WidgetData {
  private device: WidgetHost;

  constructor(device: WidgetHost) {
    this.device = device;
  }

  private get store() {
    return {
      get: (key: string) => this.device.getStoreValue(key),
      set: (key: string, value: any) => this.device.setStoreValue(key, value),
    };
  }

  shouldFetchDeveloperData(): boolean {
    const data = this.store.get(STORE.developerData);
    return Date.now() - (Number(data?.updatedAt) || 0) >= DEVELOPER_DATA_INTERVAL;
  }

  /** Builds, install history, devices per driver, suggestions and changelog of one app. */
  static async fetchDeveloperData(api: AthomApi, app: AppData, language: string): Promise<DeveloperData> {
    const liveBuildId = app.liveBuild?.id;
    const calls: Record<string, Promise<unknown>> = {
      builds: api.getBuilds(app.id),
      installStats: api.getInstallStats(app.id),
      driverStats: api.getDriverStats(app.id),
      suggestions: api.getSuggestions(app.id),
      liveBuildDetail: liveBuildId === undefined || liveBuildId === null ? Promise.resolve(null) : api.getBuild(app.id, liveBuildId),
    };
    const keys = Object.keys(calls);
    const settled = await Promise.allSettled(keys.map((key) => calls[key]));
    const values: Record<string, any> = {};
    const failed: string[] = [];
    settled.forEach((result, index) => {
      values[keys[index]] = result.status === 'fulfilled' ? result.value : null;
      if (result.status === 'rejected') failed.push(keys[index]);
    });

    const builds: BuildSummary[] = Array.isArray(values.builds) ? values.builds : [];
    const suggestions: Suggestion[] = Array.isArray(values.suggestions) ? values.suggestions : [];
    const newestFirst = builds.slice().sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));
    // The build the app points to, or else the newest build in that state.
    const findBuild = (id: number | undefined, state: string) =>
        (id !== undefined && builds.find((build) => String(build?.id) === String(id)))
        || newestFirst.find((build) => build?.state === state)
        || null;
    const buildRef = (build: BuildSummary | null): BuildRef | null => (build ? {
      id: Number(build.id) || 0,
      version: String(build.version || ''),
      state: String(build.state || ''),
      date: build.stateChangedAt || build.createdAt || '',
    } : null);

    const driverCounts: Record<string, number> = {};
    if (values.driverStats && typeof values.driverStats === 'object') {
      for (const [driverId, series] of Object.entries(values.driverStats as Record<string, StatPoint[]>)) {
        const points = statPoints(series);
        if (points.length) driverCounts[driverId] = Math.max(0, points[points.length - 1].v);
      }
    }
    const suggestionsNewestFirst = suggestions.slice()
        .sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')));
    const suggestionRef = (suggestion: Suggestion) => ({
      id: String(suggestion.id || ''),
      text: String(suggestion.suggestionText || ''),
      createdAt: suggestion.createdAt || '',
    });

    return {
      installStats: statPoints(values.installStats),
      driverCounts,
      deviceCount: Object.values(driverCounts).reduce((sum, value) => sum + value, 0),
      buildCount: builds.length,
      latestBuild: buildRef(newestFirst[0] || null),
      liveBuild: buildRef(findBuild(app.liveBuild?.id, 'live')),
      testBuild: buildRef(findBuild(app.testBuild?.id, 'test')),
      recentBuilds: newestFirst.slice(0, 20).map((build) => ({
        id: Number(build.id) || 0,
        version: String(build.version || ''),
        state: String(build.state || ''),
        createdAt: build.createdAt || build.stateChangedAt || '',
      })),
      suggestionsCount: suggestions.length,
      latestSuggestion: suggestionsNewestFirst[0] ? suggestionRef(suggestionsNewestFirst[0]) : null,
      recentSuggestions: suggestionsNewestFirst.slice(0, 20).map(suggestionRef),
      changelog: values.liveBuildDetail ? localized(values.liveBuildDetail.changelog, language) : '',
      failed,
    };
  }

  /** Keeps the previous value of every field whose call failed this time. */
  static mergeDeveloperData(previous: DeveloperData | undefined, next: DeveloperData): DeveloperData {
    if (!previous || !next.failed.length) return next;
    const merged: any = {...next};
    for (const key of next.failed) {
      for (const field of DEVELOPER_DATA_FIELDS[key] || []) {
        if ((previous as any)[field] !== undefined) merged[field] = (previous as any)[field];
      }
    }
    return merged;
  }

  private widgetApp(app: AppData, data: DeveloperData | undefined, ownerName: string): WidgetApp {
    const liveBuild: any = app.liveBuild || {};
    const testBuild: any = app.testBuild || {};
    const rating = app.rating === null || app.rating === undefined ? NaN : Number(app.rating);
    const language = this.device.homey.i18n.getLanguage();
    return {
      id: String(app.id),
      name: localized(liveBuild.name || testBuild.name, language) || app.id,
      installs: Number(app.installs) || 0,
      cloud: Number(app.installsCloud) || 0,
      local: Number(app.installsLocal) || 0,
      rating: Number.isFinite(rating) ? rating : 0,
      hasRating: Number.isFinite(rating),
      iconUrl: normalizeAssetUrl(liveBuild.icon || testBuild.icon || liveBuild.imageSmall || testBuild.imageSmall),
      imageLarge: normalizeAssetUrl(liveBuild.imageLarge || testBuild.imageLarge),
      brandColor: String(liveBuild.brandColor || testBuild.brandColor || ''),
      owner: app.organization?.name || ownerName,
      organization: app.organization ? {id: app.organization.id, name: app.organization.name} : null,
      liveVersion: String(app.liveVersion || liveBuild.version || data?.liveBuild?.version || ''),
      testVersion: String(app.testVersion || testBuild.version || data?.testBuild?.version || ''),
      liveState: String(liveBuild.state || data?.liveBuild?.state || ''),
      testState: String(testBuild.state || data?.testBuild?.state || ''),
      liveBuildInstalls: Number(liveBuild.installs) || 0,
      testBuildInstalls: Number(testBuild.installs) || 0,
      liveBuildAgeDays: daysSince(app.liveBuildUpdatedAt || liveBuild.stateChangedAt || data?.liveBuild?.date),
      hasDeveloperData: Boolean(data),
      deviceCount: Number(data?.deviceCount) || 0,
      buildCount: Number(data?.buildCount) || 0,
      suggestionsCount: Number(data?.suggestionsCount) || 0,
      latestSuggestion: data?.latestSuggestion || null,
      latestBuild: data?.latestBuild || null,
      changelog: String(data?.changelog || ''),
    };
  }

  /**
   * Called after every poll with the apps of this device (already filtered on
   * the chosen organizations). `api` is only used when developer data is due.
   */
  async update(appsData: AppData[], api: AthomApi | undefined, ownerName: string): Promise<void> {
    const rawApps = appsData.filter((app) => app && app.id && !app.deleted);
    const stored = this.store.get(STORE.developerData) || {};
    let developerData: Record<string, DeveloperData> = stored.apps && typeof stored.apps === 'object' ? stored.apps : {};

    if (api && this.shouldFetchDeveloperData()) {
      const language = this.device.homey.i18n.getLanguage();
      const next: Record<string, DeveloperData> = {};
      // One app at a time; the calls of one app run in parallel.
      for (const app of rawApps) {
        next[app.id] = WidgetData.mergeDeveloperData(developerData[app.id], await WidgetData.fetchDeveloperData(api, app, language));
      }
      developerData = next;
      await this.store.set(STORE.developerData, {updatedAt: Date.now(), apps: developerData});
    }

    const previous = this.store.get(STORE.apps);
    const apps = rawApps
        .map((app) => this.widgetApp(app, developerData[app.id], ownerName))
        .sort((a, b) => a.name.localeCompare(b.name));

    await this.recordActivity(apps, Array.isArray(previous) ? previous : []);
    await this.store.set(STORE.apps, apps);
    await this.store.set(STORE.history, addPoint(this.store.get(STORE.history), 15 * 60 * 1000, apps.reduce((sum, app) => sum + app.installs, 0)));

    const appHistory = this.store.get(STORE.appHistory) || {};
    const nextAppHistory: Record<string, Point[]> = {};
    for (const app of apps) nextAppHistory[app.id] = addPoint(appHistory[app.id], 30 * 60 * 1000, app.installs);
    await this.store.set(STORE.appHistory, nextAppHistory);

    await this.store.set(STORE.lastSync, Date.now());
  }

  /** Changes seen between two polls. Builds and suggestions come dated from the developer data instead. */
  private async recordActivity(apps: WidgetApp[], previousApps: WidgetApp[]): Promise<void> {
    if (!previousApps.length) return;
    const events: Activity[] = [];
    const add = (type: string, app: WidgetApp, extra: Partial<Activity> = {}) =>
        events.push({t: Date.now(), type, appId: app.id, app: app.name, iconUrl: app.iconUrl || '', ...extra});
    const previousById = new Map(previousApps.map((app) => [String(app.id), app]));
    const currentIds = new Set(apps.map((app) => app.id));

    for (const app of apps) {
      const old = previousById.get(app.id);
      if (!old) {
        add('app_added', app, {to: app.liveVersion || app.testVersion || ''});
        continue;
      }
      if (old.installs !== app.installs) add('install', app, {from: old.installs, to: app.installs, diff: app.installs - old.installs});
      if (old.rating !== app.rating) add('rating', app, {from: old.rating, to: app.rating, diff: app.rating - old.rating});
      if (old.liveVersion !== app.liveVersion) add('live_version', app, {from: old.liveVersion, to: app.liveVersion, detail: app.changelog});
      if (old.testVersion !== app.testVersion) add('test_version', app, {from: old.testVersion, to: app.testVersion});
      if (old.testState !== app.testState) add('review_state', app, {from: old.testState, to: app.testState});
      // Only when both polls had developer data; the first fetch is not a change.
      if (old.hasDeveloperData && app.hasDeveloperData && old.deviceCount !== app.deviceCount) {
        add('devices', app, {from: old.deviceCount, to: app.deviceCount, diff: app.deviceCount - old.deviceCount});
      }
    }
    for (const old of previousApps) {
      if (!currentIds.has(String(old.id))) add('app_deleted', old, {from: old.liveVersion || old.testVersion || ''});
    }
    if (!events.length) return;

    const cutoff = Date.now() - RETENTION_MS;
    const stored = this.store.get(STORE.activity);
    const all = [...(Array.isArray(stored) ? stored : []), ...events]
        .filter((item) => item && Number(item.t) >= cutoff)
        .slice(-500);
    await this.store.set(STORE.activity, all);
  }

  getWidgetData() {
    const apps: WidgetApp[] = this.store.get(STORE.apps) || [];
    const developerData = this.store.get(STORE.developerData) || {};
    const ratings = apps.map((app) => Number(app.rating)).filter((value) => value > 0);
    const sum = (key: keyof WidgetApp) => apps.reduce((total, app) => total + (Number(app[key]) || 0), 0);
    return {
      deviceId: this.device.getId(),
      name: this.device.getName(),
      totalInstalls: sum('installs'),
      totalCloud: sum('cloud'),
      totalLocal: sum('local'),
      totalDevices: sum('deviceCount'),
      totalSuggestions: sum('suggestionsCount'),
      inReviewCount: apps.filter((app) => app.testState === 'in_review').length,
      averageRating: ratings.length ? ratings.reduce((total, value) => total + value, 0) / ratings.length : 0,
      appCount: apps.length,
      updatedAt: Number(this.store.get(STORE.lastSync)) || Date.now(),
      enrichmentUpdatedAt: Number(developerData.updatedAt) || 0,
      apps: apps.map((app) => ({...app})),
    };
  }

  getInstallHistory(rangeMs = 7 * DAY): Point[] {
    return inRange(this.store.get(STORE.history), rangeMs);
  }

  /** Athom's own install history per app, from the developer data. */
  getAthomAppInstallHistory(appId: string, rangeMs = 30 * DAY): Point[] {
    const data = this.store.get(STORE.developerData) || {};
    return inRange(data.apps?.[String(appId)]?.installStats, rangeMs);
  }

  /**
   * Total of Athom's history. Apps with a history are summed; apps without
   * one count at their current installs, so one app without history does not
   * throw away the whole trend.
   */
  getAthomTotalHistory(rangeMs = 30 * DAY): Point[] {
    const apps: WidgetApp[] = this.store.get(STORE.apps) || [];
    const series: Point[][] = [];
    let constant = 0;
    for (const app of apps) {
      const points = this.getAthomAppInstallHistory(app.id, rangeMs);
      if (points.length >= 2) series.push(points);
      else constant += Number(app.installs) || 0;
    }
    if (!series.length) return [];

    // Start where every series has data, so no app is missing from the sum.
    const start = Math.max(...series.map((points) => points[0].t));
    const times = [...new Set(series.flat().map((point) => point.t))]
        .filter((t) => t >= start)
        .sort((a, b) => a - b);
    return times.map((t) => ({
      t,
      v: constant + series.reduce((total, points) => {
        const last = points.filter((point) => point.t <= t).pop();
        return total + (last ? last.v : 0);
      }, 0),
    }));
  }

  getAppInstallHistory(appId: string, rangeMs = 30 * DAY): Point[] {
    const athom = this.getAthomAppInstallHistory(appId, rangeMs);
    if (athom.length >= 2) return athom;
    const all = this.store.get(STORE.appHistory) || {};
    return inRange(all[String(appId)], rangeMs);
  }

  static growthFromHistory(history: Point[], rangeMs: number): number | null {
    const sorted = cleanPoints(history);
    if (sorted.length < 2) return null;
    const baseline = sorted.filter((item) => item.t <= Date.now() - Number(rangeMs)).pop();
    if (!baseline) return null;
    return sorted[sorted.length - 1].v - baseline.v;
  }

  getTotalGrowth(rangeMs: number): number | null {
    const athom = this.getAthomTotalHistory(rangeMs);
    return WidgetData.growthFromHistory(athom.length >= 2 ? athom : this.getInstallHistory(rangeMs), rangeMs);
  }

  getAppGrowth(appId: string, rangeMs: number): number | null {
    return WidgetData.growthFromHistory(this.getAppInstallHistory(appId, Math.max(rangeMs, 30 * DAY)), rangeMs);
  }

  /** Builds and suggestions with their own dates, so they show up right away. */
  private getDatedActivity(): Activity[] {
    const data = this.store.get(STORE.developerData) || {};
    const apps: WidgetApp[] = this.store.get(STORE.apps) || [];
    const events: Activity[] = [];
    for (const app of apps) {
      const appData: Partial<DeveloperData> = data.apps?.[app.id] || {};
      const base = {appId: app.id, app: app.name, iconUrl: app.iconUrl || ''};
      for (const build of appData.recentBuilds || []) {
        const t = Date.parse(build.createdAt || '');
        if (Number.isFinite(t)) events.push({...base, t, type: 'build', to: build.version, detail: `v${build.version} ${build.state}`.trim()});
      }
      for (const suggestion of appData.recentSuggestions || []) {
        const t = Date.parse(suggestion.createdAt || '');
        if (Number.isFinite(t)) events.push({...base, t, type: 'suggestion', detail: suggestion.text});
      }
    }
    return events;
  }

  getRecentChanges(rangeMs = 7 * DAY, limit = 30): Activity[] {
    const events = this.store.get(STORE.activity);
    const cutoff = Date.now() - Math.max(60 * 60 * 1000, Number(rangeMs) || 0);
    return [...(Array.isArray(events) ? events : []), ...this.getDatedActivity()]
        .filter((item) => item && Number(item.t) >= cutoff)
        .sort((a, b) => Number(b.t) - Number(a.t))
        .slice(0, Math.max(1, Math.min(100, Number(limit) || 30)));
  }
}

export default WidgetData;

import AthomApi, {AppData, BuildDetail, BuildSummary, StatPoint, Suggestion} from "./AthomApi";

export type AppDetailKey = 'suggestions' | 'builds' | 'installStats' | 'driverStats' | 'liveBuild';

/** The per-app developer data; a field is undefined when its call failed. */
export interface AppDetails {
  fetchedAt: number;
  suggestions?: Suggestion[];
  builds?: BuildSummary[];
  installStats?: StatPoint[];
  driverStats?: Record<string, StatPoint[]>;
  liveBuild?: BuildDetail | null;
  errors: Partial<Record<AppDetailKey, unknown>>;
}

/**
 * Builds, suggestions, install and driver stats and the live build of each
 * app, fetched once and shared by the app driver and the dashboard widgets.
 */
export class AppDetailsCache {
  private cache: Map<string, AppDetails> = new Map();

  /** Always fetches, and keeps the result for other readers. */
  async fetch(api: AthomApi, appData: AppData): Promise<AppDetails> {
    const appId = appData.id;
    const liveBuildId = appData.liveBuild?.id;

    const [suggestions, builds, installStats, driverStats, liveBuild] = await Promise.allSettled([
      api.getSuggestions(appId),
      api.getBuilds(appId),
      api.getInstallStats(appId),
      api.getDriverStats(appId),
      liveBuildId !== undefined && liveBuildId !== null ? api.getBuild(appId, liveBuildId) : Promise.resolve(null),
    ]);

    const details: AppDetails = {fetchedAt: Date.now(), errors: {}};
    if (suggestions.status === 'fulfilled') details.suggestions = suggestions.value;
    else details.errors.suggestions = suggestions.reason;
    if (builds.status === 'fulfilled') details.builds = builds.value;
    else details.errors.builds = builds.reason;
    if (installStats.status === 'fulfilled') details.installStats = installStats.value;
    else details.errors.installStats = installStats.reason;
    if (driverStats.status === 'fulfilled') details.driverStats = driverStats.value;
    else details.errors.driverStats = driverStats.reason;
    if (liveBuild.status === 'fulfilled') details.liveBuild = liveBuild.value;
    else details.errors.liveBuild = liveBuild.reason;

    this.cache.set(appId, details);
    return details;
  }

  /** The cached details when they are younger than maxAgeMs, else fetches them. */
  async get(api: AthomApi, appData: AppData, maxAgeMs: number): Promise<AppDetails> {
    const cached = this.cache.get(appData.id);
    if (cached && Date.now() - cached.fetchedAt < maxAgeMs) return cached;
    return this.fetch(api, appData);
  }
}

export default AppDetailsCache;

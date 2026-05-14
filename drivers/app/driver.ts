"use strict";
import {Device, Driver, FlowCardTrigger, FlowCardTriggerDevice, FlowToken} from "homey";
import {Device as DeviceType} from "./types";
import AthomApi, {
  AppData,
  BuildSummary,
  CrashReport,
  LocalizedData,
  StatPoint,
  Suggestion,
} from "../../lib/AthomApi";

interface AppExtras {
  suggestions?: Suggestion[];
  builds?: BuildSummary[];
  installStats?: StatPoint[];
  driverStats?: Record<string, StatPoint[]>;
  crashes?: CrashReport[];
  crashBuildId?: number;
  crashBuildVersion?: string;
  changelog?: string;
}

class AppDriver extends Driver {
  private api?: AthomApi;
  private interval?: NodeJS.Timeout;
  private appInstallsChangedTrigger?: FlowCardTriggerDevice;
  private appInstallsCloudChangedTrigger?: FlowCardTriggerDevice;
  private appInstallsLocalChangedTrigger?: FlowCardTriggerDevice;
  private appLiveBuildCrashesChangedTrigger?: FlowCardTriggerDevice;
  private appLiveVersionChangedTrigger?: FlowCardTriggerDevice;
  private appTestBuildCrashesChangedTrigger?: FlowCardTriggerDevice;
  private appTestBuildStateChangedTrigger?: FlowCardTriggerDevice;
  private appTestVersionChangedTrigger?: FlowCardTriggerDevice;
  private appReviewFailedTrigger?: FlowCardTriggerDevice;
  private appRatingChangedTrigger?: FlowCardTriggerDevice;
  private appEnteredReviewTrigger?: FlowCardTriggerDevice;
  private appReviewApprovedTrigger?: FlowCardTriggerDevice;
  private appDeletedTrigger?: FlowCardTriggerDevice;
  private appSuggestionReceivedTrigger?: FlowCardTriggerDevice;
  private appCrashReportReceivedTrigger?: FlowCardTriggerDevice;
  private appBuildCreatedTrigger?: FlowCardTriggerDevice;
  private appDeviceCountChangedTrigger?: FlowCardTriggerDevice;
  private appTotalCrashesChangedTrigger?: FlowCardTriggerDevice;
  private appInstallsDecliningTrigger?: FlowCardTriggerDevice;

  private installsChangedTrigger?: FlowCardTrigger;
  private installsCloudChangedTrigger?: FlowCardTrigger;
  private installsLocalChangedTrigger?: FlowCardTrigger;
  private liveVersionChangedTrigger?: FlowCardTrigger;
  private testVersionChangedTrigger?: FlowCardTrigger;
  private reviewFailedTrigger?: FlowCardTrigger;
  private totalInstallsChangedTrigger?: FlowCardTrigger;
  private totalInstallsCloudChangedTrigger?: FlowCardTrigger;
  private totalInstallsLocalChangedTrigger?: FlowCardTrigger;
  private suggestionReceivedTrigger?: FlowCardTrigger;
  private crashReportReceivedTrigger?: FlowCardTrigger;
  private installsDecliningTrigger?: FlowCardTrigger;

  private totalInstallsToken?: FlowToken;
  private totalCloudInstallsToken?: FlowToken;
  private totalLocalInstallsToken?: FlowToken;

  async onInit() {
    this.log('Initializing App Insights driver');

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeSettings();
      this.initializeApi();
      await this.registerGlobalTokens();
      await this.registerFlowCards();
      this.registerSettingsListeners();

      this.startPolling();

      this.log('App Insights driver has been initialized')
    } catch (error) {
      this.log((error as Error).message)

      this.homey.setTimeout(() => this.initialize(), 10 * 1000);
    }
  }

  private registerSettingsListeners(): void {
    this.homey.settings.on('set', (key: string) => {
      if (key === 'personal_access_token') {
        try {
          this.initializeApi();
          this.updateDevices();
        } catch (e) {
          this.error(e);
        }
      }
      if (key === 'polling_frequency') {
        this.startPolling();
      }
    });
  }

  private initializeApi(): void {
    const pat = this.homey.settings.get('personal_access_token');

    if (typeof pat !== 'string' || pat === '') {
      throw new Error('Personal access token has not yet been configured, trying again in 10 seconds');
    }

    if (this.api) {
      this.api.setPersonalAccessToken(pat);
    } else {
      this.api = new AthomApi(pat);
    }
  }

  private async initializeSettings() {
    if (!this.homey.settings.get('total_installs')) {
      this.homey.settings.set('total_installs', 0);
    }
    if (!this.homey.settings.get('total_cloud_installs')) {
      this.homey.settings.set('total_cloud_installs', 0);
    }
    if (!this.homey.settings.get('total_local_installs')) {
      this.homey.settings.set('total_local_installs', 0);
    }
    if (!this.homey.settings.get('apps')) {
      this.homey.settings.set('apps', []);
    }
    if (!this.homey.settings.get('personal_access_token')) {
      this.homey.settings.set('personal_access_token', '');
    }
    if (!this.homey.settings.get('polling_frequency')) {
      this.homey.settings.set('polling_frequency', 15);
    }
  }

  private async registerGlobalTokens() {
    this.totalInstallsToken = await this.homey.flow.createToken("total_installs", {
      type: "number",
      title: this.homey.__('global_tokens.total_installs'),
      value: this.homey.settings.get('total_installs')
    });
    this.totalCloudInstallsToken = await this.homey.flow.createToken("total_cloud_installs", {
      type: "number",
      title: this.homey.__('global_tokens.total_cloud_installs'),
      value: this.homey.settings.get('total_cloud_installs')
    });
    this.totalLocalInstallsToken = await this.homey.flow.createToken("total_local_installs", {
      type: "number",
      title: this.homey.__('global_tokens.total_local_installs'),
      value: this.homey.settings.get('total_local_installs')
    });
  }

  private async registerFlowCards() {
    // Triggers by app device
    this.appInstallsChangedTrigger = this.homey.flow.getDeviceTriggerCard('app_installs_changed')
    this.appInstallsCloudChangedTrigger = this.homey.flow.getDeviceTriggerCard('app_installs_cloud_changed')
    this.appInstallsLocalChangedTrigger = this.homey.flow.getDeviceTriggerCard('app_installs_local_changed')
    this.appLiveBuildCrashesChangedTrigger = this.homey.flow.getDeviceTriggerCard('app_live_build_crashes_changed')
    this.appLiveVersionChangedTrigger = this.homey.flow.getDeviceTriggerCard('app_live_version_changed')
    this.appTestBuildCrashesChangedTrigger = this.homey.flow.getDeviceTriggerCard('app_test_build_crashes_changed')
    this.appTestBuildStateChangedTrigger = this.homey.flow.getDeviceTriggerCard('app_test_build_state_changed')
    this.appTestVersionChangedTrigger = this.homey.flow.getDeviceTriggerCard('app_test_version_changed')
    this.appReviewFailedTrigger = this.homey.flow.getDeviceTriggerCard('app_review_failed')
    this.appRatingChangedTrigger = this.homey.flow.getDeviceTriggerCard('app_rating_changed')
    this.appEnteredReviewTrigger = this.homey.flow.getDeviceTriggerCard('app_entered_review')
    this.appReviewApprovedTrigger = this.homey.flow.getDeviceTriggerCard('app_review_approved')
    this.appDeletedTrigger = this.homey.flow.getDeviceTriggerCard('app_deleted')
    this.appSuggestionReceivedTrigger = this.homey.flow.getDeviceTriggerCard('app_suggestion_received')
    this.appCrashReportReceivedTrigger = this.homey.flow.getDeviceTriggerCard('app_crash_report_received')
    this.appBuildCreatedTrigger = this.homey.flow.getDeviceTriggerCard('app_build_created')
    this.appDeviceCountChangedTrigger = this.homey.flow.getDeviceTriggerCard('app_device_count_changed')
    this.appTotalCrashesChangedTrigger = this.homey.flow.getDeviceTriggerCard('app_total_crashes_changed')
    this.appInstallsDecliningTrigger = this.homey.flow.getDeviceTriggerCard('app_installs_declining')
    // Installs per app with app as token
    this.installsChangedTrigger = this.homey.flow.getTriggerCard('installs_changed')
    this.installsCloudChangedTrigger = this.homey.flow.getTriggerCard('installs_cloud_changed')
    this.installsLocalChangedTrigger = this.homey.flow.getTriggerCard('installs_local_changed')
    this.liveVersionChangedTrigger = this.homey.flow.getTriggerCard('live_version_changed')
    this.testVersionChangedTrigger = this.homey.flow.getTriggerCard('test_version_changed')
    this.reviewFailedTrigger = this.homey.flow.getTriggerCard('review_failed')
    this.suggestionReceivedTrigger = this.homey.flow.getTriggerCard('suggestion_received')
    this.crashReportReceivedTrigger = this.homey.flow.getTriggerCard('crash_report_received')
    this.installsDecliningTrigger = this.homey.flow.getTriggerCard('installs_declining')
    // Total installs across all apps triggers
    this.totalInstallsChangedTrigger = this.homey.flow.getTriggerCard('total_installs_changed')
    this.totalInstallsCloudChangedTrigger = this.homey.flow.getTriggerCard('total_installs_cloud_changed')
    this.totalInstallsLocalChangedTrigger = this.homey.flow.getTriggerCard('total_installs_local_changed')

    this.registerConditions();
  }

  private registerConditions(): void {
    this.homey.flow.getConditionCard('app_is_live')
        .registerRunListener(async (args: { device: Device }) => {
          const version = args.device.getCapabilityValue('live_version');
          return typeof version === 'string' && version !== '' && version !== 'none';
        });

    this.homey.flow.getConditionCard('app_is_in_review')
        .registerRunListener(async (args: { device: Device }) =>
            args.device.getCapabilityValue('test_build_state') === 'in_review');

    this.homey.flow.getConditionCard('app_has_crashes')
        .registerRunListener(async (args: { device: Device, crashes: number }) =>
            (args.device.getCapabilityValue('live_build_crashes') ?? 0) > args.crashes);

    this.homey.flow.getConditionCard('app_installs_above')
        .registerRunListener(async (args: { device: Device, installs: number }) =>
            (args.device.getCapabilityValue('installs') ?? 0) > args.installs);

    this.homey.flow.getConditionCard('app_rating_above')
        .registerRunListener(async (args: { device: Device, rating: number }) => {
          const rating = args.device.getCapabilityValue('rating');
          return typeof rating === 'number' && rating > args.rating;
        });

    this.homey.flow.getConditionCard('live_build_older_than')
        .registerRunListener(async (args: { device: Device, days: number }) => {
          const age = args.device.getCapabilityValue('live_build_age_days');
          return typeof age === 'number' && age > args.days;
        });

    this.homey.flow.getConditionCard('app_has_suggestions')
        .registerRunListener(async (args: { device: Device }) =>
            (args.device.getCapabilityValue('suggestions_count') ?? 0) > 0);

    this.homey.flow.getConditionCard('app_device_count_above')
        .registerRunListener(async (args: { device: Device, devices: number }) =>
            (args.device.getCapabilityValue('device_count') ?? 0) > args.devices);

    this.homey.flow.getConditionCard('app_total_crashes_above')
        .registerRunListener(async (args: { device: Device, crashes: number }) =>
            (args.device.getCapabilityValue('total_crashes') ?? 0) > args.crashes);
  }

  private startPolling() {
    if (this.interval) {
      this.homey.clearInterval(this.interval);
    }

    const raw = this.homey.settings.get('polling_frequency');
    const pollingFrequency = Math.max(1, parseInt(String(raw), 10) || 15);

    this.updateDevices();

    this.interval = this.homey.setInterval(
        this.updateDevices.bind(this),
        pollingFrequency * 60 * 1000
    );
  }

  private async updateDevices(tries: number = 3): Promise<void> {
    if (tries <= 0) {
      return;
    }

    try {
      this.log('Updating app devices')

      const apps = await this.getApi().getApps();
      await this.processApps(apps);
    } catch (error) {
      this.error(error);
      await new Promise((resolve) => this.homey.setTimeout(resolve, 10000));
      await this.updateDevices(tries - 1);
    }
  }

  private async processApps(apps: AppData[]): Promise<void> {
    const extrasMap = new Map<string, AppExtras>();

    await Promise.all(apps.map(async (appData) => {
      const extras = await this.processAppData(appData);
      if (extras) {
        extrasMap.set(appData.id, extras);
      }
    }));

    this.runGlobalTriggers(apps);
    this.runGlobalTriggersWithApps(apps, extrasMap);
  }

  private async processAppData(appData: AppData): Promise<AppExtras | undefined> {
    const device = this.getDevices().find(device => device.getData().id === appData.id);

    if (!device) {
      return undefined;
    }

    const extras = await this.fetchAppExtras(appData);

    try {
      await this.updateDeviceWithAppData(device, appData, extras.changelog);
    } catch (e) {
      this.error(e);
    }

    try {
      await this.updateDeviceExtras(device, appData, extras);
    } catch (e) {
      this.error(e);
    }

    return extras;
  }

  private async fetchAppExtras(appData: AppData): Promise<AppExtras> {
    const api = this.getApi();
    const appId = appData.id;
    const crashBuild = appData.liveBuild ?? appData.testBuild;
    const crashBuildVersion = appData.liveBuild ? appData.liveVersion : appData.testVersion;
    const liveBuildId = appData.liveBuild?.id;

    const [suggestions, builds, installStats, driverStats, crashes, liveBuild] = await Promise.allSettled([
      api.getSuggestions(appId),
      api.getBuilds(appId),
      api.getInstallStats(appId),
      api.getDriverStats(appId),
      crashBuild ? api.getBuildCrashes(appId, crashBuild.id) : Promise.resolve([]),
      liveBuildId !== undefined ? api.getBuild(appId, liveBuildId) : Promise.resolve(undefined),
    ]);

    const extras: AppExtras = {};

    if (suggestions.status === 'fulfilled') {
      extras.suggestions = suggestions.value;
    } else {
      this.error('Failed to fetch suggestions', suggestions.reason);
    }

    if (builds.status === 'fulfilled') {
      extras.builds = builds.value;
    } else {
      this.error('Failed to fetch builds', builds.reason);
    }

    if (installStats.status === 'fulfilled') {
      extras.installStats = installStats.value;
    } else {
      this.error('Failed to fetch install stats', installStats.reason);
    }

    if (driverStats.status === 'fulfilled') {
      extras.driverStats = driverStats.value;
    } else {
      this.error('Failed to fetch driver stats', driverStats.reason);
    }

    if (crashes.status === 'fulfilled') {
      extras.crashes = crashes.value;
      extras.crashBuildId = crashBuild?.id;
      extras.crashBuildVersion = crashBuildVersion ?? undefined;
    } else {
      this.error('Failed to fetch crash reports', crashes.reason);
    }

    if (liveBuild.status === 'fulfilled') {
      extras.changelog = this.localized(liveBuild.value?.changelog);
    } else {
      this.error('Failed to fetch live build detail', liveBuild.reason);
    }

    return extras;
  }

  private localized(data: LocalizedData | undefined): string {
    if (!data) {
      return '';
    }
    const language = this.homey.i18n.getLanguage();
    return (data as Record<string, string | undefined>)[language] ?? data.en ?? '';
  }

  private runGlobalTriggers(apps: AppData[]): void {
    // Total installs across all apps
    const totalInstalls = apps.reduce((count: number, appData: AppData): number => {
      return count + (appData.installs ?? 0)
    }, 0);
    const currentTotalInstalls = this.homey.settings.get('total_installs');

    this.totalInstallsToken?.setValue(totalInstalls)
    this.homey.settings.set('total_installs', totalInstalls)

    if (currentTotalInstalls !== totalInstalls) {
      this.totalInstallsChangedTrigger?.trigger({
        installs: totalInstalls,
        installs_delta: totalInstalls - currentTotalInstalls,
      })
    }

    // Total cloud installs across all apps
    const totalCloudInstalls = apps.reduce((count: number, appData: AppData): number => {
      return count + (appData.installsCloud ?? 0)
    }, 0);
    const currentTotalCloudInstalls = this.homey.settings.get('total_cloud_installs');

    this.totalCloudInstallsToken?.setValue(totalCloudInstalls)
    this.homey.settings.set('total_cloud_installs', totalCloudInstalls);

    if (currentTotalCloudInstalls !== totalCloudInstalls) {
      this.totalInstallsCloudChangedTrigger?.trigger({
        installs: totalCloudInstalls,
        installs_delta: totalCloudInstalls - currentTotalCloudInstalls,
      })
    }

    // Total local installs across all apps
    const totalLocalInstalls = apps.reduce((count: number, appData: AppData): number => {
      return count + (appData.installsLocal ?? 0)
    }, 0);
    const currentTotalLocalInstalls = this.homey.settings.get('total_local_installs');

    this.totalLocalInstallsToken?.setValue(totalLocalInstalls)
    this.homey.settings.set('total_local_installs', totalLocalInstalls);

    if (currentTotalLocalInstalls !== totalLocalInstalls) {
      this.totalInstallsLocalChangedTrigger?.trigger({
        installs: totalLocalInstalls,
        installs_delta: totalLocalInstalls - currentTotalLocalInstalls,
      })
    }
  }

  private runGlobalTriggersWithApps(apps: AppData[], extrasMap: Map<string, AppExtras>): void {
    // Get the cached apps value from settings store
    const cachedApps = this.homey.settings.get('apps') as AppData[];

    // For each app check if the data is different from the cached values
    apps.forEach((appData: AppData) => {
      const appName = appData.liveBuild?.name?.en ?? appData.testBuild?.name?.en ?? 'Unknown';
      const cachedAppData = cachedApps.find((cachedAppData: AppData) => cachedAppData.id === appData.id) as AppData | undefined

      // Compare cache data to latest data and trigger on changes
      if (cachedAppData) {
        if (cachedAppData.installs !== appData.installs) {
          this.installsChangedTrigger?.trigger({
            app: appName,
            installs: appData.installs ?? 0,
            installs_delta: (appData.installs ?? 0) - (cachedAppData.installs ?? 0),
          })
        }
        if (cachedAppData.installsCloud !== appData.installsCloud) {
          this.installsCloudChangedTrigger?.trigger({
            app: appName,
            installs: appData.installsCloud ?? 0,
            installs_delta: (appData.installsCloud ?? 0) - (cachedAppData.installsCloud ?? 0),
          })
        }
        if (cachedAppData.installsLocal !== appData.installsLocal) {
          this.installsLocalChangedTrigger?.trigger({
            app: appName,
            installs: appData.installsLocal ?? 0,
            installs_delta: (appData.installsLocal ?? 0) - (cachedAppData.installsLocal ?? 0),
          })
        }
        if (cachedAppData.liveVersion !== appData.liveVersion) {
          this.liveVersionChangedTrigger?.trigger({
            app: appName,
            version: appData.liveVersion ?? 'none',
            changelog: extrasMap.get(appData.id)?.changelog ?? '',
          })
        }
        if (cachedAppData.testVersion !== appData.testVersion) {
          this.testVersionChangedTrigger?.trigger({
            app: appName,
            version: appData.testVersion ?? 'none'
          })
        }
        if (cachedAppData.testBuild?.state !== appData.testBuild?.state && appData.testBuild?.state === 'reviewed_rejected') {
          this.reviewFailedTrigger?.trigger({
            app: appName,
            version: appData.testVersion ?? 'none'
          })
        }
        if (cachedAppData.deleted !== true && appData.deleted === true) {
          const device = this.getDevices().find(d => d.getData().id === appData.id);
          if (device) {
            this.appDeletedTrigger?.trigger(device);
          }
        }
      }
    });

    // Update the settings value with the latest values
    this.homey.settings.set('apps', apps);
  }

  private isApiConfigured(): boolean {
    return this.api !== undefined;
  }

  private getApi(): AthomApi {
    return <AthomApi>this.api;
  }

  async onPair(session: any) {
    session.setHandler('showView', async (view: string) => {
      this.log('Pairing - Show view', view)

      if (view === "loading") {
        if (this.isApiConfigured()) {
          await session.showView('list_devices');
        } else {
          await session.showView('not_configured');
        }
      }
    });

    session.setHandler("list_devices", async (): Promise<DeviceType[]> => {
      if (!this.isApiConfigured()) {
        return [];
      } else {
        return await this.getApi().getApps()
            .then((apps: AppData[]) => {
              return apps.map((appData: AppData): DeviceType => {
                return {
                  name: appData.liveBuild?.name?.en ?? appData.testBuild?.name?.en ?? 'App name',
                  data: {
                    id: appData.id,
                  },
                  storage: {
                    id: appData.id,
                  },
                }
              })
            });
      }
    });
  }

  private static daysSince(iso: string | undefined): number {
    if (!iso) return 0;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return 0;
    return Math.max(0, Math.floor((Date.now() - then) / 86400000));
  }

  private static sumLatestStats(stats: Record<string, StatPoint[]>): number {
    let total = 0;
    for (const series of Object.values(stats)) {
      for (let i = series.length - 1; i >= 0; i--) {
        if (typeof series[i].value === 'number') {
          total += series[i].value as number;
          break;
        }
      }
    }
    return total;
  }

  private static computeTrend(stats: StatPoint[]): number | null {
    const values = stats
        .filter((point) => typeof point.value === 'number')
        .map((point) => point.value as number);
    if (values.length < 2) return null;
    return values[values.length - 1] - values[values.length - 2];
  }

  private static firstLine(stack: string): string {
    if (!stack) return 'Unknown error';
    const line = stack.split('\n').map((l) => l.trim()).find((l) => l.length > 0);
    return line ?? 'Unknown error';
  }

  private async updateDeviceExtras(device: Device, appData: AppData, extras: AppExtras): Promise<void> {
    const appName = appData.liveBuild?.name?.en ?? appData.testBuild?.name?.en ?? 'Unknown';

    // Suggestions
    if (extras.suggestions) {
      const suggestions = extras.suggestions;

      if (device.hasCapability('suggestions_count')) {
        await device.setCapabilityValue('suggestions_count', suggestions.length);
      }

      const seen = device.getStoreValue('seen_suggestion_ids');
      const currentIds = suggestions.map((suggestion) => suggestion.id);

      if (!Array.isArray(seen)) {
        await device.setStoreValue('seen_suggestion_ids', currentIds);
      } else {
        const seenSet = new Set<string>(seen);
        for (const suggestion of suggestions) {
          if (!seenSet.has(suggestion.id)) {
            this.appSuggestionReceivedTrigger?.trigger(device, {
              suggestion_text: suggestion.suggestionText,
              suggestion_id: suggestion.id,
              suggestions_count: suggestions.length,
            }).catch((e) => this.error(e));
            this.suggestionReceivedTrigger?.trigger({
              app: appName,
              suggestion_text: suggestion.suggestionText,
              suggestion_id: suggestion.id,
            }).catch((e) => this.error(e));
          }
        }
        await device.setStoreValue('seen_suggestion_ids', currentIds);
      }
    }

    // Builds: build_count, total_crashes, new build detection
    if (extras.builds) {
      const builds = extras.builds;

      if (device.hasCapability('build_count')) {
        await device.setCapabilityValue('build_count', builds.length);
      }

      if (device.hasCapability('total_crashes')) {
        const totalCrashes = builds.reduce((sum, build) => sum + (build.crashes ?? 0), 0);
        const oldTotalCrashes = device.getCapabilityValue('total_crashes');

        if (typeof oldTotalCrashes === 'number' && oldTotalCrashes !== totalCrashes) {
          this.appTotalCrashesChangedTrigger?.trigger(device, {
            crashes: totalCrashes,
            crashes_delta: totalCrashes - oldTotalCrashes,
          }).catch((e) => this.error(e));
        }

        await device.setCapabilityValue('total_crashes', totalCrashes);
      }

      const maxSeenBuildId = device.getStoreValue('max_build_id');
      const maxBuildId = builds.reduce((max, build) => Math.max(max, build.id), 0);

      if (typeof maxSeenBuildId !== 'number') {
        await device.setStoreValue('max_build_id', maxBuildId);
      } else {
        for (const build of builds) {
          if (build.id > maxSeenBuildId) {
            this.appBuildCreatedTrigger?.trigger(device, {
              version: build.version,
              build_id: build.id,
              state: build.state,
            }).catch((e) => this.error(e));
          }
        }
        if (maxBuildId > maxSeenBuildId) {
          await device.setStoreValue('max_build_id', maxBuildId);
        }
      }
    }

    // Driver stats: device_count
    if (extras.driverStats && device.hasCapability('device_count')) {
      const deviceCount = AppDriver.sumLatestStats(extras.driverStats);
      const oldDeviceCount = device.getCapabilityValue('device_count');

      if (typeof oldDeviceCount === 'number' && oldDeviceCount !== deviceCount) {
        this.appDeviceCountChangedTrigger?.trigger(device, {
          devices: deviceCount,
          devices_delta: deviceCount - oldDeviceCount,
        }).catch((e) => this.error(e));
      }

      await device.setCapabilityValue('device_count', deviceCount);
    }

    // Install stats: installs_trend_7d
    if (extras.installStats && device.hasCapability('installs_trend_7d')) {
      const trend = AppDriver.computeTrend(extras.installStats);

      if (trend !== null) {
        const oldTrend = device.getCapabilityValue('installs_trend_7d');
        await device.setCapabilityValue('installs_trend_7d', trend);

        if (trend < 0 && (typeof oldTrend !== 'number' || oldTrend >= 0)) {
          this.appInstallsDecliningTrigger?.trigger(device, {
            installs: appData.installs ?? 0,
            trend: trend,
          }).catch((e) => this.error(e));
          this.installsDecliningTrigger?.trigger({
            app: appName,
            installs: appData.installs ?? 0,
            trend: trend,
          }).catch((e) => this.error(e));
        }
      }
    }

    // Crash reports
    if (extras.crashes && extras.crashBuildId !== undefined) {
      const crashes = extras.crashes;
      const lastSeenAt = device.getStoreValue('last_crash_seen_at');
      const timestamps = crashes.map((crash) => crash.createdAt).filter((value): value is string => !!value);
      const maxAt = timestamps.reduce((max, value) => (value > max ? value : max), '');

      if (typeof lastSeenAt !== 'string') {
        if (maxAt) {
          await device.setStoreValue('last_crash_seen_at', maxAt);
        }
      } else {
        for (const crash of crashes) {
          if (crash.createdAt && crash.createdAt > lastSeenAt) {
            const errorMessage = AppDriver.firstLine(crash.stack);
            this.appCrashReportReceivedTrigger?.trigger(device, {
              error_message: errorMessage,
              homey_version: crash.homeyVersion ?? 'unknown',
              build_version: extras.crashBuildVersion ?? 'unknown',
              build_id: extras.crashBuildId,
            }).catch((e) => this.error(e));
            this.crashReportReceivedTrigger?.trigger({
              app: appName,
              error_message: errorMessage,
              homey_version: crash.homeyVersion ?? 'unknown',
              build_version: extras.crashBuildVersion ?? 'unknown',
            }).catch((e) => this.error(e));
          }
        }
        if (maxAt && maxAt > lastSeenAt) {
          await device.setStoreValue('last_crash_seen_at', maxAt);
        }
      }
    }
  }

  private async updateDeviceWithAppData(device: Device, appData: AppData, changelog?: string): Promise<void> {
    const installs = device.getCapabilityValue('installs') ?? 0;

    if (installs !== appData.installs) {
      this.appInstallsChangedTrigger?.trigger(device, {
        installs: appData.installs ?? 0,
        installs_delta: appData.installs - installs,
      })
    }

    await device.setCapabilityValue('installs', appData.installs);

    const installsCloud = device.getCapabilityValue('installs_cloud') ?? 0;

    if (installsCloud !== appData.installsCloud) {
      this.appInstallsCloudChangedTrigger?.trigger(device, {
        installs: appData.installsCloud ?? 0,
        installs_delta: (appData.installsCloud ?? 0) - installsCloud,
      })
    }

    await device.setCapabilityValue('installs_cloud', appData.installsCloud ?? 0);

    const installsLocal = device.getCapabilityValue('installs_local') ?? 0;

    if (installsLocal !== appData.installsLocal) {
      this.appInstallsLocalChangedTrigger?.trigger(device, {
        installs: appData.installsLocal ?? 0,
        installs_delta: (appData.installsLocal ?? 0) - installsLocal,
      })
    }

    await device.setCapabilityValue('installs_local', appData.installsLocal ?? 0);

    const liveBuildCrashes = device.getCapabilityValue('live_build_crashes') ?? 0;

    if (liveBuildCrashes !== appData.liveBuild?.crashes) {
      this.appLiveBuildCrashesChangedTrigger?.trigger(device, {
        crashes: appData.liveBuild?.crashes ?? 0,
        crashes_delta: (appData.liveBuild?.crashes ?? 0) - liveBuildCrashes,
      })
    }

    await device.setCapabilityValue('live_build_crashes', appData.liveBuild?.crashes ?? 0);

    await device.setCapabilityValue('live_build_installs', appData.liveBuild?.installs ?? 0);

    if (device.hasCapability('live_build_age_days')) {
      const newLiveAge = AppDriver.daysSince(appData.liveBuildUpdatedAt);
      await device.setCapabilityValue('live_build_age_days', newLiveAge);
    }

    const liveVersion = device.getCapabilityValue('live_version') ?? 'none';

    if (liveVersion !== appData.liveVersion) {
      this.appLiveVersionChangedTrigger?.trigger(device, {
        version: appData.liveVersion ?? 'none',
        changelog: changelog ?? '',
      })
    }

    await device.setCapabilityValue('live_version', appData.liveVersion ?? 'none');

    const testBuildCrashes = device.getCapabilityValue('test_build_crashes') ?? 0;

    if (testBuildCrashes !== appData.testBuild?.crashes) {
      this.appTestBuildCrashesChangedTrigger?.trigger(device, {
        crashes: appData.testBuild?.crashes ?? 0,
        crashes_delta: (appData.testBuild?.crashes ?? 0) - testBuildCrashes,
      })
    }

    await device.setCapabilityValue('test_build_crashes', appData.testBuild?.crashes ?? 0);

    await device.setCapabilityValue('test_build_installs', appData.testBuild?.installs ?? 0);

    const testBuildState = device.getCapabilityValue('test_build_state') ?? 'none';
    const newTestBuildState = appData.testBuild?.state ?? 'none';

    if (testBuildState !== newTestBuildState) {
      this.appTestBuildStateChangedTrigger?.trigger(device, {
        state: newTestBuildState
      })

      if (newTestBuildState === 'reviewed_rejected') {
        this.appReviewFailedTrigger?.trigger(device, {
          version: appData.testVersion ?? 'none'
        })
      }

      if (newTestBuildState === 'in_review') {
        this.appEnteredReviewTrigger?.trigger(device, {
          version: appData.testVersion ?? 'none'
        })
      }

      if (testBuildState === 'in_review' &&
          (newTestBuildState === 'test' || newTestBuildState === 'live' || newTestBuildState === 'reviewed_approved')) {
        this.appReviewApprovedTrigger?.trigger(device, {
          version: appData.testVersion ?? 'none'
        })
      }
    }

    await device.setCapabilityValue('test_build_state', newTestBuildState);

    if (device.hasCapability('rating')) {
      const currentRating = device.getCapabilityValue('rating');
      const newRating = typeof appData.rating === 'number' ? appData.rating : null;

      if (newRating !== null && currentRating !== newRating) {
        this.appRatingChangedTrigger?.trigger(device, {
          rating: newRating,
          rating_delta: newRating - (typeof currentRating === 'number' ? currentRating : newRating),
        })
      }

      await device.setCapabilityValue('rating', newRating);
    }

    const testVersion = device.getCapabilityValue('test_version') ?? 'none';

    if (testVersion !== appData.testVersion) {
      this.appTestVersionChangedTrigger?.trigger(device, {
        version: appData.testVersion ?? 'none'
      })
    }

    await device.setCapabilityValue('test_version', appData.testVersion ?? 'none');
  }
}

module.exports = AppDriver;

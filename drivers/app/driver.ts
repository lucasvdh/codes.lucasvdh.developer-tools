"use strict";
import {Device, Driver, env, FlowCardTrigger, FlowCardTriggerDevice, FlowToken} from "homey";
import {Device as DeviceType} from "./types";
import AthomApi, {AppData} from "../../lib/AthomApi";


class AppDriver extends Driver {
  private api?: AthomApi;
  private interval?: NodeJS.Timeout;
  private appInstallsChangedTrigger?: FlowCardTriggerDevice;
  private appInstallsCloudChangedTrigger?: FlowCardTriggerDevice;
  private appInstallsLocalChangedTrigger?: FlowCardTriggerDevice;
  private appLiveBuildCrashesChangedTrigger?: FlowCardTriggerDevice;
  private appLiveBuildStateChangedTrigger?: FlowCardTriggerDevice;
  private appLiveVersionChangedTrigger?: FlowCardTriggerDevice;
  private appTestBuildCrashesChangedTrigger?: FlowCardTriggerDevice;
  private appTestBuildStateChangedTrigger?: FlowCardTriggerDevice;
  private appTestVersionChangedTrigger?: FlowCardTriggerDevice;
  private appReviewFailedTrigger?: FlowCardTriggerDevice;

  private installsChangedTrigger?: FlowCardTrigger;
  private installsCloudChangedTrigger?: FlowCardTrigger;
  private installsLocalChangedTrigger?: FlowCardTrigger;
  private liveVersionChangedTrigger?: FlowCardTrigger;
  private testVersionChangedTrigger?: FlowCardTrigger;
  private reviewFailedTrigger?: FlowCardTrigger;
  private totalInstallsChangedTrigger?: FlowCardTrigger;
  private totalInstallsCloudChangedTrigger?: FlowCardTrigger;
  private totalInstallsLocalChangedTrigger?: FlowCardTrigger;

  private totalInstallsToken?: FlowToken;
  private totalCloudInstallsToken?: FlowToken;
  private totalLocalInstallsToken?: FlowToken;

  async onInit() {
    this.log('Initializing Developer Tools App driver');

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.initializeSettings();
      this.initializeApi();
      await this.registerGlobalTokens();
      await this.registerFlowCards();

      this.setInterval();

      this.log('Developer Tools App Driver has been initialized')
    } catch (error) {
      this.log((error as Error).message)

      await new Promise((resolve) => {
        setTimeout(resolve, 10 * 1000);
      });

      this.initialize();
    }
  }

  private initializeApi(): void {
    const refreshToken = this.homey.settings.get('refresh_token');

    if (refreshToken === undefined || refreshToken === null || refreshToken === '') {
      throw new Error('Refresh token has not yet been configured, trying again in 10 seconds');
    }

    this.api = new AthomApi(refreshToken, this.getClientCredentials());

    this.api.on('refresh_token_updated', (newRefreshToken: string) => {
      this.homey.settings.set('refresh_token', newRefreshToken);
    })
  }

  private getClientCredentials(): { clientId: string, clientSecret: string } {
    return {
      clientId: env.CLIENT_ID as string,
      clientSecret: env.CLIENT_SECRET as string
    };
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
    if (!this.homey.settings.get('refresh_token')) {
      this.homey.settings.set('refresh_token', '');
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
    this.appLiveBuildStateChangedTrigger = this.homey.flow.getDeviceTriggerCard('app_live_build_state_changed')
    this.appLiveVersionChangedTrigger = this.homey.flow.getDeviceTriggerCard('app_live_version_changed')
    this.appTestBuildCrashesChangedTrigger = this.homey.flow.getDeviceTriggerCard('app_test_build_crashes_changed')
    this.appTestBuildStateChangedTrigger = this.homey.flow.getDeviceTriggerCard('app_test_build_state_changed')
    this.appTestVersionChangedTrigger = this.homey.flow.getDeviceTriggerCard('app_test_version_changed')
    this.appReviewFailedTrigger = this.homey.flow.getDeviceTriggerCard('app_review_failed')
    // Installs per app with app as token
    this.installsChangedTrigger = this.homey.flow.getTriggerCard('installs_changed')
    this.installsCloudChangedTrigger = this.homey.flow.getTriggerCard('installs_cloud_changed')
    this.installsLocalChangedTrigger = this.homey.flow.getTriggerCard('installs_local_changed')
    this.liveVersionChangedTrigger = this.homey.flow.getTriggerCard('live_version_changed')
    this.testVersionChangedTrigger = this.homey.flow.getTriggerCard('test_version_changed')
    this.reviewFailedTrigger = this.homey.flow.getTriggerCard('review_failed')
    // Total installs across all apps triggers
    this.totalInstallsChangedTrigger = this.homey.flow.getTriggerCard('total_installs_changed')
    this.totalInstallsCloudChangedTrigger = this.homey.flow.getTriggerCard('total_installs_cloud_changed')
    this.totalInstallsLocalChangedTrigger = this.homey.flow.getTriggerCard('total_installs_local_changed')
  }

  private setInterval() {
    const pollingFrequency = this.homey.settings.get('polling_frequency') as number

    this.interval = this.homey.setInterval(
        this.updateDevices.bind(this),
        pollingFrequency * 60 * 1000
    );
  }

  private async updateDevices(tries: number = 3): Promise<void> {
    if (tries <= 0) {
      return;
    }

    tries--;

    try {
      this.log('Updating app devices')

      this.getApi()
          .getApps()
          .then((apps: AppData[]): void => {
            this.processApps(apps);
          });
    } catch (error) {
      this.error(error);
      await new Promise((resolve) => setTimeout(resolve, 10000));
      await this.updateDevices(tries);
    }
  }

  private processApps(apps: AppData[]): void {
    apps.forEach(async (appData: AppData): Promise<void> => {
      await this.processAppData(appData);
    })

    this.runGlobalTriggers(apps);
    this.runGlobalTriggersWithApps(apps);
  }

  private async processAppData(appData: AppData): Promise<void> {
    const device = this.getDevices().find(device => device.getData().id === appData.id);

    if (device) {
      try {
        await this.updateDeviceWithAppData(device, appData);
      } catch (e) {
        this.error(e);
      }
    }
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
        installs: totalInstalls,
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
        installs: totalInstalls,
        installs_delta: totalLocalInstalls - currentTotalLocalInstalls,
      })
    }
  }

  private runGlobalTriggersWithApps(apps: AppData[]): void {
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
            installs_delta: (appData.installs ?? 0) - cachedAppData.installs,
          })
        }
        if (cachedAppData.installsCloud !== appData.installsCloud) {
          this.installsCloudChangedTrigger?.trigger({
            app: appName,
            installs: appData.installsCloud ?? 0,
            installs_delta: (appData.installsCloud ?? 0) - cachedAppData.installsCloud,
          })
        }
        if (cachedAppData.installsLocal !== appData.installsLocal) {
          this.installsLocalChangedTrigger?.trigger({
            app: appName,
            installs: appData.installsLocal ?? 0,
            installs_delta: (appData.installsLocal ?? 0) - cachedAppData.installsLocal,
          })
        }
        if (cachedAppData.liveVersion !== appData.liveVersion) {
          this.liveVersionChangedTrigger?.trigger({
            app: appName,
            version: appData.liveVersion
          })
        }
        if (cachedAppData.testVersion !== appData.testVersion) {
          this.testVersionChangedTrigger?.trigger({
            app: appName,
            version: appData.testVersion
          })
        }
        if (cachedAppData.testBuild?.state !== appData.testBuild?.state && appData.testBuild?.state === 'reviewed_rejected') {
          this.reviewFailedTrigger?.trigger({
            app: appName,
            version: appData.testVersion
          })
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

  private async updateDeviceWithAppData(device: Device, appData: AppData): Promise<void> {
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

    const liveBuildInstalls = device.getCapabilityValue('live_build_installs') ?? 0;

    // TODO: potentially implement this trigger
    // if (liveBuildInstalls !== appData.liveBuild?.installs) {
    //   this.liveBuildInstallsChangedTrigger?.trigger(device, {
    //     installs: appData.liveBuild?.installs,
    //     installs_delta: (appData.liveBuild?.installs ?? 0) - liveBuildInstalls,
    //   })
    // }

    await device.setCapabilityValue('live_build_installs', appData.liveBuild?.installs ?? 0);

    const liveBuildState = device.getCapabilityValue('live_build_state') ?? 'none';

    if (liveBuildState !== appData.liveBuild?.state) {
      this.appLiveBuildStateChangedTrigger?.trigger(device, {
        state: appData.liveBuild?.state ?? 'none'
      })
    }

    await device.setCapabilityValue('live_build_state', appData.liveBuild?.state ?? 'none');

    const liveVersion = device.getCapabilityValue('live_version') ?? 'none';

    if (liveVersion !== appData.liveVersion) {
      this.appLiveVersionChangedTrigger?.trigger(device, {
        version: appData.liveVersion ?? 'none'
        // change_log: appData.liveBuild?.test ?? 'none'
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

    const testBuildInstalls = device.getCapabilityValue('test_build_installs') ?? 0;

    // TODO: potentially implement this trigger
    // if (testBuildInstalls !== appData.testBuild?.installs) {
    //   this.testBuildInstallsChangedTrigger?.trigger(device, {
    //     installs: appData.testBuild?.installs,
    //     installs_delta: (appData.testBuild?.installs ?? 0) - testBuildInstalls,
    //   })
    // }

    await device.setCapabilityValue('test_build_installs', appData.testBuild?.installs ?? 0);

    const testBuildState = device.getCapabilityValue('test_build_state') ?? 'none';

    if (testBuildState !== appData.testBuild?.state) {
      this.appTestBuildStateChangedTrigger?.trigger(device, {
        state: appData.testBuild?.state ?? 'none'
      })

      if (appData.testBuild?.state === 'review_rejected') {
        this.appReviewFailedTrigger?.trigger(device, {
          version: appData.testVersion ?? 'none'
        })
      }
    }

    await device.setCapabilityValue('test_build_state', appData.testBuild?.state ?? 'none');

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

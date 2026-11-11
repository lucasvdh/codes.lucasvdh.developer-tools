import Homey from "homey";
import ApiRegistry from "./lib/ApiRegistry";
import AppsFeed from "./lib/AppsFeed";
import AppDetailsCache from "./lib/AppDetailsCache";
import {Services} from "./lib/services";
import {OverviewWidgetSource} from "./drivers/overview/types";

interface SpotlightSettings {
  device?: string | { id?: string };
}

interface DashboardsManager {
  getWidget(id: string): {
    registerSettingAutocompleteListener(
      settingId: string,
      listener: (query: string, settings: SpotlightSettings) => Promise<object[]>,
    ): void;
  };
}

class DeveloperTools extends Homey.App implements Services {
  private apiRegistry?: ApiRegistry;
  private appsFeed?: AppsFeed;
  private appDetails?: AppDetailsCache;

  /**
   * onInit is called when the app is initialized.
   */
  async onInit(): Promise<void> {
    this.homey.log("App has been initialized");
    this.registerWidgetAutocomplete();
  }

  get apis(): ApiRegistry {
    this.apiRegistry ??= new ApiRegistry(this.homey.settings);
    return this.apiRegistry;
  }

  get feed(): AppsFeed {
    this.appsFeed ??= new AppsFeed();
    return this.appsFeed;
  }

  get details(): AppDetailsCache {
    this.appDetails ??= new AppDetailsCache();
    return this.appDetails;
  }

  getOverviewDevices(): OverviewWidgetSource[] {
    try {
      return this.homey.drivers.getDriver('overview').getDevices() as unknown as OverviewWidgetSource[];
    } catch {
      return [];
    }
  }

  /**
   * The App overview device a widget shows. Without an id only when there is
   * exactly one, so a widget never shows another account by accident.
   */
  getOverviewDevice(id?: string): OverviewWidgetSource | undefined {
    const devices = this.getOverviewDevices();
    if (id) return devices.find((device) => device.getId() === String(id));
    return devices.length === 1 ? devices[0] : undefined;
  }

  /** The App Spotlight widget lets you pick an App overview device and then one of its apps. */
  private registerWidgetAutocomplete(): void {
    // ManagerDashboards is missing from the SDK typings used here.
    const dashboards = (this.homey as unknown as { dashboards?: DashboardsManager }).dashboards;
    if (!dashboards || typeof dashboards.getWidget !== 'function') return;
    try {
      const widget = dashboards.getWidget('app-spotlight');

      widget.registerSettingAutocompleteListener('device', async (query: string) => {
        const q = String(query || '').toLowerCase();
        return this.getOverviewDevices()
            .map((device) => {
              const data = device.getWidgetData();
              return {
                name: data.name,
                description: this.homey.__('widgets.device_description', {
                  apps: data.appCount,
                  installs: data.totalInstalls,
                  devices: data.totalDevices,
                }),
                id: data.deviceId,
              };
            })
            .filter((item) => !q || item.name.toLowerCase().includes(q));
      });

      widget.registerSettingAutocompleteListener('app', async (query: string, settings: SpotlightSettings) => {
        const selected = settings?.device;
        const selectedDeviceId = typeof selected === 'string' ? selected : selected?.id;
        if (!selectedDeviceId) return [];

        const device = this.getOverviewDevice(String(selectedDeviceId));
        if (!device) return [];

        const q = String(query || '').trim().toLowerCase();
        return device.getWidgetData().apps
            .sort((a, b) => b.installs - a.installs || a.name.localeCompare(b.name))
            .map((app) => ({
              name: app.name,
              description: this.homey.__('widgets.app_description', {
                installs: app.installs,
                devices: app.deviceCount,
                version: app.liveVersion ? `v${app.liveVersion}` : this.homey.__('widgets.no_live_version'),
              }),
              id: app.id,
              deviceId: String(selectedDeviceId),
            }))
            .filter((item) => !q || item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q));
      });
    } catch (error) {
      this.error('[Widgets] Failed to register App Spotlight autocomplete', error);
    }
  }
}

module.exports = DeveloperTools;

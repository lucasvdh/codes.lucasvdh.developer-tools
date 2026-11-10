import Homey from "homey";
import ApiRegistry from "./lib/ApiRegistry";
import AppsFeed from "./lib/AppsFeed";
import {Services} from "./lib/services";

class DeveloperTools extends Homey.App implements Services {
  private apiRegistry?: ApiRegistry;
  private appsFeed?: AppsFeed;

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

  private getOverviewDevices(): any[] {
    try {
      return this.homey.drivers.getDriver('overview').getDevices();
    } catch {
      return [];
    }
  }

  /** The App Spotlight widget lets you pick an App overview device and then one of its apps. */
  private registerWidgetAutocomplete(): void {
    const dashboards = (this.homey as any).dashboards;
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

      widget.registerSettingAutocompleteListener('app', async (query: string, settings: any) => {
        const selected = settings && settings.device;
        const selectedDeviceId = typeof selected === 'string' ? selected : selected && selected.id;
        if (!selectedDeviceId) return [];

        const device = this.getOverviewDevices().find((item) => item.getId() === String(selectedDeviceId));
        if (!device) return [];

        const q = String(query || '').trim().toLowerCase();
        const data = device.getWidgetData();
        return (Array.isArray(data.apps) ? data.apps : [])
            .slice()
            .sort((a: any, b: any) => (Number(b.installs) || 0) - (Number(a.installs) || 0) || String(a.name || a.id).localeCompare(String(b.name || b.id)))
            .map((app: any) => ({
              name: String(app.name || app.id || ''),
              description: this.homey.__('widgets.app_description', {
                installs: Number(app.installs) || 0,
                devices: Number(app.deviceCount) || 0,
                version: app.liveVersion ? `v${app.liveVersion}` : this.homey.__('widgets.no_live_version'),
              }),
              id: String(app.id || ''),
              deviceId: String(selectedDeviceId),
            }))
            .filter((item: any) => !q || item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q));
      });
    } catch (error) {
      this.error('[Widgets] Failed to register App Spotlight autocomplete', error);
    }
  }
}

module.exports = DeveloperTools;

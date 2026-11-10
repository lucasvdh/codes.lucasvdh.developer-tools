"use strict";

import {Device, FlowCardTriggerDevice} from "homey";
import {AppData} from "../../lib/AthomApi";
import {AppsByPatId} from "../../lib/AppsFeed";
import {appName} from "../../lib/appUtils";
import {services} from "../../lib/services";

interface OverviewApp {
  id: string;
  name: string;
  installs: number;
  cloud: number;
  local: number;
  rating: number;
}

const APP_CAPABILITY_PREFIX = 'installs.';

class OverviewDevice extends Device {
  private unsubscribe?: () => void;
  private installsIncreasedTrigger?: FlowCardTriggerDevice;
  private installsDecreasedTrigger?: FlowCardTriggerDevice;

  async onInit(): Promise<void> {
    this.log('App overview device has been initialized');

    this.installsIncreasedTrigger = this.homey.flow.getDeviceTriggerCard('overview_installs_increased');
    this.installsDecreasedTrigger = this.homey.flow.getDeviceTriggerCard('overview_installs_decreased');

    const {apis, feed} = services(this.homey);
    this.unsubscribe = feed.onApps((appsByPatId) => {
      this.onAppsUpdated(appsByPatId).catch((e) => this.error(e));
    });

    // Show data right away instead of waiting for the next poll.
    try {
      const patId = await this.resolvePatId();
      if (!patId) {
        await this.setUnavailable(this.homey.__('overview.no_token'));
        return;
      }
      const apps = await feed.getOrFetch(patId, apis);
      if (apps) await this.updateApps(apps);
    } catch (e) {
      this.error(e);
    }
  }

  async onUninit(): Promise<void> {
    this.unsubscribe?.();
  }

  async onDeleted(): Promise<void> {
    this.unsubscribe?.();
  }

  private async onAppsUpdated(appsByPatId: AppsByPatId): Promise<void> {
    const patId = await this.resolvePatId();
    if (!patId) {
      await this.setUnavailable(this.homey.__('overview.no_token'));
      return;
    }
    const apps = appsByPatId.get(patId);
    if (apps) await this.updateApps(apps);
  }

  /**
   * The token this device uses. When the token was replaced in the settings,
   * the device moves to a token of the same account (matched on user id).
   * It never moves to a token of another account.
   */
  private async resolvePatId(): Promise<string | undefined> {
    const store = services(this.homey).apis.store;
    const patId = this.getStoreValue('pat_id');
    if (patId && store.get(patId)) return patId;

    const accountId = this.getStoreValue('id') ?? String(this.getData().id ?? '').replace(/^overview-/, '');
    const entry = store.list().find((candidate) => candidate.id === accountId || candidate.userId === accountId);
    if (!entry) return undefined;

    await this.setStoreValue('pat_id', entry.id);
    return entry.id;
  }

  async updateApps(appsData: AppData[]): Promise<void> {
    const apps: OverviewApp[] = appsData
        .filter((appData) => appData && appData.id && !appData.deleted)
        .map((appData) => ({
          id: appData.id,
          name: appName(appData, appData.id),
          installs: appData.installs ?? 0,
          cloud: appData.installsCloud ?? 0,
          local: appData.installsLocal ?? 0,
          rating: appData.rating ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    // One installs capability per app, so every app keeps its own Insights.
    for (const app of apps) {
      const capability = `${APP_CAPABILITY_PREFIX}${app.id}`;
      if (!this.hasCapability(capability)) {
        await this.addCapability(capability);
      }
      await this.setCapabilityOptions(capability, {title: {en: app.name}});
      await this.setCapabilityValue(capability, app.installs);
    }

    // Remove the capabilities of apps that were deleted or moved to another account.
    if (apps.length > 0) {
      const current = new Set(apps.map((app) => `${APP_CAPABILITY_PREFIX}${app.id}`));
      for (const capability of this.getCapabilities()) {
        if (capability.startsWith(APP_CAPABILITY_PREFIX) && !current.has(capability)) {
          await this.removeCapability(capability);
        }
      }
    }

    await this.setCapabilityValue('installs', apps.reduce((sum, app) => sum + app.installs, 0));
    await this.setCapabilityValue('installs_cloud', apps.reduce((sum, app) => sum + app.cloud, 0));
    await this.setCapabilityValue('installs_local', apps.reduce((sum, app) => sum + app.local, 0));

    await this.triggerInstallChanges(apps);
    await this.setStoreValue('apps', apps);

    if (!this.getAvailable()) await this.setAvailable();
  }

  /** "App installs increased/decreased" for every app whose installs changed since the last poll. */
  private async triggerInstallChanges(apps: OverviewApp[]): Promise<void> {
    const previous = this.getStoreValue('apps');
    if (!Array.isArray(previous)) return;

    const previousById = new Map<string, OverviewApp>(previous.map((app: OverviewApp) => [app.id, app]));

    for (const app of apps) {
      const old = previousById.get(app.id);
      if (!old) continue;

      const diff = app.installs - old.installs;
      if (diff === 0) continue;

      const trigger = diff > 0 ? this.installsIncreasedTrigger : this.installsDecreasedTrigger;
      await trigger?.trigger(this, {
        app: app.name,
        id: app.id,
        installs: app.installs,
        cloud: app.cloud,
        local: app.local,
        rating: app.rating,
        diff,
      }).catch((e) => this.error(e));
    }
  }
}

module.exports = OverviewDevice;

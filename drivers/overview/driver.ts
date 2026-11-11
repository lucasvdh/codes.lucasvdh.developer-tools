"use strict";
import {Device, Driver} from "homey";
import {ownerLabelFor} from "../../lib/appUtils";
import {services} from "../../lib/services";
import {OrganizationScope} from "./types";

interface OrganizationChoice {
  id: string;
  name: string;
}

interface AccountChoice {
  patId: string;
  accountId: string;
  name: string;
  organizations: OrganizationChoice[];
}

/**
 * One device per account (Personal Access Token) with the total installs and
 * the installs of every app of that account. The app driver already fetches
 * the apps of every token on each poll and publishes them on the apps feed,
 * so this driver does not poll the API itself.
 */
class OverviewDriver extends Driver {

  async onInit() {
    this.log('App overview driver has been initialized');
  }

  /**
   * The accounts (tokens) with the Developer Organizations each one belongs
   * to, for the selection screen in pairing and repair.
   */
  private async listAccounts(patIds?: string[]): Promise<AccountChoice[]> {
    const apis = services(this.homey).apis;
    const accounts: AccountChoice[] = [];
    const seen = new Set<string>();
    for (const entry of apis.store.list()) {
      if (patIds && !patIds.includes(entry.id)) continue;
      // The account id survives replacing the token; the token id is the fallback.
      const accountId = entry.userId || entry.id;
      if (seen.has(accountId)) continue;
      seen.add(accountId);

      let organizations: OrganizationChoice[] = [];
      try {
        organizations = (await apis.get(entry.id)?.getOrganizations() ?? [])
            .filter((organization) => organization?.id)
            .map((organization) => ({id: organization.id, name: organization.name || organization.id}));
      } catch (e) {
        this.error(`Could not list the organizations of token ${entry.id.slice(0, 6)}`, e);
      }
      accounts.push({patId: entry.id, accountId, name: ownerLabelFor(entry), organizations});
    }
    return accounts;
  }

  /** Whether an overview device for this account (or its token) already exists. */
  private hasOverviewFor(account: AccountChoice): boolean {
    return this.getDevices().some((device) => {
      const dataId = device.getData().id;
      return dataId === `overview-${account.accountId}`
          || dataId === `overview-${account.patId}`
          || device.getStoreValue('pat_id') === account.patId;
    });
  }

  async onPair(session: any) {
    const store = services(this.homey).apis.store;
    let selection: Array<{data: {id: string}, store: {pat_id: string}}> = [];

    session.setHandler('showView', async (view: string) => {
      if (view === 'loading') {
        await session.showView(store.list().length > 0 ? 'list_devices' : 'not_configured');
      }
    });

    // Step 1: Homey's own device list, one device per account. Accounts that
    // already have an overview device are left out.
    session.setHandler('list_devices', async () => {
      const accounts = (await this.listAccounts()).filter((account) => !this.hasOverviewFor(account));
      return accounts.map((account) => ({
        name: `${this.homey.__('overview.device_name')} - ${account.name}`,
        data: {id: `overview-${account.accountId}`},
        store: {id: account.accountId, pat_id: account.patId, organization_ids: []},
      }));
    });

    session.setHandler('list_devices_selection', async (devices: typeof selection) => {
      selection = Array.isArray(devices) ? devices : [];
    });

    // Step 2: the organizations of the selected accounts.
    session.setHandler('get_accounts', async () => {
      const accounts = await this.listAccounts(selection.map((device) => device.store?.pat_id));
      return {accounts};
    });

    // The selected devices with the chosen organizations; the screen adds them.
    session.setHandler('build_devices', async (choices: Array<{patId: string, organizationIds: string[]}>) => {
      const accounts = await this.listAccounts(selection.map((device) => device.store?.pat_id));
      return selection.map((device) => {
        const account = accounts.find((item) => item.patId === device.store?.pat_id);
        const choice = choices.find((item) => item.patId === device.store?.pat_id);
        const organizationIds = (choice?.organizationIds ?? [])
            .filter((id) => account?.organizations.some((organization) => organization.id === id));
        return {...device, store: {...device.store, organization_ids: organizationIds}};
      });
    });
  }

  async onRepair(session: any, device: Device) {
    const scoped = device as unknown as OrganizationScope;

    session.setHandler('get_accounts', async () => {
      const patId = device.getStoreValue('pat_id');
      const accounts = await this.listAccounts(patId ? [patId] : undefined);
      return {accounts: accounts.slice(0, 1), selected: scoped.getOrganizationIds()};
    });

    session.setHandler('save_organizations', async (organizationIds: string[]) => {
      await scoped.setOrganizationIds(Array.isArray(organizationIds) ? organizationIds : []);
      return true;
    });
  }
}

module.exports = OverviewDriver;

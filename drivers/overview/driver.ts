"use strict";
import {Driver} from "homey";
import {ownerLabelFor} from "../../lib/appUtils";
import {services} from "../../lib/services";

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

  async onPair(session: any) {
    const store = services(this.homey).apis.store;

    session.setHandler('showView', async (view: string) => {
      if (view === 'loading') {
        await session.showView(store.list().length > 0 ? 'list_devices' : 'not_configured');
      }
    });

    session.setHandler('list_devices', async () => {
      return store.list().map((entry) => ({
        name: `${this.homey.__('overview.device_name')} - ${ownerLabelFor(entry)}`,
        // The account id survives replacing the token; the token id is the fallback.
        data: {id: `overview-${entry.userId || entry.id}`},
        store: {id: entry.userId || entry.id, pat_id: entry.id},
      }));
    });
  }
}

module.exports = OverviewDriver;

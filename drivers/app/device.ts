"use strict";

import {Device} from "homey";

const ADDED_IN_1_2_0 = ['rating', 'live_build_age_days'];
const ADDED_IN_1_4_0 = [
  'suggestions_count',
  'device_count',
  'total_crashes',
  'build_count',
  'installs_trend_7d',
];
const ADDED_IN_1_5_0 = ['app_owner'];
const REMOVED_IN_1_4_0 = ['live_build_state'];

class AppDevice extends Device {

  async onInit(): Promise<void> {
    this.log("Device has been initialized");

    // Remove deprecated capabilities first — the SDK rejects addCapability
    // while the device still carries capabilities not in the manifest.
    for (const capability of REMOVED_IN_1_4_0) {
      if (this.hasCapability(capability)) {
        try {
          await this.removeCapability(capability);
          this.log(`Removed deprecated capability: ${capability}`);
        } catch (err) {
          this.error(`Failed to remove capability ${capability}:`, err);
        }
      }
    }

    for (const capability of [...ADDED_IN_1_2_0, ...ADDED_IN_1_4_0, ...ADDED_IN_1_5_0]) {
      if (!this.hasCapability(capability)) {
        try {
          await this.addCapability(capability);
          this.log(`Added missing capability: ${capability}`);
        } catch (err) {
          this.error(`Failed to add capability ${capability}:`, err);
        }
      }
    }

    return super.onInit();
  }
}

module.exports = AppDevice;

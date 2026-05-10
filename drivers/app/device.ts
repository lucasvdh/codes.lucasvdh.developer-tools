"use strict";

import {Device} from "homey";

const ADDED_IN_1_2_0 = ['rating', 'live_build_age_days'];

class AppDevice extends Device {

  async onInit(): Promise<void> {
    this.log("Device has been initialized");

    for (const capability of ADDED_IN_1_2_0) {
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

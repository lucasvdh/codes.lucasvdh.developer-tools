"use strict";

import {Device} from "homey";

class AppDevice extends Device {

  async onInit(): Promise<void> {
    this.log("Device has been initialized");

    return super.onInit();
  }
}

module.exports = AppDevice;

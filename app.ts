import Homey from "homey";

class DeveloperTools extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit(): Promise<void> {
    this.homey.log("App has been initialized");
  }


}

module.exports = DeveloperTools;

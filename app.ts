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
  }

  get apis(): ApiRegistry {
    this.apiRegistry ??= new ApiRegistry(this.homey.settings);
    return this.apiRegistry;
  }

  get feed(): AppsFeed {
    this.appsFeed ??= new AppsFeed();
    return this.appsFeed;
  }
}

module.exports = DeveloperTools;

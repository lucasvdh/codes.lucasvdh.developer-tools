import ApiRegistry from "./ApiRegistry";
import AppsFeed from "./AppsFeed";
import AppDetailsCache from "./AppDetailsCache";

/** Shared state owned by the App instance and used by every driver. */
export interface Services {
  readonly apis: ApiRegistry;
  readonly feed: AppsFeed;
  readonly details: AppDetailsCache;
}

export function services(homey: { app: unknown }): Services {
  return homey.app as Services;
}

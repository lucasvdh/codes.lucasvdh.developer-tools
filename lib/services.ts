import ApiRegistry from "./ApiRegistry";
import AppsFeed from "./AppsFeed";

/** Shared state owned by the App instance and used by every driver. */
export interface Services {
  readonly apis: ApiRegistry;
  readonly feed: AppsFeed;
}

export function services(homey: { app: unknown }): Services {
  return homey.app as Services;
}

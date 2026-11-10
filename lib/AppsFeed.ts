import {EventEmitter} from "events";
import {AppData} from "./AthomApi";
import ApiRegistry from "./ApiRegistry";

export type AppsByPatId = Map<string, AppData[]>;

/**
 * The app lists of the last poll, per token. The app driver publishes them;
 * other drivers subscribe instead of polling the API themselves.
 */
export class AppsFeed extends EventEmitter {
  private latest: AppsByPatId = new Map();

  constructor() {
    super();
    // One listener per App overview device.
    this.setMaxListeners(0);
  }

  publish(appsByPatId: AppsByPatId): void {
    this.latest = new Map(appsByPatId);
    this.emit('apps', this.latest);
  }

  onApps(listener: (appsByPatId: AppsByPatId) => void): () => void {
    this.on('apps', listener);
    return () => this.off('apps', listener);
  }

  get(patId: string): AppData[] | undefined {
    return this.latest.get(patId);
  }

  /** The apps of one token from the last poll, or fetched once when there was no poll yet. */
  async getOrFetch(patId: string, apis: ApiRegistry): Promise<AppData[] | undefined> {
    const cached = this.latest.get(patId);
    if (cached) return cached;

    const api = apis.get(patId);
    if (!api) return undefined;
    const apps = await api.getApps();
    this.latest.set(patId, apps);
    return apps;
  }
}

export default AppsFeed;

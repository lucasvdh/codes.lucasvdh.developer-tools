import AthomApi from "./AthomApi";
import PatStore, {SettingsLike} from "./PatStore";

/**
 * One API client per configured Personal Access Token, shared by all drivers
 * so every token keeps a single cached delegation JWT.
 */
export class ApiRegistry {
  private apis: Map<string, AthomApi> = new Map();
  private settings: SettingsLike;

  constructor(settings: SettingsLike) {
    this.settings = settings;
  }

  get store(): PatStore {
    return new PatStore(this.settings);
  }

  get size(): number {
    return this.apis.size;
  }

  /** Brings the clients in line with the tokens in the settings. */
  sync(): void {
    const tokens = this.store.list();
    const seenIds = new Set<string>();

    for (const entry of tokens) {
      seenIds.add(entry.id);
      const existing = this.apis.get(entry.id);
      if (existing) {
        existing.setPersonalAccessToken(entry.token);
      } else {
        this.apis.set(entry.id, new AthomApi(entry.token));
      }
    }

    for (const id of Array.from(this.apis.keys())) {
      if (!seenIds.has(id)) {
        this.apis.delete(id);
      }
    }
  }

  get(patId: string): AthomApi | undefined {
    if (!this.apis.has(patId)) {
      this.sync();
    }
    return this.apis.get(patId);
  }

  entries(): Array<[string, AthomApi]> {
    return Array.from(this.apis.entries());
  }
}

export default ApiRegistry;

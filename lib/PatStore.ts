import { randomUUID } from "crypto";

export interface PatEntry {
  id: string;
  token: string;
  label?: string;
  username?: string;
  email?: string;
  userId?: string;
  avatarUrl?: string;
  lastCheckOk?: boolean;
  lastCheckedAt?: string;
  lastError?: string;
}

export type PatEntryPublic = Omit<PatEntry, "token"> & { tokenSuffix: string };

export interface SettingsLike {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

const KEY = "personal_access_tokens";
const LEGACY_KEY = "personal_access_token";

export class PatStore {
  private settings: SettingsLike;

  constructor(settings: SettingsLike) {
    this.settings = settings;
  }

  list(): PatEntry[] {
    const value = this.settings.get(KEY);
    return Array.isArray(value) ? (value as PatEntry[]) : [];
  }

  listPublic(): PatEntryPublic[] {
    return this.list().map(PatStore.redact);
  }

  get(id: string): PatEntry | undefined {
    return this.list().find((entry) => entry.id === id);
  }

  add(entry: Omit<PatEntry, "id"> & { id?: string }): PatEntry {
    const created: PatEntry = { ...entry, id: entry.id ?? PatStore.generateId() };
    this.settings.set(KEY, [...this.list(), created]);
    return created;
  }

  update(id: string, patch: Partial<Omit<PatEntry, "id">>): PatEntry | undefined {
    const list = this.list();
    const index = list.findIndex((entry) => entry.id === id);
    if (index === -1) return undefined;
    const updated: PatEntry = { ...list[index], ...patch, id: list[index].id };
    const next = list.slice();
    next[index] = updated;
    this.settings.set(KEY, next);
    return updated;
  }

  remove(id: string): boolean {
    const list = this.list();
    const next = list.filter((entry) => entry.id !== id);
    if (next.length === list.length) return false;
    this.settings.set(KEY, next);
    return true;
  }

  migrateFromLegacy(): PatEntry | undefined {
    if (this.list().length > 0) return undefined;

    const legacy = this.settings.get(LEGACY_KEY);
    if (typeof legacy !== "string" || legacy.trim() === "") return undefined;

    const entry = this.add({ token: legacy.trim() });
    this.settings.set(LEGACY_KEY, "");
    return entry;
  }

  static generateId(): string {
    try {
      return randomUUID();
    } catch {
      return `pat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  static redact(entry: PatEntry): PatEntryPublic {
    const { token, ...rest } = entry;
    return { ...rest, tokenSuffix: token.slice(-4) };
  }
}

export default PatStore;

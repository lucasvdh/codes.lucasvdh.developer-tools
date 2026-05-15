import AthomApi from './lib/AthomApi';
import PatStore, { PatEntry, PatEntryPublic, SettingsLike } from './lib/PatStore';

interface HomeyApiArg {
  homey: { settings: SettingsLike };
}

interface TestTokenArgs extends HomeyApiArg {
  body?: { token?: string };
}

interface AddTokenArgs extends HomeyApiArg {
  body?: { token?: string; label?: string };
}

interface IdParamArgs extends HomeyApiArg {
  params?: { id?: string };
}

interface BaseResult {
  ok: boolean;
  error?: string;
}

interface TestResult extends BaseResult {
  appCount?: number;
  username?: string;
  email?: string;
  userId?: string;
  avatarUrl?: string;
}

interface AddResult extends BaseResult {
  entry?: PatEntryPublic;
  appCount?: number;
}

interface ListResult {
  tokens: PatEntryPublic[];
}

async function verifyToken(token: string): Promise<TestResult> {
  if (!token) {
    return { ok: false, error: 'No token provided' };
  }
  try {
    const api = new AthomApi(token);
    const apps = await api.getApps();
    let user: Awaited<ReturnType<AthomApi['getUserInfo']>> | undefined;
    try {
      user = await api.getUserInfo();
    } catch {
      // best-effort: a working PAT may still fail /user/me; keep apps result
    }
    return {
      ok: true,
      appCount: apps.length,
      username: user?.fullname,
      email: user?.email,
      userId: user?.id,
      avatarUrl: user?.avatarUrl,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

module.exports = {
  async testToken({ body }: TestTokenArgs): Promise<TestResult> {
    return verifyToken(body?.token?.trim() ?? '');
  },

  async listTokens({ homey }: HomeyApiArg): Promise<ListResult> {
    const store = new PatStore(homey.settings);
    store.migrateFromLegacy();
    return { tokens: store.listPublic() };
  },

  async addToken({ homey, body }: AddTokenArgs): Promise<AddResult> {
    const token = body?.token?.trim();
    if (!token) {
      return { ok: false, error: 'No token provided' };
    }

    const store = new PatStore(homey.settings);
    if (store.list().some((entry) => entry.token === token)) {
      return { ok: false, error: 'Token already configured' };
    }

    const result = await verifyToken(token);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    const entry: Omit<PatEntry, 'id'> = {
      token,
      label: body?.label?.trim() || undefined,
      username: result.username,
      email: result.email,
      userId: result.userId,
      avatarUrl: result.avatarUrl,
      lastCheckOk: true,
      lastCheckedAt: new Date().toISOString(),
    };
    const created = store.add(entry);
    return { ok: true, entry: PatStore.redact(created), appCount: result.appCount };
  },

  async removeToken({ homey, params }: IdParamArgs): Promise<BaseResult> {
    const id = params?.id;
    if (!id) {
      return { ok: false, error: 'No id provided' };
    }
    const store = new PatStore(homey.settings);
    return store.remove(id) ? { ok: true } : { ok: false, error: 'Token not found' };
  },

  async testTokenById({ homey, params }: IdParamArgs): Promise<TestResult> {
    const id = params?.id;
    if (!id) {
      return { ok: false, error: 'No id provided' };
    }
    const store = new PatStore(homey.settings);
    const entry = store.get(id);
    if (!entry) {
      return { ok: false, error: 'Token not found' };
    }

    const result = await verifyToken(entry.token);
    store.update(id, {
      lastCheckOk: result.ok,
      lastCheckedAt: new Date().toISOString(),
      lastError: result.ok ? undefined : result.error,
      username: result.username ?? entry.username,
      email: result.email ?? entry.email,
      userId: result.userId ?? entry.userId,
      avatarUrl: result.avatarUrl ?? entry.avatarUrl,
    });
    return result;
  },
};

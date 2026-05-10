import AthomApi from './lib/AthomApi';

interface TestArgs {
  body?: { token?: string };
}

interface TestResult {
  ok: boolean;
  appCount?: number;
  error?: string;
}

module.exports = {
  async testToken({ body }: TestArgs): Promise<TestResult> {
    const token = body?.token?.trim();
    if (!token) {
      return { ok: false, error: 'No token provided' };
    }

    try {
      const apps = await new AthomApi(token).getApps();
      return { ok: true, appCount: apps.length };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
};

import {https} from "follow-redirects";
import {IncomingMessage} from "http";

interface RequestOptions {
  method: string;
  hostname: string;
  path: string;
  headers: { [key: string]: string };
  maxRedirects: number;
}

export interface AppData {
  liveBuild: BuildData | null;
  liveVersion: string | null;
  testBuild: BuildData | null;
  testVersion: string | null;
  installs: number;
  installsLocal: number;
  installsCloud: number;
  rating: number | null;
  deleted: boolean;
  id: string;
  testBuildUpdatedAt?: string;
  liveBuildUpdatedAt?: string;
  // Set by getApps for apps that belong to a Developer Organization.
  organization?: OrganizationRef;
}

export interface OrganizationRef {
  id: string;
  name: string;
}

export interface OrganizationData {
  id: string;
  name?: string;
  apps?: Array<string | Partial<AppData>>;
}

export interface AppsResult {
  apps: AppData[];
  /** Organizations or organization apps that could not be loaded. */
  failures: string[];
}

interface BuildData {
  crashes: number;
  installs: number;
  installsLocal: number;
  installsCloud: number;
  state: string;
  version?: string;
  _id: string;
  id: number;
  stateChangedAt: string;
  brandColor: string;
  imageLarge: string;
  imageSmall: string;
  name: LocalizedData;
  icon: string;
  runtime?: string;
}

export interface LocalizedData {
  en?: string;
  nl?: string;
  de?: string;
  fr?: string;
  it?: string;
  sv?: string;
  no?: string;
  es?: string;
  da?: string;
  pl?: string;
}

export interface Suggestion {
  id: string;
  suggestionText: string;
  createdAt: string;
}

export interface BuildSummary {
  id: number;
  crashes: number;
  installs: number;
  version: string;
  state: string;
  createdAt: string;
  stateChangedAt: string;
  platforms: string[];
}

export interface BuildDetail {
  id: number;
  version: string;
  state: string;
  changelog?: LocalizedData;
  readme?: LocalizedData;
  permissions?: string[];
}

export interface CrashReport {
  count: number;
  homeyVersion?: string;
  stack: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatPoint {
  date: string;
  value: number | null;
}

export interface UserInfo {
  id: string;
  fullname?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  avatarUrl?: string;
}

interface RawUserResponse {
  _id?: string;
  id?: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  fullname?: string;
  avatar?: { small?: string; medium?: string; large?: string };
}

export class AthomApi {
  private personalAccessToken: string;
  private delegatedJWT?: string;
  private delegatedJWTExpiresAt?: Date;

  constructor(personalAccessToken: string) {
    this.personalAccessToken = personalAccessToken;
  }

  public setPersonalAccessToken(personalAccessToken: string): void {
    this.personalAccessToken = personalAccessToken;
    this.delegatedJWT = undefined;
    this.delegatedJWTExpiresAt = undefined;
  }

  /**
   * The apps of the account itself plus the apps of every Developer
   * Organization the account belongs to. An organization that can't be
   * loaded is skipped, so it never hides the account's own apps.
   */
  public async getApps(): Promise<AppData[]> {
    return (await this.getAppsWithFailures()).apps;
  }

  /**
   * Like getApps, but also reports what could not be loaded, so callers can
   * tell a complete list from a partial one.
   */
  public async getAppsWithFailures(): Promise<AppsResult> {
    const ownApps = JSON.parse(await this.authedGet('/api/v1/app/me')) as AppData[];
    const apps = new Map<string, AppData>(ownApps.map((app) => [app.id, app]));
    const failures: string[] = [];

    let organizations: OrganizationData[] = [];
    try {
      organizations = await this.getOrganizations();
    } catch (error) {
      return {apps: ownApps, failures: [`organizations: ${(error as Error).message}`]};
    }

    for (const organization of organizations) {
      try {
        for (const app of await this.getOrganizationApps(organization.id, new Set(apps.keys()), failures)) {
          apps.set(app.id, app);
        }
      } catch (error) {
        // Skip this organization; the others and the account's own apps still load.
        failures.push(`organization ${organization.id}: ${(error as Error).message}`);
      }
    }

    return {apps: Array.from(apps.values()), failures};
  }

  public async getOrganizations(): Promise<OrganizationData[]> {
    const organizations = JSON.parse(await this.authedGet('/api/v1/org')) as OrganizationData[];
    return Array.isArray(organizations) ? organizations : [];
  }

  private async getOrganizationApps(
      organizationId: string,
      knownAppIds: Set<string>,
      failures: string[],
  ): Promise<AppData[]> {
    const organization = JSON.parse(
        await this.authedGet(`/api/v1/org/${encodeURIComponent(organizationId)}`),
    ) as OrganizationData;
    const ref: OrganizationRef = {id: organization.id ?? organizationId, name: organization.name ?? organizationId};

    const apps: AppData[] = [];
    for (const entry of Array.isArray(organization.apps) ? organization.apps : []) {
      const appId = typeof entry === 'string' ? entry : entry?.id;
      if (!appId || knownAppIds.has(appId)) continue;

      // The organization lists either full app objects or only their ids.
      try {
        const app = typeof entry === 'object' && typeof entry.installs === 'number'
            ? entry as AppData
            : JSON.parse(await this.authedGet(`/api/v1/app/${encodeURIComponent(appId)}`)) as AppData;
        apps.push({...app, organization: ref});
      } catch (error) {
        // Skip this app; the other apps of the organization still load.
        failures.push(`app ${appId}: ${(error as Error).message}`);
      }
    }
    return apps;
  }

  public async getUserInfo(): Promise<UserInfo> {
    const body = await this.request({
      method: 'GET',
      hostname: 'api.athom.com',
      path: '/user/me',
      headers: {
        'authorization': `Bearer ${this.personalAccessToken}`,
      },
      maxRedirects: 20,
    });
    const raw = JSON.parse(body) as RawUserResponse;
    return {
      id: raw._id ?? raw.id ?? '',
      fullname: raw.fullname,
      firstname: raw.firstname,
      lastname: raw.lastname,
      email: raw.email,
      avatarUrl: raw.avatar?.small ?? raw.avatar?.medium ?? raw.avatar?.large,
    };
  }

  public async getSuggestions(appId: string): Promise<Suggestion[]> {
    return JSON.parse(await this.authedGet(`/api/v1/app/${appId}/suggestion`)) as Suggestion[];
  }

  public async getBuilds(appId: string): Promise<BuildSummary[]> {
    return JSON.parse(await this.authedGet(`/api/v1/app/${appId}/build`)) as BuildSummary[];
  }

  public async getBuild(appId: string, buildId: number): Promise<BuildDetail> {
    return JSON.parse(await this.authedGet(`/api/v1/app/${appId}/build/${buildId}`)) as BuildDetail;
  }

  public async getBuildCrashes(appId: string, buildId: number): Promise<CrashReport[]> {
    return JSON.parse(await this.authedGet(`/api/v1/app/${appId}/build/${buildId}/crash`)) as CrashReport[];
  }

  public async getDriverStats(appId: string): Promise<Record<string, StatPoint[]>> {
    return JSON.parse(await this.authedGet(`/api/v1/app/${appId}/drivers/stats`)) as Record<string, StatPoint[]>;
  }

  public async getInstallStats(appId: string): Promise<StatPoint[]> {
    return JSON.parse(await this.authedGet(`/api/v1/app/${appId}/install/stats`)) as StatPoint[];
  }

  private async authedGet(path: string): Promise<string> {
    const jwt = await this.getDelegatedJWT();
    return this.request({
      method: 'GET',
      hostname: 'apps-api.athom.com',
      path,
      headers: {
        'authorization': `Bearer ${jwt}`,
      },
      maxRedirects: 20,
    });
  }

  private async getDelegatedJWT(): Promise<string> {
    if (this.hasCachedDelegatedJWT()) {
      return this.delegatedJWT as string;
    }

    const body = await this.request({
      method: 'POST',
      hostname: 'api.athom.com',
      path: '/delegation/token?audience=apps',
      headers: {
        'authorization': `Bearer ${this.personalAccessToken}`,
      },
      maxRedirects: 20,
    });

    const jwt = JSON.parse(body) as string;
    this.delegatedJWT = jwt;
    this.delegatedJWTExpiresAt = AthomApi.parseJwtExpiry(jwt);

    return jwt;
  }

  private hasCachedDelegatedJWT(): boolean {
    if (this.delegatedJWT === undefined) return false;
    if (this.delegatedJWTExpiresAt === undefined) return true;
    return this.delegatedJWTExpiresAt > new Date();
  }

  private static parseJwtExpiry(jwt: string): Date | undefined {
    try {
      const payload = jwt.split('.')[1];
      if (!payload) return undefined;
      const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
      const parsed = JSON.parse(json) as { exp?: number };
      if (typeof parsed.exp === 'number') {
        return new Date((parsed.exp - 60) * 1000);
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  private request(options: RequestOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res: IncomingMessage) => {
        const chunks: Buffer[] = [];
        const status = res.statusCode;

        res.on('data', (chunk) => chunks.push(chunk));

        res.on('end', () => {
          const body = Buffer.concat(chunks).toString();

          if (status === undefined || status < 200 || status >= 300) {
            if (status === 401 || status === 403) {
              this.delegatedJWT = undefined;
              this.delegatedJWTExpiresAt = undefined;
            }
            return reject(new Error(`Request failed with status ${status}: ${body || '<empty body>'}`));
          }

          if (!body) {
            return reject(new Error('Empty response body'));
          }

          resolve(body);
        });

        res.on('error', reject);
      });

      req.on('error', reject);
      req.end();
    });
  }
}

export default AthomApi;

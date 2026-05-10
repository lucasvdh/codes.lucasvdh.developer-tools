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
}

interface BuildData {
  crashes: number;
  installs: number;
  installsLocal: number;
  installsCloud: number;
  state: string;
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

interface LocalizedData {
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

  public async getApps(): Promise<AppData[]> {
    const jwt = await this.getDelegatedJWT();
    const body = await this.request({
      method: 'GET',
      hostname: 'apps-api.athom.com',
      path: '/api/v1/app/me',
      headers: {
        'authorization': `Bearer ${jwt}`,
      },
      maxRedirects: 20,
    });
    return JSON.parse(body) as AppData[];
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

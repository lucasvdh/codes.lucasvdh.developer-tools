// import { InverterData } from "./types";
import {https} from "follow-redirects";
import qs from "querystring";
import {IncomingMessage} from "http";
import {EventEmitter} from "events";

interface RequestOptions {
  method: string;
  hostname: string;
  path: string;
  headers: { [key: string]: string };
  maxRedirects: number;
}

interface OAuthTokenResponse {
  token_type: string,
  access_token: string,
  expires_in: number,
  refresh_token: string
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

export class TimeoutError extends Error {
  constructor() {
    super("The connection timed out");
  }
}

export class UnexpectedResponseError extends Error {
  constructor(response: string) {
    super("Unexpected response from inverter: " + response);
  }
}

export class AthomApi extends EventEmitter {
  private oauthAccessToken?: string;
  private oauthAccessTokenExpiresAt?: Date;
  private oauthRefreshToken: string;
  private delegatedJWT?: string;
  private readonly clientCredentials: { clientId: string, clientSecret: string };
  private defaultOptions: RequestOptions = {
    method: 'POST',
    hostname: 'api.athom.com',
    path: '',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'origin': 'https://tools.developer.homey.app',
      'referer': 'https://tools.developer.homey.app/',
      'user-agent': 'Homey Developer Tools App'
    },
    maxRedirects: 20,
  };

  constructor(oauthRefreshToken: string, clientCredentials: { clientId: string, clientSecret: string }, options?: object) {
    super(options);

    this.oauthRefreshToken = oauthRefreshToken;
    this.clientCredentials = clientCredentials
  }

  public async getToken(): Promise<string> {
    if (this.hasCachedToken()) {
      return this.oauthAccessToken as string;
    }

    const options = this.buildOptions('/oauth2/token', {
      headers: {
        authorization: this.getBasicClientAuth(),
      },
    });

    const requestBody = qs.stringify({
      grant_type: 'refresh_token',
      refresh_token: this.oauthRefreshToken,
    });

    let body = await this.request(options, requestBody);

    const oauthTokenResponse = JSON.parse(body) as OAuthTokenResponse;
    const now = new Date();
    const expiresAt = (new Date());
    expiresAt.setSeconds(now.getSeconds() + oauthTokenResponse.expires_in);

    this.oauthAccessToken = oauthTokenResponse.access_token;
    this.oauthAccessTokenExpiresAt = expiresAt;
    this.oauthRefreshToken = oauthTokenResponse.refresh_token;
    this.emit('refresh_token_updated', this.oauthRefreshToken);

    return this.oauthAccessToken;
  }

  public async getDelegatedJWT(): Promise<string> {
    if (this.hasCachedDelegatedJWT()) {
      return this.delegatedJWT as string;
    }

    const accessToken = await this.getToken();

    const options = this.buildOptions('/delegation/token?audience=apps', {
      headers: {
        authorization: 'Bearer ' + accessToken,
      },
    });

    const body = await this.request(options);
    this.delegatedJWT = JSON.parse(body) as string;

    return this.delegatedJWT;
  }

  private request(options: RequestOptions, requestBody?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res: IncomingMessage) => {
        let chunks: any[] = [];

        // Check if the status code indicates success
        if (res.statusCode === undefined || res.statusCode < 200 || (res.statusCode >= 300 && res.statusCode < 400 ) || res.statusCode >= 500 ) {
          return reject(new Error(`Request failed with status code ${res.statusCode}`));
        } else if (res.statusCode >= 400) {
          this.delegatedJWT = undefined;
          this.oauthAccessToken = undefined;
          this.oauthAccessTokenExpiresAt = undefined;
        }

        res.on('data', (chunk) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          const body = Buffer.concat(chunks).toString();

          if (body) {
            resolve(body);
          } else {
            reject(new Error('Failed read body'));
          }
        });

        res.on('error', (error) => {
          reject(error);
        });
      });

      if (requestBody !== undefined) {
        req.write(requestBody);
      }

      req.end();
    });
  }

  private getBasicClientAuth(): string {
    const base64ClientCredentials = Buffer
        .from(`${this.clientCredentials.clientId}:${this.clientCredentials.clientSecret}`)
        .toString('base64');

    return `Basic ${base64ClientCredentials}`;
  }

  public async getApps(): Promise<AppData[]> {
    const jwt = await this.getDelegatedJWT();
    const options = this.buildOptions('/api/v1/app/me', {
      method: 'GET',
      hostname: 'apps-api.athom.com',
      headers: {
        'authorization': `Bearer ${jwt}`,
      },
    });

    return this.request(options).then((body: string) => {
      return JSON.parse(body);
    });
  }

  private buildOptions(path: string, customOptions: Partial<RequestOptions>): RequestOptions {
    return {
      ...this.defaultOptions,
      path,
      ...customOptions,
      headers: {
        ...this.defaultOptions.headers,
        ...customOptions.headers,
      },
    };
  }

  private hasCachedToken() {
    return this.oauthAccessToken !== undefined
        && this.oauthAccessTokenExpiresAt !== undefined
        && this.oauthAccessTokenExpiresAt > new Date();
  }

  private hasCachedDelegatedJWT() {
    return this.delegatedJWT !== undefined;
  }
}

export default AthomApi;
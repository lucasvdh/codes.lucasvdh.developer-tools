import type WidgetData from "./widget-data";
import type {Activity, Point} from "./widget-data";

/** What the overview driver needs from its devices during repair. */
export interface OrganizationScope {
  getOrganizationIds(): string[] | undefined;
  setOrganizationIds(organizationIds: string[]): Promise<void>;
}

/** What the dashboard widgets read from an App overview device. */
export interface OverviewWidgetSource {
  getId(): string;
  getWidgetData(): ReturnType<WidgetData['getWidgetData']>;
  getInstallHistory(rangeMs: number): Point[];
  getAthomTotalHistory(rangeMs: number): Point[];
  getAthomAppInstallHistory(appId: string, rangeMs: number): Point[];
  getAppInstallHistory(appId: string, rangeMs: number): Point[];
  getTotalGrowth(rangeMs: number): number | null;
  getAppGrowth(appId: string, rangeMs: number): number | null;
  getRecentChanges(rangeMs: number, limit: number): Activity[];
}

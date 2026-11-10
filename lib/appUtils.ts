import {AppData} from "./AthomApi";
import {PatEntry} from "./PatStore";

export function appName(appData: AppData, fallback: string = 'Unknown'): string {
  return appData.liveBuild?.name?.en ?? appData.testBuild?.name?.en ?? fallback;
}

export function ownerLabelFor(entry: PatEntry): string {
  return entry.label || entry.username || entry.email || `Account ${entry.id.slice(0, 6)}`;
}

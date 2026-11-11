export interface DeviceData {
  id: string;
}

export interface SettingsInput {
  newSettings: NewSettings;
  changedKeys: Array<string>;
}

export interface NewSettings {
}

export interface DeviceSettings {
}

export interface DeviceStorage {
  id: string;
  pat_id?: string;
}

export interface Device {
  name: string;
  data: DeviceData;
  // Homey reads `store` when the device is added during pairing.
  store: DeviceStorage;
  settings?: DeviceSettings;
}
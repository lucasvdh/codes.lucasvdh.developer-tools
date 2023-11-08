export interface InverterData {
  inverterName: string;
  currentPower: number;
  currentVoltage: number;
  dailyProduction: number;
  currentTemperature: number;
}

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
  id: string
}

export interface Device {
  name: string;
  data: DeviceData;
  storage: DeviceStorage;
  settings?: DeviceSettings;
}
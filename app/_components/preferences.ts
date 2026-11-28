import AsyncStorage from "@react-native-async-storage/async-storage";

export const REFRESH_INTERVAL_KEY = "netguard.refresh.interval.v1";
export const DEVICE_NAMES_KEY = "netguard.device.names.v1";
export const REFRESH_INTERVALS = [5, 10, 30, 60] as const;
export type RefreshInterval = (typeof REFRESH_INTERVALS)[number];
export type DeviceNameOverrides = Record<string, string>;

export const readRefreshInterval = async (): Promise<RefreshInterval> => {
  const stored = await AsyncStorage.getItem(REFRESH_INTERVAL_KEY);
  const seconds = Number(stored);
  return REFRESH_INTERVALS.find((option) => option === seconds) ?? 30;
};

export const saveRefreshInterval = async (seconds: RefreshInterval): Promise<void> => {
  await AsyncStorage.setItem(REFRESH_INTERVAL_KEY, String(seconds));
};

export const readDeviceNames = async (): Promise<DeviceNameOverrides> => {
  const stored = await AsyncStorage.getItem(DEVICE_NAMES_KEY);
  if (!stored) return {};
  const parsed: unknown = JSON.parse(stored);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Saved device names are invalid");
  }
  return Object.fromEntries(
    Object.entries(parsed).filter((entry): entry is [string, string] =>
      typeof entry[0] === "string" && typeof entry[1] === "string"
    ),
  );
};

export const saveDeviceName = async (ipAddress: string, name: string | null): Promise<DeviceNameOverrides> => {
  const names = await readDeviceNames();
  if (name?.trim()) names[ipAddress] = name.trim();
  else delete names[ipAddress];
  await AsyncStorage.setItem(DEVICE_NAMES_KEY, JSON.stringify(names));
  return names;
};

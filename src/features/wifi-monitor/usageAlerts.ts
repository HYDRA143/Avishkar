import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { AppState, Platform } from "react-native";
import {
  calculateUsageTotals,
  counterDelta,
  evaluateUsageAlerts,
  type UsageAlert,
  type UsageAlertSettings,
  type UsageSample,
} from "./usageMetrics";

const TASK_NAME = "netguard-uno-usage-monitor";
const NOTIFICATION_CHANNEL = "netguard-usage-alerts";
const SETTINGS_KEY = "netguard.usage.settings.v1";
const SAMPLES_KEY = "netguard.usage.samples.v1";
const COUNTERS_KEY = "netguard.usage.counters.v1";
const ALERTS_KEY = "netguard.usage.alerts.v1";
const ERROR_KEY = "netguard.usage.monitor-error.v1";
const SAMPLE_INTERVAL_MS = 60_000;
const HISTORY_RETENTION_MS = 8 * 24 * 60 * 60 * 1000;
const MAX_SAMPLES = 11_000;
const MAX_ALERTS = 50;

export interface UsageAlertRecord extends UsageAlert {}

export interface UsageMonitorState {
  settings: UsageAlertSettings;
  totals: ReturnType<typeof calculateUsageTotals>;
  recentAlerts: ReadonlyArray<UsageAlertRecord>;
  lastSampleAt: number | null;
  lastGapMs: number | null;
  sampleCount: number;
  notificationsGranted: boolean;
  backgroundSupported: boolean;
  backgroundRegistered: boolean;
  lastError: string | null;
}

interface InterfaceCounters {
  at: number;
  receivedBytes: number;
  transmittedBytes: number;
}

interface JsonRecord {
  [key: string]: unknown;
}

export const DEFAULT_USAGE_ALERT_SETTINGS: UsageAlertSettings = {
  enabled: false,
  hourlyCapBytes: null,
  dailyCapBytes: null,
  weeklyCapBytes: null,
  anomalyEnabled: true,
  anomalyMultiplier: 2,
};

const record = (value: unknown): JsonRecord | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;

const messageFrom = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const readStoredJson = async <T>(key: string, label: string): Promise<T | null> => {
  const value = await AsyncStorage.getItem(key);
  if (value === null) return null;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`${label} could not be read from local storage`, { cause: error });
  }
};

const validateSettings = (value: unknown): UsageAlertSettings => {
  const settings = record(value);
  if (
    !settings
    || typeof settings.enabled !== "boolean"
    || typeof settings.anomalyEnabled !== "boolean"
    || typeof settings.anomalyMultiplier !== "number"
    || !Number.isFinite(settings.anomalyMultiplier)
    || settings.anomalyMultiplier < 1
  ) {
    throw new Error("Usage alert settings are invalid");
  }

  const cap = (candidate: unknown, label: string): number | null => {
    if (candidate === null) return null;
    if (!Number.isSafeInteger(candidate) || (candidate as number) <= 0) {
      throw new Error(`${label} must be a positive whole number of bytes`);
    }
    return candidate as number;
  };

  return {
    enabled: settings.enabled,
    anomalyEnabled: settings.anomalyEnabled,
    anomalyMultiplier: settings.anomalyMultiplier,
    hourlyCapBytes: cap(settings.hourlyCapBytes, "Hourly cap"),
    dailyCapBytes: cap(settings.dailyCapBytes, "Daily cap"),
    weeklyCapBytes: cap(settings.weeklyCapBytes, "Weekly cap"),
  };
};

const readSettings = async (): Promise<UsageAlertSettings> => {
  const stored = await readStoredJson<unknown>(SETTINGS_KEY, "Usage alert settings");
  return stored === null ? DEFAULT_USAGE_ALERT_SETTINGS : validateSettings(stored);
};

const readSamples = async (): Promise<UsageSample[]> => {
  const stored = await readStoredJson<unknown>(SAMPLES_KEY, "Usage history");
  if (stored === null) return [];
  if (!Array.isArray(stored)) throw new Error("Usage history has an invalid format");
  return stored.map((item): UsageSample => {
    const sample = record(item);
    if (
      !sample
      || !Number.isSafeInteger(sample.at)
      || !Number.isSafeInteger(sample.bytes)
      || (sample.at as number) < 0
      || (sample.bytes as number) < 0
      || typeof sample.gapMs !== "number"
      || !Number.isFinite(sample.gapMs)
      || sample.gapMs < 0
    ) {
      throw new Error("Usage history contains an invalid sample");
    }
    return {
      at: sample.at as number,
      bytes: sample.bytes as number,
      gapMs: sample.gapMs,
    };
  });
};

const readCounters = async (): Promise<InterfaceCounters | null> => {
  const stored = await readStoredJson<unknown>(COUNTERS_KEY, "Interface counter baseline");
  if (stored === null) return null;
  const counters = record(stored);
  if (
    !counters
    || !Number.isSafeInteger(counters.at)
    || !Number.isSafeInteger(counters.receivedBytes)
    || !Number.isSafeInteger(counters.transmittedBytes)
    || (counters.at as number) < 0
    || (counters.receivedBytes as number) < 0
    || (counters.transmittedBytes as number) < 0
  ) {
    throw new Error("Interface counter baseline has an invalid format");
  }
  return {
    at: counters.at as number,
    receivedBytes: counters.receivedBytes as number,
    transmittedBytes: counters.transmittedBytes as number,
  };
};

const readAlerts = async (): Promise<UsageAlertRecord[]> => {
  const stored = await readStoredJson<unknown>(ALERTS_KEY, "Usage alert history");
  if (stored === null) return [];
  if (!Array.isArray(stored)) throw new Error("Usage alert history has an invalid format");
  return stored.map((item): UsageAlertRecord => {
    const alert = record(item);
    if (
      !alert
      || typeof alert.id !== "string"
      || typeof alert.title !== "string"
      || typeof alert.body !== "string"
      || typeof alert.at !== "number"
      || !Number.isFinite(alert.at)
      || !["hourly", "daily", "weekly", "anomaly"].includes(String(alert.period))
    ) {
      throw new Error("Usage alert history contains an invalid entry");
    }
    return {
      id: alert.id,
      period: alert.period as UsageAlert["period"],
      title: alert.title,
      body: alert.body,
      at: alert.at,
    };
  });
};

const runtimeConfig = (): { baseUrl: string; apiKey: string } => {
  const runtime = globalThis as typeof globalThis & {
    __NETGUARD_CONFIG__?: { apiBaseUrl?: string; apiKey?: string };
  };
  return {
    baseUrl: (
      runtime.__NETGUARD_CONFIG__?.apiBaseUrl
      ?? process.env.EXPO_PUBLIC_API_BASE_URL
      ?? ""
    ).replace(/\/$/, ""),
    apiKey: runtime.__NETGUARD_CONFIG__?.apiKey
      ?? process.env.EXPO_PUBLIC_NETGUARD_API_KEY
      ?? "",
  };
};

const fetchUnoCounters = async (): Promise<Omit<InterfaceCounters, "at">> => {
  const { baseUrl, apiKey } = runtimeConfig();
  if (!baseUrl || !apiKey) throw new Error("Mobile API configuration is missing");
  const response = await fetch(`${baseUrl}/api/usage`, {
    headers: { "x-api-key": apiKey },
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const error = record(payload)?.error;
    throw new Error(typeof error === "string" ? error : `Usage request failed (${response.status})`);
  }

  const interfaces = record(payload)?.interfaces;
  if (!Array.isArray(interfaces)) throw new Error("Usage API returned no interface counters");
  const wlan = interfaces.map(record).find((item) => item?.interface === "wlan0");
  const receivedBytes = wlan?.received_bytes;
  const transmittedBytes = wlan?.transmitted_bytes;
  if (
    !Number.isSafeInteger(receivedBytes)
    || !Number.isSafeInteger(transmittedBytes)
    || (receivedBytes as number) < 0
    || (transmittedBytes as number) < 0
  ) {
    throw new Error("Uno wlan0 counters are unavailable; per-device usage is not measured");
  }
  return {
    receivedBytes: receivedBytes as number,
    transmittedBytes: transmittedBytes as number,
  };
};

let storageQueue: Promise<void> = Promise.resolve();

const serializeStorage = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = storageQueue.then(operation, operation);
  storageQueue = result.then(() => undefined, () => undefined);
  return result;
};

const persistMonitorError = async (error: unknown): Promise<void> => {
  const message = messageFrom(error, "Usage monitoring failed");
  await AsyncStorage.setItem(ERROR_KEY, message);
};

const notify = async (alert: UsageAlert): Promise<void> => {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Usage limit reached, but local notification permission is not granted");
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
      name: "Usage alerts",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: alert.title,
      body: alert.body,
      data: { alertId: alert.id },
      sound: "default",
    },
    trigger: Platform.OS === "android" ? { channelId: NOTIFICATION_CHANNEL } : null,
  });
};

export const saveUsageAlertSettings = async (
  settings: UsageAlertSettings,
): Promise<void> => {
  const validated = validateSettings(settings);
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(validated));
};

export const requestUsageNotificationPermission = async (): Promise<void> => {
  if (Platform.OS === "web") {
    throw new Error("Local device notifications require the Android or iOS app");
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
      name: "Usage alerts",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  }
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error("Notification permission was not granted");
  await reconcileBackgroundTask();
};

export const reconcileBackgroundTask = async (): Promise<boolean> => {
  if (Platform.OS === "web") return false;
  const settings = await readSettings();
  const permission = await Notifications.getPermissionsAsync();
  const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (!settings.enabled || !permission.granted) {
    if (registered) await BackgroundTask.unregisterTaskAsync(TASK_NAME);
    return false;
  }
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  if (registered) return true;
  await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: 15 });
  return true;
};

export const sampleUsageNow = async (): Promise<void> => {
  const settings = await readSettings();
  if (!settings.enabled) return;
  const current = { ...(await fetchUnoCounters()), at: Date.now() };

  await serializeStorage(async () => {
    const previous = await readCounters();
    const oldSamples = await readSamples();
    const history = await readAlerts();
    if (previous && current.at <= previous.at) {
      throw new Error("Usage sample time did not advance");
    }

    const gapMs = previous ? current.at - previous.at : 0;
    const bytes = previous
      ? counterDelta(previous.receivedBytes, current.receivedBytes)
        + counterDelta(previous.transmittedBytes, current.transmittedBytes)
      : 0;
    if (!Number.isSafeInteger(bytes)) throw new Error("Usage counter delta exceeded the safe range");

    const samples = [
      ...oldSamples.filter((sample) => sample.at >= current.at - HISTORY_RETENTION_MS),
      { at: current.at, bytes, gapMs },
    ].slice(-MAX_SAMPLES);
    await AsyncStorage.setItem(SAMPLES_KEY, JSON.stringify(samples));
    await AsyncStorage.setItem(COUNTERS_KEY, JSON.stringify(current));

    const alerts = evaluateUsageAlerts(
      samples,
      settings,
      current.at,
      new Set(history.map((alert) => alert.id)),
    );
    const delivered: UsageAlertRecord[] = [];
    for (const alert of alerts) {
      await notify(alert);
      delivered.push(alert);
    }
    if (delivered.length > 0) {
      await AsyncStorage.setItem(
        ALERTS_KEY,
        JSON.stringify([...delivered.reverse(), ...history].slice(0, MAX_ALERTS)),
      );
    }
    await AsyncStorage.removeItem(ERROR_KEY);
  });
};

export const getUsageMonitorState = async (now = Date.now()): Promise<UsageMonitorState> => {
  const [settings, samples, counters, recentAlerts, lastError] = await Promise.all([
    readSettings(),
    readSamples(),
    readCounters(),
    readAlerts(),
    AsyncStorage.getItem(ERROR_KEY),
  ]);
  const notificationsGranted = Platform.OS !== "web"
    && (await Notifications.getPermissionsAsync()).granted;
  const backgroundStatus = Platform.OS === "web"
    ? BackgroundTask.BackgroundTaskStatus.Restricted
    : await BackgroundTask.getStatusAsync();
  const backgroundRegistered = Platform.OS !== "web"
    && await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  return {
    settings,
    totals: calculateUsageTotals(samples, now),
    recentAlerts,
    lastSampleAt: counters?.at ?? null,
    lastGapMs: samples.at(-1)?.gapMs ?? null,
    sampleCount: samples.length,
    notificationsGranted,
    backgroundSupported: backgroundStatus === BackgroundTask.BackgroundTaskStatus.Available,
    backgroundRegistered,
    lastError,
  };
};

export const startUsageMonitor = (): (() => void) => {
  const sample = async (): Promise<void> => {
    if (AppState.currentState !== "active") return;
    try {
      await sampleUsageNow();
    } catch (error) {
      console.error("NetGuard usage sample failed", error);
      try {
        await persistMonitorError(error);
      } catch (storageError) {
        console.error("NetGuard could not save the usage monitoring error", storageError);
      }
    }
  };

  void reconcileBackgroundTask().catch(async (error: unknown) => {
    console.error("NetGuard background usage monitoring could not start", error);
    try {
      await persistMonitorError(error);
    } catch (storageError) {
      console.error("NetGuard could not save the background monitoring error", storageError);
    }
  });
  void sample();
  const interval = setInterval(() => void sample(), SAMPLE_INTERVAL_MS);
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") void sample();
  });
  return () => {
    clearInterval(interval);
    subscription.remove();
  };
};

TaskManager.defineTask(TASK_NAME, async ({ error }) => {
  if (error) {
    await persistMonitorError(error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
  try {
    await sampleUsageNow();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (caught) {
    console.error("NetGuard background usage sample failed", caught);
    await persistMonitorError(caught);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

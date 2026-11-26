import { useEffect, useState } from "react";

export interface Device {
  id: string;
  name: string;
  address?: string;
  connected?: boolean;
}

export interface UsagePoint {
  timestamp: string;
  bytes: number;
  deviceId?: string;
}

export interface DeviceUsageState {
  loading: boolean;
  devices: ReadonlyArray<Device>;
  usage: ReadonlyArray<UsagePoint>;
  error: string | null;
}

type JsonObject = Record<string, unknown>;

const getRuntimeConfig = (): { apiBaseUrl: string; apiKey: string } => {
  const runtime = (globalThis as typeof globalThis & {
    __NETGUARD_CONFIG__?: { apiBaseUrl?: string; apiKey?: string };
  });
  return {
    apiBaseUrl: runtime.__NETGUARD_CONFIG__?.apiBaseUrl
      ?? process.env.EXPO_PUBLIC_API_BASE_URL
      ?? "",
    apiKey: runtime.__NETGUARD_CONFIG__?.apiKey
      ?? process.env.EXPO_PUBLIC_NETGUARD_API_KEY
      ?? "",
  };
};

const asObject = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : null;

const asArray = (value: unknown): ReadonlyArray<unknown> =>
  Array.isArray(value) ? value : [];

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const readPayload = (payload: unknown): ReadonlyArray<unknown> => {
  const object = asObject(payload);
  return asArray(object?.devices ?? object?.data ?? payload);
};

const parseDevices = (payload: unknown): ReadonlyArray<Device> =>
  readPayload(payload).flatMap((value) => {
    const object = asObject(value);
    const id = asString(object?.id ?? object?.deviceId);
    const name = asString(object?.name ?? object?.hostname ?? object?.label);
    const connected = typeof object?.connected === "boolean" ? object.connected : undefined;
    return id && name
      ? [{ id, name, address: asString(object?.address ?? object?.ip), connected }]
      : [];
  });

const parseUsage = (payload: unknown): ReadonlyArray<UsagePoint> => {
  const object = asObject(payload);
  return asArray(object?.usage ?? object?.data ?? payload).flatMap((value) => {
    const item = asObject(value);
    const timestamp = asString(item?.timestamp ?? item?.time ?? item?.recordedAt);
    const bytes = asNumber(item?.bytes ?? item?.totalBytes ?? item?.usageBytes);
    return timestamp && bytes !== undefined
      ? [{ timestamp, bytes, deviceId: asString(item?.deviceId ?? item?.device_id) }]
      : [];
  });
};

const fetchJson = async (url: string, key: string, signal: AbortSignal): Promise<unknown> => {
  const response = await fetch(url, { headers: { "x-api-key": key }, signal });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = asString(asObject(body)?.error) ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return body;
};

export const useDeviceUsage = (
  deviceId?: string,
): DeviceUsageState => {
  const [state, setState] = useState<DeviceUsageState>({
    loading: true,
    devices: [],
    usage: [],
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    const load = async (): Promise<void> => {
      setState({ loading: true, devices: [], usage: [], error: null });
      const { apiBaseUrl, apiKey } = getRuntimeConfig();
      try {
        if (!apiBaseUrl || !apiKey) {
          throw new Error("Mobile API configuration is missing");
        }
        const base = apiBaseUrl.replace(/\/$/, "");
        const usagePath = deviceId
          ? `/api/usage?deviceId=${encodeURIComponent(deviceId)}`
          : "/api/usage";
        const [devicesBody, usageBody] = await Promise.all([
          fetchJson(`${base}/api/devices`, apiKey, controller.signal),
          fetchJson(`${base}${usagePath}`, apiKey, controller.signal),
        ]);
        if (!controller.signal.aborted) {
          setState({
            loading: false,
            devices: parseDevices(devicesBody),
            usage: parseUsage(usageBody),
            error: null,
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            loading: false,
            devices: [],
            usage: [],
            error: error instanceof Error ? error.message : "Unable to load device usage",
          });
        }
      }
    };

    void load();
    return () => controller.abort();
  }, [deviceId]);

  return state;
};

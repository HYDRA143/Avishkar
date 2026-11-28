import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, Stack } from "expo-router";
import { recordUnoUsage } from "./deviceUsageHistory";
import { AppHeader, AppIcon, COLORS, ErrorCard, LoadingSkeleton, NetworkLineGraph, type MaterialIconName } from "./_components/design";

export type DeviceInfo = {
  id: string;
  ipAddress: string;
  macAddress: string;
  reachable: boolean | null;
  identity: DeviceIdentity;
};

export type DeviceCategory = "uno" | "gateway" | "phone" | "unknown";
export type DeviceType =
  | "Uno Gateway Monitor"
  | "Gateway / Hotspot Router"
  | "Phone"
  | "Unknown Client";

export type DeviceIdentity = {
  name: string;
  type: DeviceType;
  iconLetter: string;
  source: string;
  category: DeviceCategory;
};

export type BandwidthInfo = {
  receivedBytes: number;
  sentBytes: number;
  interfaceName: string;
} | null;

type SpeedPoint = {
  down: number;
  up: number;
  time: number;
};

type PreviousBandwidth = {
  rx: number;
  tx: number;
  time: number;
};

type DashboardData = {
  loading: boolean;
  error: string | null;
  monitorReady: boolean | null;
  devices: ReadonlyArray<DeviceInfo>;
  bandwidth: BandwidthInfo;
  speed: SpeedPoint | null;
  speedHistory: ReadonlyArray<SpeedPoint>;
};

type RecordValue = Record<string, unknown>;

export const apiConfig = (): { base: string; key: string } => {
  const runtime = globalThis as typeof globalThis & {
    __NETGUARD_CONFIG__?: { apiBaseUrl?: string; apiKey?: string };
  };
  return {
    base: (runtime.__NETGUARD_CONFIG__?.apiBaseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, ""),
    key: runtime.__NETGUARD_CONFIG__?.apiKey ?? process.env.EXPO_PUBLIC_NETGUARD_API_KEY ?? "",
  };
};

const asRecord = (value: unknown): RecordValue | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as RecordValue
    : null;

const stringField = (record: RecordValue, ...keys: string[]): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const numberField = (record: RecordValue, ...keys: string[]): number | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  }
  return null;
};

const entriesFrom = (payload: unknown, key: string): ReadonlyArray<unknown> => {
  const record = asRecord(payload);
  const value = record?.[key] ?? record?.data ?? payload;
  if (Array.isArray(value)) return value;
  const nested = asRecord(value);
  const entries = nested?.[key] ?? nested?.data;
  return Array.isArray(entries) ? entries : [];
};

const KNOWN_DEVICE_IDENTITIES: ReadonlyArray<{
  ip: string;
  mac: string;
  identity: DeviceIdentity;
}> = [
  {
    ip: "192.168.137.65",
    mac: "14:b5:cd:f2:0a:19",
    identity: {
      name: "NETGUARD-UNO-01",
      type: "Uno Gateway Monitor",
      iconLetter: "U",
      source: "Main Network - Laptop Hotspot",
      category: "uno",
    },
  },
  {
    ip: "192.168.137.1",
    mac: "56:bb:b5:35:8f:ba",
    identity: {
      name: "GATEWAY-HOTSPOT-01",
      type: "Gateway / Hotspot Router",
      iconLetter: "G",
      source: "Main Network - 192.168.137.1",
      category: "gateway",
    },
  },
  {
    ip: "192.168.137.29",
    mac: "0c:f3:46:e6:95:d9",
    identity: {
      name: "PHONE-01",
      type: "Phone",
      iconLetter: "P",
      source: "Main Network - Laptop Hotspot",
      category: "phone",
    },
  },
];

export const getDeviceIdentity = (ip: string, mac: string): DeviceIdentity => {
  const known = KNOWN_DEVICE_IDENTITIES.find((device) =>
    device.ip === ip.trim() && device.mac === mac.trim().toLowerCase()
  );
  if (known) return known.identity;

  const lastOctet = ip.trim().split(".").at(-1) ?? "";
  return {
    name: lastOctet ? `DEVICE-${lastOctet}` : "DEVICE-UNKNOWN",
    type: "Unknown Client",
    iconLetter: lastOctet.charAt(0) || "?",
    source: "Main Network",
    category: "unknown",
  };
};

export const deviceCategoryColor = (category: DeviceCategory): { background: string; border: string; text: string } => {
  switch (category) {
    case "uno":
      return { background: "rgba(59,130,246,0.18)", border: "rgba(96,165,250,0.42)", text: "#93C5FD" };
    case "gateway":
      return { background: "rgba(249,115,22,0.16)", border: "rgba(251,146,60,0.4)", text: "#FDBA74" };
    case "phone":
      return { background: "rgba(34,197,94,0.16)", border: "rgba(74,222,128,0.4)", text: "#86EFAC" };
    case "unknown":
      return { background: "rgba(148,163,184,0.13)", border: "rgba(148,163,184,0.3)", text: "#CBD5E1" };
  }
};

export const remoteSourceLabel = (baseUrl: string): string => {
  if (!baseUrl) return "Remote source unavailable";
  try {
    const url = new URL(baseUrl);
    const source = url.hostname.endsWith(".trycloudflare.com")
      ? "Cloudflare Tunnel"
      : "Remote API";
    return `${source} - ${url.toString().replace(/\/$/, "")}`;
  } catch {
    return `Remote API - ${baseUrl}`;
  }
};

export const parseDevices = (payload: unknown): ReadonlyArray<DeviceInfo> =>
  entriesFrom(payload, "devices").flatMap((value): ReadonlyArray<DeviceInfo> => {
    const record = asRecord(value);
    if (!record) return [];
    const ipAddress = stringField(record, "ip_address", "ip", "address");
    const macAddress = stringField(record, "mac_address", "mac");
    if (!ipAddress && !macAddress) return [];
    return [{
      id: ipAddress || macAddress,
      ipAddress,
      macAddress,
      reachable: typeof record.reachable === "boolean" ? record.reachable : null,
      identity: getDeviceIdentity(ipAddress, macAddress),
    }];
  });

const bandwidthCounters = (value: unknown): Omit<NonNullable<BandwidthInfo>, "interfaceName"> | null => {
  const record = asRecord(value);
  if (!record) return null;
  const receivedBytes = numberField(record, "received_bytes", "rx_bytes");
  const sentBytes = numberField(record, "transmitted_bytes", "sent_bytes", "tx_bytes");
  if (receivedBytes === null || sentBytes === null) return null;
  return { receivedBytes, sentBytes };
};

export const parseBandwidth = (payload: unknown): BandwidthInfo => {
  const data = asRecord(payload);
  const bandwidth = asRecord(data?.bandwidth);
  const interfaceEntries = Array.isArray(bandwidth?.interfaces)
    ? bandwidth.interfaces
    : Array.isArray(data?.interfaces)
      ? data.interfaces
      : [];
  const wlanEntry = interfaceEntries.find((entry) => {
    const record = asRecord(entry);
    const name = stringField(record ?? {}, "name", "interface", "iface");
    return name === "wlan0";
  });
  const source = bandwidth?.wlan0 ?? wlanEntry ?? data?.wlan0;
  const counters = bandwidthCounters(source);
  if (!counters) return null;
  const sourceRecord = asRecord(source);
  const interfaceName = stringField(sourceRecord ?? {}, "name", "interface", "iface") || "wlan0";
  return { interfaceName, ...counters };
};

export function DeviceRow({ device, divider = false }: { device: DeviceInfo; divider?: boolean }) {
  const color = deviceCategoryColor(device.identity.category);
  const icon: MaterialIconName = device.identity.category === "uno"
    ? "security"
    : device.identity.category === "gateway"
      ? "router"
      : device.identity.category === "phone"
        ? "smartphone"
        : "device-unknown";
  const row = (
    <Pressable
      style={({ pressed }) => [
        styles.deviceRow,
        divider && styles.rowDivider,
        { backgroundColor: color.background, borderColor: color.border },
        pressed && styles.deviceRowPressed,
      ]}
      accessibilityRole={device.ipAddress ? "button" : undefined}
      accessibilityLabel={`${device.identity.name}, ${device.identity.type}`}
      disabled={!device.ipAddress}
    >
      <View style={[styles.deviceAvatar, { backgroundColor: color.background, borderColor: color.border }]}>
        <AppIcon name={icon} size={22} color={color.text} />
      </View>
      <View style={styles.deviceCopy}>
        <View style={styles.deviceTitleRow}>
          <Text style={styles.deviceName}>{device.identity.name}</Text>
          <View style={styles.deviceStatusWrap}>
            {device.reachable === null ? null : <AppIcon name={device.reachable ? "check-circle" : "error"} size={15} color={device.reachable ? COLORS.green : COLORS.red} />}
            <Text style={[styles.deviceStatus, device.reachable === true && styles.deviceOnline, device.reachable === false && styles.deviceOffline]}>
              {device.reachable === null ? "Status unavailable" : device.reachable ? "Online" : "Offline"}
            </Text>
          </View>
        </View>
        <Text style={styles.deviceAddress}>{device.ipAddress || "IP not reported"}</Text>
        <Text style={styles.deviceMac}>{device.macAddress || "MAC not reported"}</Text>
        <Text style={[styles.deviceType, { color: color.text }]}>{device.identity.type}</Text>
        <Text style={styles.deviceSource}>{device.identity.source}</Text>
      </View>
      {device.ipAddress ? <AppIcon name="arrow-forward" size={18} color={COLORS.secondary} /> : null}
    </Pressable>
  );
  if (!device.ipAddress) return row;
  return (
    <Link href={{ pathname: "/device/[id]", params: { id: device.ipAddress } }} asChild>
      {row}
    </Link>
  );
}

const speedForInterval = (
  current: NonNullable<BandwidthInfo>,
  previous: PreviousBandwidth | null,
  time: number,
): SpeedPoint | null => {
  if (!previous) return null;
  const seconds = (time - previous.time) / 1000;
  if (seconds <= 0) return null;
  return {
    down: Math.max(0, current.receivedBytes - previous.rx) / seconds,
    up: Math.max(0, current.sentBytes - previous.tx) / seconds,
    time,
  };
};

export const fetchJson = async (url: string, key: string, signal: AbortSignal): Promise<unknown> => {
  const response = await fetch(url, { headers: { "x-api-key": key }, signal });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = stringField(asRecord(body) ?? {}, "error");
    throw new Error(message || `Request failed with status ${response.status}`);
  }
  return body;
};

export const formatBytes = (bytes: number | null): string => {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
};

export const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond >= 1024 ** 2) return `${(bytesPerSecond / 1024 ** 2).toFixed(1)} MB/s`;
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
};

function Dashboard({ refreshKey, onRefresh }: { refreshKey: number; onRefresh: () => void }) {
  const [data, setData] = useState<DashboardData>({
    loading: true,
    error: null,
    monitorReady: null,
    devices: [],
    bandwidth: null,
    speed: null,
    speedHistory: [],
  });
  const previousBandwidth = useRef<PreviousBandwidth | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async (): Promise<void> => {
      const { base, key } = apiConfig();
      if (!base || !key) {
        setData({
          loading: false,
          error: "Mobile API configuration is missing",
          monitorReady: null,
          devices: [],
          bandwidth: null,
          speed: null,
          speedHistory: [],
        });
        return;
      }
      setData((current) => ({ ...current, loading: current.bandwidth === null, error: null }));
      try {
        const [status, devices, bandwidth] = await Promise.all([
          fetchJson(`${base}/api/status`, key, controller.signal),
          fetchJson(`${base}/api/devices`, key, controller.signal),
          fetchJson(`${base}/api/usage`, key, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        const statusRecord = asRecord(status);
        const guard = asRecord(statusRecord?.guard);
        const currentBandwidth = parseBandwidth(bandwidth);
        const now = Date.now();
        if (currentBandwidth) recordUnoUsage(currentBandwidth, now);
        const sample = currentBandwidth
          ? speedForInterval(currentBandwidth, previousBandwidth.current, now)
          : null;
        if (currentBandwidth) {
          previousBandwidth.current = {
            rx: currentBandwidth.receivedBytes,
            tx: currentBandwidth.sentBytes,
            time: now,
          };
        }
        setData((current) => ({
          ...current,
          loading: false,
          error: null,
          monitorReady: typeof guard?.ready === "boolean" ? guard.ready : null,
          devices: parseDevices(devices),
          bandwidth: currentBandwidth,
          speed: sample,
          speedHistory: sample
            ? [...current.speedHistory, sample].slice(-7)
            : current.speedHistory,
        }));
      } catch (error) {
        if (!controller.signal.aborted) {
          setData((current) => ({
            ...current,
            loading: false,
            error: error instanceof Error ? error.message : "Unable to load network data",
            monitorReady: null,
          }));
        }
      }
    };
    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [refreshKey]);

  const sentBytes = data.bandwidth?.sentBytes ?? null;
  const totalBytes = data.bandwidth
    ? data.bandwidth.receivedBytes + data.bandwidth.sentBytes
    : null;
  const actions: ReadonlyArray<{ href: "/graph" | "/reports" | "/status" | "/alerts" | "/settings"; icon: MaterialIconName; title: string; subtitle: string }> = [
    { href: "/graph", icon: "show-chart", title: "Usage graph", subtitle: "Explore live traffic" },
    { href: "/reports", icon: "assessment", title: "Reports", subtitle: "Review network snapshots" },
    { href: "/status", icon: "devices", title: "System status", subtitle: "Inspect monitor health" },
    { href: "/alerts", icon: "notifications-active", title: "Usage alerts", subtitle: "Set hourly, daily, and weekly caps" },
    { href: "/settings", icon: "settings", title: "Settings", subtitle: "Manage local preferences" },
  ];
  const { base } = apiConfig();
  const gateway = data.devices.find((device) => device.identity.category === "gateway");
  const networkSource = gateway
    ? `Main Network ${gateway.ipAddress}`
    : "Main Network · gateway not identified";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <AppHeader liveStatus={data.error ? "OFFLINE" : data.loading ? "SYNCING" : data.bandwidth ? "LIVE" : "IDLE"} />
        <Text style={styles.intro}>Your network, monitored and in view.</Text>

        {data.error ? <ErrorCard title="Live data unavailable" message={data.error} onRetry={onRefresh} /> : null}

        <View style={styles.hero}>
          <View style={styles.usageHeading}>
            <AppIcon name="data-usage" size={22} color={COLORS.blue} />
            <Text style={styles.usageTitle}>Total Usage</Text>
            <View style={styles.liveTag}>
              <View style={[styles.liveDot, data.speed && data.speed.down + data.speed.up > 0 ? styles.liveDotActive : styles.liveDotIdle]} />
              <Text style={[styles.liveText, data.speed && data.speed.down + data.speed.up > 0 ? styles.liveTextActive : styles.liveTextIdle]}>
                {data.speed ? data.speed.down + data.speed.up > 0 ? "LIVE" : "IDLE" : "WAITING"}
              </Text>
            </View>
          </View>
          <Text style={styles.usageValueLarge}>{totalBytes === null ? data.loading ? "Loading…" : "No data" : formatBytes(totalBytes)}</Text>
          <Text style={styles.heroDetail}>Uno wlan0 cumulative total · not per-device</Text>
          <View style={styles.heroRule} />
          <View style={styles.liveSpeedRow}>
            <View style={styles.liveSpeedLabelRow}>
              <AppIcon name="speed" size={18} color={COLORS.gold} />
              <Text style={styles.liveSpeedLabel}>Live speed</Text>
            </View>
            <Text style={styles.speedValue}>
              {data.speed === null
                ? data.bandwidth ? "Measuring…" : "No data"
                : data.speed.down === 0 && data.speed.up === 0
                  ? "Idle"
                  : formatSpeed(data.speed.down + data.speed.up)}
            </Text>
          </View>
          <Text style={styles.guardStatus}>
            Guard status: {data.loading ? "Checking…" : data.monitorReady === null ? "Unavailable" : data.monitorReady ? "Ready" : "Not ready"}
          </Text>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <View style={styles.sectionTitleRow}>
              <AppIcon name="devices" size={19} color={COLORS.gold} />
              <Text style={styles.sectionTitle}>Devices</Text>
            </View>
            <Text style={styles.sectionCaption}>
              {data.devices.length} discovered · per-device usage unavailable
            </Text>
          </View>
          <View style={styles.liveTag}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
        </View>
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceBadgeText}>Source: {networkSource} | Remote: {remoteSourceLabel(base)}</Text>
        </View>
        <View style={styles.card}>
          {data.devices.length > 0 ? data.devices.map((device, index) => (
            <DeviceRow key={device.id} device={device} divider={index > 0} />
          )) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><AppIcon name="devices" size={23} color={COLORS.gold} /></View>
              <Text style={styles.emptyTitle}>{data.loading ? "Scanning device inventory" : "No devices reporting"}</Text>
              <Text style={styles.emptyBody}>
                {data.loading
                  ? "Your live device list will appear here."
                  : "When the gateway reports devices, they’ll appear here."}
              </Text>
              {data.loading ? <LoadingSkeleton lines={2} /> : null}
            </View>
          )}
        </View>
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Live Network</Text>
            <Text style={styles.sectionCaption}>Last 7 samples · ~30s · speed in KB/s · Uno wlan0</Text>
          </View>
          <AppIcon name="show-chart" size={21} color={COLORS.gold} />
        </View>
        <View style={styles.card}>
          {data.speedHistory.length > 0 ? (
            <NetworkLineGraph
              values={data.speedHistory.map((point) => point.down + point.up)}
              labels={data.speedHistory.map((point) => new Date(point.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}
            />
          ) : (
            <Text style={styles.chartUnavailable}>No measured speed intervals yet.</Text>
          )}
        </View>
        <View style={styles.scopeNotice}>
          <Text style={styles.scopeNoticeTitle}>Device usage is not available yet</Text>
          <Text style={styles.scopeNoticeBody}>
            This Uno monitors Wi-Fi as a client. The list above is device discovery only; bandwidth totals measure Uno's wlan0 interface, not each phone or laptop.
          </Text>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Bandwidth</Text>
            <Text style={styles.sectionCaption}>Real interface counters from this Uno device</Text>
          </View>
        </View>
        <View style={styles.card}>
          <View style={styles.bandwidthTotals}>
            <View style={styles.usageTotalBlock}>
              <Text style={styles.usageLabel}>UNO WLAN TOTAL</Text>
              <Text style={styles.usageValue}>
                {totalBytes === null ? "No data" : formatBytes(totalBytes)}
              </Text>
            </View>
            <View style={styles.speedBlock}>
              <Text style={styles.usageLabel}>LIVE SPEED</Text>
              <Text style={styles.speedValue}>
                {data.speed === null
                  ? data.bandwidth ? "Measuring…" : "No data"
                  : data.speed.down === 0 && data.speed.up === 0
                    ? "Idle"
                    : `${formatSpeed(data.speed.down)} Down • ${formatSpeed(data.speed.up)} Up`}
              </Text>
            </View>
          </View>
          {data.bandwidth ? (
            <View style={styles.bandwidthList}>
              <View style={styles.interfaceRow}>
                <View style={styles.interfaceLine}>
                  <Text style={styles.interfaceName}>{data.bandwidth.interfaceName}</Text>
                  <Text style={styles.interfaceBytes}>
                    {formatBytes(data.bandwidth.receivedBytes + data.bandwidth.sentBytes)} total
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: "100%" }]} />
                </View>
                {sentBytes !== null ? (
                  <View style={styles.interfaceTotals}>
                    <Text style={styles.interfaceBytes}>Down {formatBytes(data.bandwidth.receivedBytes)}</Text>
                    <Text style={styles.interfaceBytes}>Up {formatBytes(data.bandwidth.sentBytes)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.chartEmpty}>
              <Text style={styles.emptyBody}>
                {data.loading ? "Loading gateway counters…" : "Bandwidth counters aren’t available yet."}
              </Text>
              {data.loading ? <ActivityIndicator color={palette.cyan} /> : null}
            </View>
          )}
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Quick access</Text>
            <Text style={styles.sectionCaption}>Network tools at a glance</Text>
          </View>
        </View>
        <View style={styles.actionsGrid}>
          {actions.map((action) => (
            <Link key={action.href} href={action.href} asChild>
              <Pressable style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
                <View style={styles.actionTop}>
                  <View style={styles.actionIcon}><AppIcon name={action.icon} size={20} color={COLORS.gold} /></View>
                  <AppIcon name="arrow-forward" size={17} color={COLORS.secondary} />
                </View>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionCaption}>{action.subtitle}</Text>
              </Pressable>
            </Link>
          ))}
        </View>

        <Pressable
          onPress={onRefresh}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.refreshPressed]}
          accessibilityRole="button"
          accessibilityLabel="Refresh network data"
        >
          <AppIcon name="refresh" size={22} color={COLORS.white} />
          <View style={styles.refreshCopy}>
            <Text style={styles.refreshTitle}>Refresh network data</Text>
            <Text style={styles.refreshCaption}>Fetch the latest device and traffic telemetry</Text>
          </View>
          <AppIcon name="arrow-forward" size={18} color={COLORS.white} />
        </Pressable>
        <Text style={styles.footer}>NETGUARD · PRIVATE BY DESIGN</Text>
      </View>
    </ScrollView>
  );
}

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Dashboard refreshKey={refreshKey} onRefresh={() => setRefreshKey((key) => key + 1)} />
    </>
  );
}

const palette = {
  background: COLORS.background,
  surface: COLORS.card,
  border: COLORS.border,
  white: COLORS.white,
  secondary: COLORS.secondary,
  muted: COLORS.secondary,
  indigo: COLORS.blue,
  cyan: COLORS.gold,
  green: COLORS.green,
  red: COLORS.red,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  page: { alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 38 },
  content: { width: "100%", maxWidth: 820 },
  header: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: {
    width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(26,86,219,0.2)", borderWidth: 1, borderColor: "rgba(26,86,219,0.4)",
  },
  brandMarkText: { color: palette.cyan, fontSize: 20, fontWeight: "800" },
  brandTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandTitle: { color: palette.white, fontSize: 17, fontWeight: "700" },
  proBadge: {
    overflow: "hidden", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5,
    color: "#BFDBFE", backgroundColor: "rgba(26,86,219,0.18)", fontSize: 12, fontWeight: "800", letterSpacing: 0.8,
  },
  brandCaption: { marginTop: 4, color: palette.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1.4 },
  statusPill: {
    minHeight: 32, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10,
    borderRadius: 99, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: palette.border,
  },
  statusOnline: { backgroundColor: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.26)" },
  statusOffline: { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.22)" },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#F59E0B" },
  statusDotOnline: { backgroundColor: palette.green },
  statusDotOffline: { backgroundColor: palette.red },
  statusText: { color: palette.secondary, fontSize: 12, fontWeight: "800", letterSpacing: 0.7 },
  intro: { marginTop: 18, marginBottom: 18, color: palette.secondary, fontSize: 12 },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 13, marginBottom: 16,
    borderRadius: 14, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)",
  },
  errorMark: { color: "#FCA5A5", fontSize: 19, fontWeight: "800" },
  errorCopy: { flex: 1 },
  errorTitle: { color: "#FCA5A5", fontSize: 12, fontWeight: "700" },
  errorMessage: { marginTop: 3, color: palette.secondary, fontSize: 12, lineHeight: 18 },
  scopeNotice: {
    padding: 13, marginTop: 10, borderRadius: 14, backgroundColor: "rgba(245,158,11,0.07)",
    borderWidth: 1, borderColor: "rgba(245,158,11,0.18)",
  },
  scopeNoticeTitle: { color: COLORS.orange, fontSize: 14, fontWeight: "700" },
  scopeNoticeBody: { marginTop: 5, color: palette.secondary, fontSize: 12, lineHeight: 18 },
  hero: {
    overflow: "hidden", padding: 20, borderRadius: 16, backgroundColor: COLORS.darkBlue,
    borderWidth: 1, borderColor: "rgba(26,86,219,0.42)", shadowColor: COLORS.blue,
    shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 7,
  },
  heroGlow: {
    position: "absolute", top: -105, right: -40, width: 220, height: 220, borderRadius: 110,
    backgroundColor: "rgba(26,86,219,0.12)",
  },
  usageHeading: { flexDirection: "row", alignItems: "center", gap: 9 },
  usageTitle: { flex: 1, color: palette.white, fontSize: 17, fontWeight: "700" },
  usageValueLarge: { marginTop: 16, color: palette.white, fontSize: 34, fontWeight: "800" },
  heroRule: { height: 1, marginTop: 18, backgroundColor: "rgba(148,163,184,0.2)" },
  liveSpeedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14 },
  liveSpeedLabelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  liveSpeedLabel: { color: palette.secondary, fontSize: 13, fontWeight: "600" },
  guardStatus: { marginTop: 12, color: palette.secondary, fontSize: 12 },
  liveDotActive: { backgroundColor: COLORS.gold },
  liveDotIdle: { backgroundColor: COLORS.orange },
  liveTextActive: { color: COLORS.gold },
  liveTextIdle: { color: COLORS.orange },
  eyebrow: { color: COLORS.secondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  heroMain: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 15, paddingVertical: 19 },
  heroStatus: { color: palette.white, fontSize: 31, fontWeight: "800", letterSpacing: -0.8 },
  heroDetail: { marginTop: 6, color: palette.secondary, fontSize: 12 },
  gatewayOrb: {
    width: 78, height: 78, borderRadius: 39, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(26,86,219,0.1)", borderWidth: 1, borderColor: "rgba(26,86,219,0.4)",
  },
  gatewayOrbCore: {
    width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(26,86,219,0.25)", borderWidth: 1, borderColor: "rgba(26,86,219,0.5)",
  },
  gatewayOrbOnline: { backgroundColor: "rgba(16,185,129,0.2)", borderColor: "rgba(52,211,153,0.5)" },
  gatewayGlyph: { color: palette.cyan, fontSize: 27, fontWeight: "700" },
  statRow: { minHeight: 61, flexDirection: "row", alignItems: "center", paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" },
  stat: { flex: 1, gap: 5 },
  statValue: { color: palette.white, fontSize: 16, fontWeight: "800" },
  statLabel: { color: palette.secondary, fontSize: 11, fontWeight: "700", letterSpacing: 0.75 },
  statDivider: { width: 1, height: 28, marginHorizontal: 10, backgroundColor: "rgba(255,255,255,0.12)" },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 24, marginBottom: 11 },
  sectionTitle: { color: palette.white, fontSize: 16, fontWeight: "700" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionCaption: { marginTop: 4, color: palette.muted, fontSize: 12 },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(245,179,1,0.1)" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold },
  liveText: { color: COLORS.gold, fontSize: 12, fontWeight: "800", letterSpacing: 0.7 },
  card: { padding: 16, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  deviceRow: { minHeight: 90, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 10, paddingVertical: 12, marginVertical: 4, borderRadius: 14, borderWidth: 1 },
  deviceRowPressed: { opacity: 0.78 },
  rowDivider: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  deviceAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  deviceCopy: { flex: 1, minWidth: 0 },
  deviceTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 7 },
  deviceName: { color: "#F1F5F9", fontSize: 14, fontWeight: "700" },
  deviceAddress: { marginTop: 4, color: palette.secondary, fontSize: 12 },
  deviceMac: { marginTop: 3, color: palette.muted, fontSize: 12 },
  deviceType: { marginTop: 4, fontSize: 12, fontWeight: "700" },
  deviceSource: { marginTop: 3, color: palette.muted, fontSize: 12 },
  deviceStatusWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  deviceStatus: { color: palette.muted, fontSize: 12, fontWeight: "700" },
  deviceOnline: { color: "#6EE7B7" },
  deviceOffline: { color: "#FCA5A5" },
  sourceBadge: { padding: 12, marginBottom: 10, borderRadius: 12, backgroundColor: COLORS.darkBlue, borderWidth: 1, borderColor: "rgba(26,86,219,0.4)" },
  sourceBadgeText: { color: "#DBEAFE", fontSize: 12, lineHeight: 18 },
  emptyState: { minHeight: 158, alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  emptyIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(99,102,241,0.15)" },
  emptyGlyph: { color: "#A5B4FC", fontSize: 23 },
  emptyTitle: { marginTop: 11, color: "#E2E8F0", fontSize: 12, fontWeight: "700" },
  emptyBody: { maxWidth: 260, marginTop: 5, color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  emptyLoader: { marginTop: 11 },
  bandwidthTotals: { gap: 14, paddingTop: 16 },
  usageTotalBlock: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  usageLabel: { color: palette.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  usageValue: { color: palette.white, fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  speedBlock: { gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  speedValue: { color: "#C7D2FE", fontSize: 14, fontWeight: "700" },
  bandwidthList: { gap: 14, paddingTop: 16, paddingBottom: 15 },
  interfaceRow: { gap: 6 },
  interfaceLine: { flexDirection: "row", justifyContent: "space-between" },
  interfaceTotals: { flexDirection: "row", justifyContent: "space-between", marginTop: 3 },
  interfaceName: { color: palette.secondary, fontSize: 12, fontWeight: "600" },
  interfaceBytes: { color: palette.muted, fontSize: 12 },
  progressTrack: { height: 5, overflow: "hidden", borderRadius: 4, backgroundColor: "rgba(148,163,184,0.12)" },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: palette.indigo },
  chartEmpty: { minHeight: 116, alignItems: "center", justifyContent: "center", gap: 12 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  action: { width: "48.5%", minHeight: 122, padding: 16, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  actionPressed: { backgroundColor: "#17264A", borderColor: "rgba(26,86,219,0.5)" },
  actionTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(26,86,219,0.19)", borderWidth: 1, borderColor: "rgba(26,86,219,0.28)" },
  actionTitle: { color: "#F1F5F9", fontSize: 14, fontWeight: "700" },
  actionCaption: { marginTop: 5, color: palette.muted, fontSize: 12, lineHeight: 16 },
  refreshButton: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, marginTop: 22, borderRadius: 12, backgroundColor: COLORS.blue, borderWidth: 1, borderColor: COLORS.blue, shadowColor: palette.indigo, shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  refreshPressed: { opacity: 0.82 },
  refreshCopy: { flex: 1 },
  refreshTitle: { color: palette.white, fontSize: 14, fontWeight: "700" },
  refreshCaption: { marginTop: 3, color: "#DBEAFE", fontSize: 12 },
  footer: { marginTop: 23, color: palette.secondary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2, textAlign: "center" },
  chartUnavailable: { minHeight: 160, padding: 16, color: palette.secondary, fontSize: 13, textAlign: "center", textAlignVertical: "center" },
});

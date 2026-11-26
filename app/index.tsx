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

type DeviceInfo = {
  id: string;
  name: string;
  avatarLetter: string;
  ipAddress: string;
  macAddress: string;
};

type BandwidthInfo = {
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
  gatewayReady: boolean | null;
  devices: ReadonlyArray<DeviceInfo>;
  bandwidth: BandwidthInfo;
  speed: SpeedPoint | null;
  speedHistory: ReadonlyArray<SpeedPoint>;
};

type RecordValue = Record<string, unknown>;

const apiConfig = (): { base: string; key: string } => {
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
    if (record[key] === undefined || record[key] === null) continue;
    return Number.parseFloat(String(record[key])) || 0;
  }
  return null;
};

const stringFromLine = (line: string, field: string): string => {
  const match = new RegExp(`${field}\\s*=\\s*['"]([^'"]*)['"]`).exec(line);
  return match?.[1]?.trim() ?? "";
};

const numberFromLine = (line: string, ...fields: string[]): number | null => {
  for (const field of fields) {
    const match = new RegExp(`${field}\\s*=\\s*([0-9]+(?:\\.[0-9]+)?)`).exec(line);
    if (match) return Number.parseFloat(String(match[1])) || 0;
  }
  return null;
};

const entriesFrom = (payload: unknown, key: string): ReadonlyArray<unknown> => {
  const record = asRecord(payload);
  const nested = record?.[key] ?? record?.data;
  const value = nested ?? payload;
  return Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
};

const getDeviceName = (ipAddress: string): { name: string; avatarLetter: string } => {
  if (ipAddress === "192.168.137.1") return { name: "Gateway • Laptop Hotspot", avatarLetter: "G" };
  if (ipAddress === "192.168.137.29") return { name: "Phone", avatarLetter: "P" };
  if (ipAddress === "192.168.137.65") return { name: "Uno Q • NetGuard", avatarLetter: "U" };
  const octets = ipAddress.split(".");
  const lastOctet = octets[octets.length - 1] ?? "";
  return { name: `Device • .${lastOctet}`, avatarLetter: "D" };
};

const parseDevices = (payload: unknown): ReadonlyArray<DeviceInfo> =>
  entriesFrom(payload, "devices").flatMap((value): ReadonlyArray<DeviceInfo> => {
    if (typeof value === "string") {
      const matches = [...value.matchAll(/Device\s*\(([^)]*)\)/g)];
      const lines = matches.length > 0 ? matches.map((match) => match[1]) : [value];
      return lines.flatMap((line): ReadonlyArray<DeviceInfo> => {
        const ipAddress = stringFromLine(line, "ip_address");
        const macAddress = stringFromLine(line, "mac_address");
        if (!ipAddress && !macAddress) return [];
        return [{ id: `${ipAddress}-${macAddress}`, ...getDeviceName(ipAddress), ipAddress, macAddress }];
      });
    }
    const record = asRecord(value);
    if (!record) return [];
    const ipAddress = stringField(record, "ip_address", "ip", "address");
    const macAddress = stringField(record, "mac_address", "mac");
    if (!ipAddress && !macAddress) return [];
    return [{ id: `${ipAddress}-${macAddress}`, ...getDeviceName(ipAddress), ipAddress, macAddress }];
  });

const bandwidthCounters = (value: unknown): Omit<NonNullable<BandwidthInfo>, "interfaceName"> | null => {
  const record = asRecord(value);
  if (typeof value === "string") {
    const line = [...value.matchAll(/InterfaceBandwidth\s*\(([^)]*)\)/g)][0]?.[1] ?? value;
    const received = numberFromLine(line, "received_bytes", "rx_bytes");
    const sent = numberFromLine(line, "transmitted_bytes", "sent_bytes", "tx_bytes");
    return received === null && sent === null
      ? null
      : { receivedBytes: received ?? 0, sentBytes: sent ?? 0 };
  }
  if (!record) return null;
  const receivedBytes = numberField(record, "received_bytes", "rx_bytes");
  const sentBytes = numberField(record, "transmitted_bytes", "sent_bytes", "tx_bytes");
  if (receivedBytes === null && sentBytes === null) return null;
  return { receivedBytes: receivedBytes ?? 0, sentBytes: sentBytes ?? 0 };
};

const parseBandwidth = (payload: unknown): BandwidthInfo => {
  const data = asRecord(payload);
  const bandwidth = asRecord(data?.bandwidth);
  const interfaceEntries = Array.isArray(data?.interfaces) ? data.interfaces : [];
  const firstInterface = asRecord(interfaceEntries[0]);
  const firstInterfaceIsWlan = firstInterface?.name === undefined || firstInterface.name === "wlan0";
  const wlan = bandwidthCounters(bandwidth?.wlan0)
    ?? (firstInterfaceIsWlan ? bandwidthCounters(interfaceEntries[0]) : null)
    ?? bandwidthCounters(data?.wlan0);
  return wlan ? { interfaceName: "wlan0", ...wlan } : null;
};

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

const fetchJson = async (url: string, key: string, signal: AbortSignal): Promise<unknown> => {
  const response = await fetch(url, { headers: { "x-api-key": key }, signal });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = stringField(asRecord(body) ?? {}, "error");
    throw new Error(message || `Request failed with status ${response.status}`);
  }
  return body;
};

const formatBytes = (bytes: number | null): string => {
  if (bytes === null) return "—";
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
};

const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond >= 1024 ** 2) return `${(bytesPerSecond / 1024 ** 2).toFixed(1)} MB/s`;
  return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;
};

function Dashboard({ refreshKey, onRefresh }: { refreshKey: number; onRefresh: () => void }) {
  const [data, setData] = useState<DashboardData>({
    loading: true,
    error: null,
    gatewayReady: null,
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
          gatewayReady: null,
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
          gatewayReady: typeof guard?.ready === "boolean" ? guard.ready : false,
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
            gatewayReady: null,
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

  const receivedBytes = data.bandwidth?.receivedBytes ?? null;
  const sentBytes = data.bandwidth?.sentBytes ?? null;
  const actions = [
    { href: "/graph" as const, glyph: "⌁", title: "Usage graph", subtitle: "Explore live traffic" },
    { href: "/reports" as const, glyph: "▤", title: "Reports", subtitle: "Review network snapshots" },
    { href: "/status" as const, glyph: "◎", title: "System status", subtitle: "Inspect protection health" },
    { href: "/settings" as const, glyph: "⚙", title: "Settings", subtitle: "Manage local preferences" },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>N</Text></View>
            <View>
              <View style={styles.brandTitleRow}>
                <Text style={styles.brandTitle}>NetGuard</Text>
                <Text style={styles.proBadge}>PROTECTED</Text>
              </View>
              <Text style={styles.brandCaption}>NETWORK INTELLIGENCE</Text>
            </View>
          </View>
          <View style={[
            styles.statusPill,
            data.gatewayReady === true && styles.statusOnline,
            data.gatewayReady === false && !data.loading && styles.statusOffline,
          ]}>
            {data.loading
              ? <ActivityIndicator size="small" color={palette.cyan} />
              : <View style={[
                styles.statusDot,
                data.gatewayReady === true && styles.statusDotOnline,
                data.gatewayReady === false && styles.statusDotOffline,
              ]} />}
            <Text style={styles.statusText}>
              {data.loading ? "SYNCING" : data.gatewayReady === true ? "ONLINE" : "OFFLINE"}
            </Text>
          </View>
        </View>

        <Text style={styles.intro}>Your network, protected and in view.</Text>

        {data.error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorMark}>!</Text>
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Live data unavailable</Text>
              <Text style={styles.errorMessage}>{data.error}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.eyebrow}>GATEWAY STATUS</Text>
          <View style={styles.heroMain}>
            <View>
              <Text style={styles.heroStatus}>
                {data.loading ? "Connecting" : data.gatewayReady === true ? "Online" : "Offline"}
              </Text>
              <Text style={styles.heroDetail}>
                {data.loading ? "Checking your gateway…" : "Status confirmed by the gateway"}
              </Text>
            </View>
            <View style={styles.gatewayOrb}>
              <View style={[
                styles.gatewayOrbCore,
                data.gatewayReady === true && styles.gatewayOrbOnline,
              ]}>
                <Text style={styles.gatewayGlyph}>⌁</Text>
              </View>
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{data.devices.length}</Text>
              <Text style={styles.statLabel}>DEVICES</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{receivedBytes === null ? "No data" : `${formatBytes(receivedBytes)} Down`}</Text>
              <Text style={styles.statLabel}>TOTAL RECEIVED</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{data.bandwidth ? "1" : "No data"}</Text>
              <Text style={styles.statLabel}>{data.bandwidth ? "INTERFACE" : "INTERFACES"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Devices</Text>
            <Text style={styles.sectionCaption}>
              {data.devices.length} {data.devices.length === 1 ? "device" : "devices"} reporting
            </Text>
          </View>
          <View style={styles.liveTag}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
        </View>
        <View style={styles.card}>
          {data.devices.length > 0 ? data.devices.map((device, index) => (
            <View key={device.id} style={[styles.deviceRow, index > 0 && styles.rowDivider]}>
              <View style={styles.deviceAvatar}>
                <Text style={styles.deviceAvatarText}>{device.avatarLetter}</Text>
              </View>
              <View style={styles.deviceCopy}>
                <Text style={styles.deviceName}>{device.name}</Text>
                <Text style={styles.deviceAddress}>{device.ipAddress || "IP not reported"}</Text>
                <Text style={styles.deviceMac}>{device.macAddress || "MAC not reported"}</Text>
              </View>
            </View>
          )) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Text style={styles.emptyGlyph}>⌁</Text></View>
              <Text style={styles.emptyTitle}>{data.loading ? "Scanning device inventory" : "No devices reporting"}</Text>
              <Text style={styles.emptyBody}>
                {data.loading
                  ? "Your live device list will appear here."
                  : "When the gateway reports devices, they’ll appear here."}
              </Text>
              {data.loading ? <ActivityIndicator color={palette.cyan} style={styles.emptyLoader} /> : null}
            </View>
          )}
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Bandwidth</Text>
            <Text style={styles.sectionCaption}>Interface counters reported by your gateway</Text>
          </View>
        </View>
        <View style={styles.card}>
          <View style={styles.bandwidthTotals}>
            <View style={styles.usageTotalBlock}>
              <Text style={styles.usageLabel}>TOTAL DOWN</Text>
              <Text style={styles.usageValue}>
                {receivedBytes === null ? "No data" : `${formatBytes(receivedBytes)} Down`}
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
                  <View style={styles.actionIcon}><Text style={styles.actionGlyph}>{action.glyph}</Text></View>
                  <Text style={styles.actionArrow}>↗</Text>
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
          <Text style={styles.refreshGlyph}>↻</Text>
          <View style={styles.refreshCopy}>
            <Text style={styles.refreshTitle}>Refresh network data</Text>
            <Text style={styles.refreshCaption}>Fetch the latest device and traffic telemetry</Text>
          </View>
          <Text style={styles.refreshArrow}>→</Text>
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
  background: "#080B14",
  surface: "rgba(255,255,255,0.055)",
  border: "rgba(255,255,255,0.09)",
  white: "#FFFFFF",
  secondary: "#94A3B8",
  muted: "#64748B",
  indigo: "#6366F1",
  cyan: "#22D3EE",
  green: "#10B981",
  red: "#EF4444",
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  page: { alignItems: "center", paddingHorizontal: 16, paddingTop: 22, paddingBottom: 38 },
  content: { width: "100%", maxWidth: 820 },
  header: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: {
    width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(99,102,241,0.2)", borderWidth: 1, borderColor: "rgba(129,140,248,0.4)",
  },
  brandMarkText: { color: palette.cyan, fontSize: 20, fontWeight: "800" },
  brandTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandTitle: { color: palette.white, fontSize: 17, fontWeight: "700" },
  proBadge: {
    overflow: "hidden", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5,
    color: "#A5B4FC", backgroundColor: "rgba(99,102,241,0.18)", fontSize: 8, fontWeight: "800", letterSpacing: 0.8,
  },
  brandCaption: { marginTop: 4, color: palette.muted, fontSize: 8, fontWeight: "700", letterSpacing: 1.4 },
  statusPill: {
    minHeight: 32, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10,
    borderRadius: 99, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: palette.border,
  },
  statusOnline: { backgroundColor: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.26)" },
  statusOffline: { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.22)" },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#F59E0B" },
  statusDotOnline: { backgroundColor: palette.green },
  statusDotOffline: { backgroundColor: palette.red },
  statusText: { color: palette.secondary, fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
  intro: { marginTop: 18, marginBottom: 18, color: palette.secondary, fontSize: 12 },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 13, marginBottom: 16,
    borderRadius: 14, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)",
  },
  errorMark: { color: "#FCA5A5", fontSize: 19, fontWeight: "800" },
  errorCopy: { flex: 1 },
  errorTitle: { color: "#FCA5A5", fontSize: 12, fontWeight: "700" },
  errorMessage: { marginTop: 3, color: palette.secondary, fontSize: 10, lineHeight: 15 },
  hero: {
    overflow: "hidden", padding: 20, borderRadius: 22, backgroundColor: "#11162B",
    borderWidth: 1, borderColor: "rgba(129,140,248,0.28)", shadowColor: "#312E81",
    shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 7,
  },
  heroGlow: {
    position: "absolute", top: -105, right: -40, width: 220, height: 220, borderRadius: 110,
    backgroundColor: "rgba(34,211,238,0.075)",
  },
  eyebrow: { color: "#A5B4FC", fontSize: 9, fontWeight: "800", letterSpacing: 1.7 },
  heroMain: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 15, paddingVertical: 19 },
  heroStatus: { color: palette.white, fontSize: 31, fontWeight: "800", letterSpacing: -0.8 },
  heroDetail: { marginTop: 6, color: "#A5B4C7", fontSize: 11 },
  gatewayOrb: {
    width: 78, height: 78, borderRadius: 39, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(99,102,241,0.1)", borderWidth: 1, borderColor: "rgba(34,211,238,0.26)",
  },
  gatewayOrbCore: {
    width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(99,102,241,0.25)", borderWidth: 1, borderColor: "rgba(165,180,252,0.4)",
  },
  gatewayOrbOnline: { backgroundColor: "rgba(16,185,129,0.2)", borderColor: "rgba(52,211,153,0.5)" },
  gatewayGlyph: { color: palette.cyan, fontSize: 27, fontWeight: "700" },
  statRow: { minHeight: 61, flexDirection: "row", alignItems: "center", paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" },
  stat: { flex: 1, gap: 5 },
  statValue: { color: palette.white, fontSize: 16, fontWeight: "800" },
  statLabel: { color: "#8592AB", fontSize: 8, fontWeight: "700", letterSpacing: 0.75 },
  statDivider: { width: 1, height: 28, marginHorizontal: 10, backgroundColor: "rgba(255,255,255,0.12)" },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 24, marginBottom: 11 },
  sectionTitle: { color: palette.white, fontSize: 16, fontWeight: "700" },
  sectionCaption: { marginTop: 4, color: palette.muted, fontSize: 10 },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(16,185,129,0.09)" },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: palette.green },
  liveText: { color: "#6EE7B7", fontSize: 8, fontWeight: "800", letterSpacing: 0.7 },
  card: { paddingHorizontal: 14, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  deviceRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  deviceAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(99,102,241,0.2)", borderWidth: 1, borderColor: "rgba(129,140,248,0.24)" },
  deviceAvatarText: { color: "#C7D2FE", fontSize: 17, fontWeight: "700" },
  deviceCopy: { flex: 1, minWidth: 0 },
  deviceName: { color: "#F1F5F9", fontSize: 12, fontWeight: "700" },
  deviceAddress: { marginTop: 4, color: palette.secondary, fontSize: 10 },
  deviceMac: { marginTop: 3, color: palette.muted, fontSize: 9 },
  emptyState: { minHeight: 158, alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  emptyIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(99,102,241,0.15)" },
  emptyGlyph: { color: "#A5B4FC", fontSize: 23 },
  emptyTitle: { marginTop: 11, color: "#E2E8F0", fontSize: 12, fontWeight: "700" },
  emptyBody: { maxWidth: 260, marginTop: 5, color: palette.muted, fontSize: 10, lineHeight: 15, textAlign: "center" },
  emptyLoader: { marginTop: 11 },
  bandwidthTotals: { gap: 14, paddingTop: 16 },
  usageTotalBlock: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  usageLabel: { color: palette.muted, fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  usageValue: { color: palette.white, fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  speedBlock: { gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  speedValue: { color: "#C7D2FE", fontSize: 12, fontWeight: "700" },
  bandwidthList: { gap: 14, paddingTop: 16, paddingBottom: 15 },
  interfaceRow: { gap: 6 },
  interfaceLine: { flexDirection: "row", justifyContent: "space-between" },
  interfaceTotals: { flexDirection: "row", justifyContent: "space-between", marginTop: 3 },
  interfaceName: { color: palette.secondary, fontSize: 10, fontWeight: "600" },
  interfaceBytes: { color: palette.muted, fontSize: 9 },
  progressTrack: { height: 5, overflow: "hidden", borderRadius: 4, backgroundColor: "rgba(148,163,184,0.12)" },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: palette.indigo },
  chartEmpty: { minHeight: 116, alignItems: "center", justifyContent: "center", gap: 12 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  action: { width: "48.5%", minHeight: 122, padding: 13, borderRadius: 17, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  actionPressed: { backgroundColor: "rgba(255,255,255,0.09)", borderColor: "rgba(129,140,248,0.4)" },
  actionTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  actionIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(99,102,241,0.19)", borderWidth: 1, borderColor: "rgba(129,140,248,0.22)" },
  actionGlyph: { color: "#A5B4FC", fontSize: 18 },
  actionArrow: { color: palette.muted, fontSize: 15 },
  actionTitle: { color: "#F1F5F9", fontSize: 12, fontWeight: "700" },
  actionCaption: { marginTop: 5, color: palette.muted, fontSize: 9, lineHeight: 13 },
  refreshButton: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, marginTop: 22, borderRadius: 17, backgroundColor: "#252A66", borderWidth: 1, borderColor: "rgba(129,140,248,0.38)", shadowColor: palette.indigo, shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  refreshPressed: { opacity: 0.82 },
  refreshGlyph: { color: palette.cyan, fontSize: 24, fontWeight: "600" },
  refreshCopy: { flex: 1 },
  refreshTitle: { color: palette.white, fontSize: 12, fontWeight: "700" },
  refreshCaption: { marginTop: 3, color: "#A5B4C7", fontSize: 9 },
  refreshArrow: { color: "#A5B4FC", fontSize: 17, fontWeight: "600" },
  footer: { marginTop: 23, color: "#475569", fontSize: 8, fontWeight: "700", letterSpacing: 1.6, textAlign: "center" },
});

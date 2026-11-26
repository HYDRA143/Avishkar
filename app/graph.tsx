import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, Stack } from "expo-router";

type Traffic = { down: number; up: number } | null;
type SpeedPoint = { down: number; up: number; time: number };
type PreviousBandwidth = { rx: number; tx: number; time: number };
type Payload = Record<string, unknown>;

const config = (): { base: string; key: string } => {
  const runtime = globalThis as typeof globalThis & {
    __NETGUARD_CONFIG__?: { apiBaseUrl?: string; apiKey?: string };
  };
  return {
    base: (runtime.__NETGUARD_CONFIG__?.apiBaseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, ""),
    key: runtime.__NETGUARD_CONFIG__?.apiKey ?? process.env.EXPO_PUBLIC_NETGUARD_API_KEY ?? "",
  };
};

const record = (value: unknown): Payload | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Payload : null;

const getString = (value: unknown, key: string): string => {
  const field = record(value)?.[key];
  return typeof field === "string" ? field : "";
};

const getNumber = (value: unknown, ...keys: string[]): number | null => {
  const data = record(value);
  for (const key of keys) {
    if (!data || data[key] === undefined || data[key] === null) continue;
    const parsed = Number.parseFloat(String(data[key])) || 0;
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return null;
};

const parseNumber = (line: string, ...keys: string[]): number | null => {
  for (const key of keys) {
    const value = new RegExp(`${key}\\s*=\\s*([0-9]+(?:\\.[0-9]+)?)`).exec(line)?.[1];
    if (value !== undefined) return Number.parseFloat(String(value)) || 0;
  }
  return null;
};

const parseTraffic = (payload: unknown): ReadonlyArray<Traffic> => {
  const data = record(payload);
  const bandwidth = record(data?.bandwidth);
  const interfaces = Array.isArray(data?.interfaces) ? data.interfaces : [];
  const firstInterface = record(interfaces[0]);
  const selected = bandwidth?.wlan0
    ?? (firstInterface?.name === undefined || firstInterface.name === "wlan0" ? interfaces[0] : undefined)
    ?? data?.wlan0;
  if (typeof selected === "string") {
    const matches = [...selected.matchAll(/InterfaceBandwidth\s*\(([^)]*)\)/g)];
    const line = matches[0]?.[1] ?? selected;
    const down = parseNumber(line, "received_bytes", "rx_bytes");
    const up = parseNumber(line, "transmitted_bytes", "sent_bytes", "tx_bytes");
    return down === null && up === null ? [] : [{ down: down ?? 0, up: up ?? 0 }];
  }
  const down = getNumber(selected, "received_bytes", "rx_bytes");
  const up = getNumber(selected, "transmitted_bytes", "sent_bytes", "tx_bytes");
  return down === null && up === null ? [] : [{ down: down ?? 0, up: up ?? 0 }];
};

const formatBytes = (bytes: number | null): string => {
  if (bytes === null) return "—";
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
};

const formatSpeed = (bytesPerSecond: number): string =>
  bytesPerSecond >= 1024 ** 2
    ? `${(bytesPerSecond / 1024 ** 2).toFixed(1)} MB/s`
    : `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;

function GraphScreen({ refreshKey, onRefresh }: { refreshKey: number; onRefresh: () => void }) {
  const [traffic, setTraffic] = useState<Traffic>(null);
  const [speedHistory, setSpeedHistory] = useState<ReadonlyArray<SpeedPoint>>([]);
  const [currentSpeed, setCurrentSpeed] = useState<SpeedPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previousBandwidth = useRef<PreviousBandwidth | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async (): Promise<void> => {
      const { base, key } = config();
      if (!base || !key) {
        setError("Mobile API configuration is missing");
        setLoading(false);
        return;
      }
      setError(null);
      try {
        const response = await fetch(`${base}/api/usage`, {
          headers: { "x-api-key": key },
          signal: controller.signal,
        });
        const body: unknown = await response.json();
        if (!response.ok) throw new Error(getString(body, "error") || `Usage request failed with status ${response.status}`);
        if (!controller.signal.aborted) {
          const counters = parseTraffic(body)[0] ?? null;
          const now = Date.now();
          const previous = previousBandwidth.current;
          const seconds = previous ? (now - previous.time) / 1000 : 0;
          const point = counters && previous && seconds > 0
            ? {
              down: Math.max(0, counters.down - previous.rx) / seconds,
              up: Math.max(0, counters.up - previous.tx) / seconds,
              time: now,
            }
            : null;
          if (counters) {
            previousBandwidth.current = { rx: counters.down, tx: counters.up, time: now };
          } else {
            previousBandwidth.current = null;
          }
          setTraffic(counters);
          setCurrentSpeed(point);
          if (point) setSpeedHistory((current) => [...current, point].slice(-7));
          setLoading(false);
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Unable to load bandwidth");
          setLoading(false);
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

  const down = traffic?.down ?? null;
  const up = traffic?.up ?? null;
  const maximum = Math.max(1, ...speedHistory.map((item) => item.down + item.up));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Link href="/" asChild>
            <Pressable style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable>
          </Link>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>NETGUARD · ANALYTICS</Text>
            <Text style={styles.title}>Usage graph</Text>
          </View>
          <View style={styles.headerMark}><Text style={styles.headerMarkText}>N</Text></View>
        </View>

        <Text style={styles.subtitle}>Live bandwidth counters from your gateway.</Text>
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Usage unavailable</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.eyebrow}>TRANSFER TOTALS</Text>
          <Text style={styles.total}>{down === null ? "No data" : `${formatBytes(down)} Down`}</Text>
          <Text style={styles.totalCaption}>WLAN traffic counters</Text>
          <View style={styles.totalsRow}>
            <View style={styles.totalBlock}>
              <View style={[styles.legendDot, styles.downDot]} />
              <View><Text style={styles.legendLabel}>DOWN TOTAL</Text><Text style={styles.directionValue}>{formatBytes(down)}</Text></View>
            </View>
            <View style={styles.totalBlock}>
              <View style={[styles.legendDot, styles.upDot]} />
              <View><Text style={styles.legendLabel}>UP TOTAL</Text><Text style={styles.directionValue}>{formatBytes(up)}</Text></View>
            </View>
          </View>
          <View style={styles.liveSpeedRow}>
            <Text style={styles.liveSpeedLabel}>LIVE SPEED</Text>
            <Text style={styles.liveSpeedValue}>
              {currentSpeed === null
                ? traffic ? "Measuring…" : "No data"
                : currentSpeed.down === 0 && currentSpeed.up === 0
                  ? "Idle"
                  : `${formatSpeed(currentSpeed.down)} Down • ${formatSpeed(currentSpeed.up)} Up`}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Interface activity</Text>
            <Text style={styles.sectionCaption}>{speedHistory.length} recent speed intervals</Text>
          </View>
          <View style={styles.liveTag}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
        </View>

        <View style={styles.chartCard}>
          {loading && traffic === null ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={palette.cyan} />
              <Text style={styles.emptyTitle}>Loading gateway counters</Text>
            </View>
          ) : traffic === null ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>⌁</Text></View>
              <Text style={styles.emptyTitle}>No WLAN bandwidth data</Text>
              <Text style={styles.emptyCaption}>The gateway has not reported wlan0 counters.</Text>
            </View>
          ) : speedHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={palette.cyan} />
              <Text style={styles.emptyTitle}>Measuring live speed</Text>
              <Text style={styles.emptyCaption}>The next 30-second counter reading will establish the first interval.</Text>
            </View>
          ) : (
            <>
              <View style={styles.chart}>
                {speedHistory.map((item, index) => {
                  const total = item.down + item.up;
                  const height = Math.max(8, (total / maximum) * 100);
                  const upHeight = total === 0 ? 0 : (item.up / maximum) * 100;
                  return (
                    <View key={`${item.time}-${index}`} style={styles.chartColumn}>
                      <Text style={styles.barValue}>{total === 0 ? "Idle" : formatSpeed(total)}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: `${height}%` }]} />
                        {upHeight > 0 ? <View style={[styles.barAccent, { height: `${upHeight}%` }]} /> : null}
                      </View>
                      <Text style={styles.barLabel} numberOfLines={1}>
                        {new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.chartLegend}>
                <View style={[styles.legendDot, styles.downDot]} /><Text style={styles.chartLegendText}>Down speed</Text>
                <View style={[styles.legendDot, styles.upDot]} /><Text style={styles.chartLegendText}>Up speed</Text>
              </View>
            </>
          )}
        </View>

        <Pressable onPress={onRefresh} style={({ pressed }) => [styles.refreshButton, pressed && styles.refreshPressed]}>
          <Text style={styles.refreshGlyph}>↻</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.refreshTitle}>Refresh network data</Text>
            <Text style={styles.refreshCaption}>Fetch the latest device and traffic telemetry</Text>
          </View>
          <Text style={styles.refreshArrow}>→</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default function Graph() {
  const [refreshKey, setRefreshKey] = useState(0);
  return <GraphScreen refreshKey={refreshKey} onRefresh={() => setRefreshKey((key) => key + 1)} />;
}

const palette = { background: "#080B14", white: "#FFFFFF", muted: "#64748B", secondary: "#94A3B8", indigo: "#6366F1", cyan: "#22D3EE" };
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  page: { alignItems: "center", padding: 16, paddingTop: 22, paddingBottom: 36 },
  content: { width: "100%", maxWidth: 820 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  backGlyph: { color: palette.white, fontSize: 28, lineHeight: 31 },
  headerCopy: { flex: 1 },
  kicker: { color: "#A5B4FC", fontSize: 8, fontWeight: "800", letterSpacing: 1.5 },
  title: { marginTop: 3, color: palette.white, fontSize: 23, fontWeight: "800", letterSpacing: -0.5 },
  headerMark: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(99,102,241,0.2)", borderWidth: 1, borderColor: "rgba(129,140,248,0.3)" },
  headerMarkText: { color: palette.cyan, fontWeight: "800", fontSize: 17 },
  subtitle: { marginTop: 14, marginBottom: 19, color: palette.secondary, fontSize: 11 },
  errorCard: { padding: 13, marginBottom: 14, borderRadius: 14, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  errorTitle: { color: "#FCA5A5", fontSize: 12, fontWeight: "700" },
  errorText: { marginTop: 4, color: palette.secondary, fontSize: 10, lineHeight: 15 },
  hero: { overflow: "hidden", padding: 20, borderRadius: 21, backgroundColor: "#11162B", borderWidth: 1, borderColor: "rgba(129,140,248,0.27)" },
  heroGlow: { position: "absolute", top: -90, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(34,211,238,0.07)" },
  eyebrow: { color: "#A5B4FC", fontSize: 8, fontWeight: "800", letterSpacing: 1.5 },
  total: { marginTop: 9, color: palette.white, fontSize: 35, fontWeight: "800", letterSpacing: -1 },
  totalCaption: { marginTop: 3, color: palette.secondary, fontSize: 10 },
  totalsRow: { flexDirection: "row", gap: 34, marginTop: 21, paddingTop: 15, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" },
  liveSpeedRow: { gap: 6, paddingTop: 14, marginTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" },
  liveSpeedLabel: { color: palette.muted, fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  liveSpeedValue: { color: "#C7D2FE", fontSize: 12, fontWeight: "700" },
  totalBlock: { flexDirection: "row", alignItems: "center", gap: 9 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  downDot: { backgroundColor: palette.indigo },
  upDot: { backgroundColor: palette.cyan },
  legendLabel: { color: palette.muted, fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  directionValue: { marginTop: 4, color: "#F1F5F9", fontSize: 16, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 11 },
  sectionTitle: { color: palette.white, fontSize: 15, fontWeight: "700" },
  sectionCaption: { marginTop: 4, color: palette.muted, fontSize: 10 },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(16,185,129,0.09)" },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#10B981" },
  liveText: { color: "#6EE7B7", fontSize: 8, fontWeight: "800", letterSpacing: 0.7 },
  chartCard: { paddingHorizontal: 14, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  chart: { height: 195, flexDirection: "row", alignItems: "flex-end", gap: 7, paddingTop: 22 },
  chartColumn: { flex: 1, minWidth: 0, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  barValue: { maxWidth: "100%", color: palette.muted, fontSize: 8 },
  barTrack: { width: "74%", height: 118, justifyContent: "flex-end", overflow: "hidden", borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomWidth: 1, borderBottomColor: "rgba(148,163,184,0.18)", backgroundColor: "rgba(99,102,241,0.08)" },
  barFill: { width: "100%", borderTopLeftRadius: 7, borderTopRightRadius: 7, backgroundColor: "rgba(99,102,241,0.68)" },
  barAccent: { position: "absolute", bottom: 0, width: "100%", borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: "rgba(34,211,238,0.78)" },
  barLabel: { maxWidth: "100%", color: palette.secondary, fontSize: 8 },
  chartLegend: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 14, marginTop: 7, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  chartLegendText: { marginRight: 9, color: palette.secondary, fontSize: 9 },
  interfaceList: { paddingBottom: 4 },
  interfaceRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  interfaceName: { flex: 1, color: "#E2E8F0", fontSize: 10, fontWeight: "700" },
  interfaceValue: { color: palette.muted, fontSize: 9 },
  emptyState: { minHeight: 230, alignItems: "center", justifyContent: "center", gap: 11 },
  emptyIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "rgba(99,102,241,0.16)" },
  emptyIconText: { color: "#A5B4FC", fontSize: 23 },
  emptyTitle: { color: "#E2E8F0", fontSize: 12, fontWeight: "700" },
  emptyCaption: { maxWidth: 260, color: palette.muted, fontSize: 10, textAlign: "center", lineHeight: 15 },
  refreshButton: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, marginTop: 19, borderRadius: 17, backgroundColor: "#252A66", borderWidth: 1, borderColor: "rgba(129,140,248,0.34)" },
  refreshPressed: { opacity: 0.82 },
  refreshGlyph: { color: palette.cyan, fontSize: 24 },
  refreshTitle: { color: palette.white, fontSize: 12, fontWeight: "700" },
  refreshCaption: { marginTop: 3, color: "#A5B4C7", fontSize: 9 },
  refreshArrow: { color: "#A5B4FC", fontSize: 17 },
});

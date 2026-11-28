import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  apiConfig,
  DeviceRow,
  fetchJson,
  formatBytes,
  formatSpeed,
  parseBandwidth,
  parseDevices,
} from "./index";
import { getUnoUsageHistory, recordUnoUsage, type UnoUsageEntry } from "./deviceUsageHistory";
import { AppHeader, AppIcon, COLORS, ErrorCard, LoadingSkeleton, NetworkLineGraph } from "./_components/design";
import { useAutoRefresh } from "./_components/useAutoRefresh";

type Traffic = { down: number; up: number } | null;
type SpeedPoint = { down: number; up: number; time: number };
type PreviousBandwidth = { rx: number; tx: number; time: number };

function GraphScreen({ refreshKey }: { refreshKey: number }) {
  const [traffic, setTraffic] = useState<Traffic>(null);
  const [speedHistory, setSpeedHistory] = useState<ReadonlyArray<SpeedPoint>>([]);
  const [currentSpeed, setCurrentSpeed] = useState<SpeedPoint | null>(null);
  const [localHistory, setLocalHistory] = useState<ReadonlyArray<UnoUsageEntry>>(getUnoUsageHistory());
  const [devices, setDevices] = useState<ReturnType<typeof parseDevices>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previousBandwidth = useRef<PreviousBandwidth | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async (): Promise<void> => {
      const { base, key } = apiConfig();
      if (!base || !key) {
        setError("Mobile API configuration is missing");
        setLoading(false);
        return;
      }
      setError(null);
      try {
        const [devicePayload, body] = await Promise.all([
          fetchJson(`${base}/api/devices`, key, controller.signal),
          fetchJson(`${base}/api/usage`, key, controller.signal),
        ]);
        if (!controller.signal.aborted) {
          const parsed = parseBandwidth(body);
          const discoveredDevices = parseDevices(devicePayload);
          setDevices(discoveredDevices);
          const counters = parsed
            ? { down: parsed.receivedBytes, up: parsed.sentBytes }
            : null;
          const now = Date.now();
          if (parsed) {
            recordUnoUsage(parsed, now);
            setLocalHistory(getUnoUsageHistory());
          }
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
    return () => {
      controller.abort();
    };
  }, [refreshKey]);

  const down = traffic?.down ?? null;
  const up = traffic?.up ?? null;
  const total = down === null || up === null ? null : down + up;
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom", "left", "right"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader liveStatus={error ? "Disconnected" : traffic ? "Connected - Main Network" : "SYNCING"} />
        <Text style={styles.title}>Usage graph</Text>
        <Text style={styles.subtitle}>Uno wlan0 interface counters only; speed shown in KB/s. Discovered phones and laptops are not individually measured.</Text>
        {error ? <ErrorCard title="Usage unavailable" message={error} /> : null}

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <View style={styles.metricHeading}><AppIcon name="data-usage" color={COLORS.blue} /><Text style={styles.metricLabel}>UNO-ONLY TOTAL</Text></View>
            <Text style={styles.metricValue}>{total === null ? "No data" : formatBytes(total)}</Text>
            <Text style={styles.metricCaption}>Received + transmitted</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={styles.metricHeading}><AppIcon name="speed" color={COLORS.gold} /><Text style={styles.metricLabel}>LIVE SPEED</Text></View>
            <Text style={[styles.metricValue, currentSpeed?.down === 0 && currentSpeed?.up === 0 && styles.idleValue]}>
              {currentSpeed === null
                ? traffic ? "Measuring…" : "No data"
                : currentSpeed.down === 0 && currentSpeed.up === 0
                  ? "Idle"
                  : formatSpeed(currentSpeed.down + currentSpeed.up)}
            </Text>
            <Text style={styles.metricCaption}>Uno wlan0 · not per-device</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Network speed</Text>
            <Text style={styles.sectionCaption}>Last 7 samples · approximately 30-second intervals</Text>
          </View>
          <View style={styles.liveTag}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
        </View>

        <View style={styles.chartCard}>
          {loading && traffic === null ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={palette.gold} />
              <Text style={styles.emptyTitle}>Loading Uno interface counters</Text>
              <LoadingSkeleton lines={3} />
            </View>
          ) : traffic === null ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><AppIcon name="show-chart" size={23} color={palette.gold} /></View>
              <Text style={styles.emptyTitle}>No WLAN bandwidth data</Text>
              <Text style={styles.emptyCaption}>The usage source has not reported Uno wlan0 counters.</Text>
            </View>
          ) : speedHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={palette.gold} />
              <Text style={styles.emptyTitle}>Measuring live speed</Text>
              <Text style={styles.emptyCaption}>The next 30-second counter reading will establish the first interval.</Text>
            </View>
          ) : (
            <>
              <NetworkLineGraph
                values={speedHistory.map((item) => item.down + item.up)}
                labels={speedHistory.map((item) => new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}
                color={COLORS.blue}
              />
              <View style={styles.chartLegend}>
                <View style={[styles.legendDot, styles.totalDot]} /><Text style={styles.chartLegendText}>Total speed</Text>
                <View style={[styles.legendDot, styles.liveDot]} /><Text style={styles.chartLegendText}>Latest live sample</Text>
                <View style={[styles.legendDot, styles.idleDot]} /><Text style={styles.chartLegendText}>Idle</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.devicePanel}>
          <Text style={styles.devicePanelTitle}>Discovered devices</Text>
          {devices.length > 0
            ? devices.map((device, index) => <DeviceRow key={device.id} device={device} divider={index > 0} />)
            : <Text style={styles.devicePanelEmpty}>No real devices reported yet.</Text>}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Recent samples</Text>
            <Text style={styles.sectionCaption}>Last 20 real local Uno interface entries</Text>
          </View>
          <AppIcon name="history" size={20} color={COLORS.gold} />
        </View>
        <View style={styles.historyCard}>
          {localHistory.length > 0 ? localHistory.slice(-20).reverse().map((entry) => (
            <View key={entry.at} style={styles.historyRow}>
              <Text style={styles.historyTime}>{new Date(entry.at).toLocaleTimeString()}</Text>
              <Text style={styles.historyValue}>
                {entry.intervalSpeedBytesPerSecond === null
                  ? "Initial baseline"
                  : `Speed ${formatSpeed(entry.intervalSpeedBytesPerSecond)}`}
              </Text>
            </View>
          )) : <Text style={styles.historyEmpty}>No real samples recorded yet.</Text>}
        </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function Graph() {
  const { refreshKey } = useAutoRefresh();
  return <GraphScreen refreshKey={refreshKey} />;
}

const palette = { background: COLORS.background, white: COLORS.white, muted: COLORS.secondary, secondary: COLORS.secondary, indigo: COLORS.blue, cyan: COLORS.gold, blue: COLORS.blue, gold: COLORS.gold };
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  page: { alignItems: "center", padding: 16, paddingTop: 16, paddingBottom: 36 },
  content: { width: "100%", maxWidth: 820 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  backGlyph: { color: palette.white, fontSize: 28, lineHeight: 31 },
  headerCopy: { flex: 1 },
  kicker: { color: "#A5B4FC", fontSize: 8, fontWeight: "800", letterSpacing: 1.5 },
  title: { marginTop: 0, marginBottom: 8, color: palette.white, fontSize: 23, fontWeight: "800", letterSpacing: -0.5 },
  headerMark: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(99,102,241,0.2)", borderWidth: 1, borderColor: "rgba(129,140,248,0.3)" },
  headerMarkText: { color: palette.cyan, fontWeight: "800", fontSize: 17 },
  subtitle: { marginTop: 14, marginBottom: 19, color: palette.secondary, fontSize: 12 },
  devicePanel: { padding: 16, marginBottom: 14, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  devicePanelTitle: { marginBottom: 10, color: "#E2E8F0", fontSize: 14, fontWeight: "700" },
  devicePanelEmpty: { paddingVertical: 12, color: palette.muted, fontSize: 12 },
  errorCard: { padding: 13, marginBottom: 14, borderRadius: 14, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  errorTitle: { color: "#FCA5A5", fontSize: 12, fontWeight: "700" },
  errorText: { marginTop: 4, color: palette.secondary, fontSize: 12, lineHeight: 18 },
  hero: { overflow: "hidden", padding: 20, borderRadius: 16, backgroundColor: COLORS.darkBlue, borderWidth: 1, borderColor: "rgba(26,86,219,0.35)" },
  heroGlow: { position: "absolute", top: -90, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(34,211,238,0.07)" },
  eyebrow: { color: "#A5B4FC", fontSize: 8, fontWeight: "800", letterSpacing: 1.5 },
  total: { marginTop: 9, color: palette.white, fontSize: 35, fontWeight: "800", letterSpacing: -1 },
  totalCaption: { marginTop: 3, color: palette.secondary, fontSize: 12 },
  totalsRow: { flexDirection: "row", gap: 34, marginTop: 21, paddingTop: 15, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" },
  liveSpeedRow: { gap: 6, paddingTop: 14, marginTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" },
  liveSpeedLabel: { color: palette.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  liveSpeedValue: { color: "#C7D2FE", fontSize: 12, fontWeight: "700" },
  totalBlock: { flexDirection: "row", alignItems: "center", gap: 9 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  downDot: { backgroundColor: palette.indigo },
  upDot: { backgroundColor: palette.cyan },
  totalDot: { backgroundColor: COLORS.blue },
  idleDot: { backgroundColor: COLORS.orange },
  legendLabel: { color: palette.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  directionValue: { marginTop: 4, color: "#F1F5F9", fontSize: 16, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 11 },
  sectionTitle: { color: palette.white, fontSize: 15, fontWeight: "700" },
  sectionCaption: { marginTop: 4, color: palette.muted, fontSize: 12 },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(16,185,129,0.09)" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold },
  liveText: { color: COLORS.gold, fontSize: 12, fontWeight: "800", letterSpacing: 0.7 },
  chartCard: { padding: 16, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  chart: { height: 195, flexDirection: "row", alignItems: "flex-end", gap: 7, paddingTop: 22 },
  chartColumn: { flex: 1, minWidth: 0, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  barValue: { maxWidth: "100%", color: palette.muted, fontSize: 12 },
  barTrack: { width: "74%", height: 118, justifyContent: "flex-end", overflow: "hidden", borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomWidth: 1, borderBottomColor: "rgba(148,163,184,0.18)", backgroundColor: "rgba(99,102,241,0.08)" },
  barFill: { width: "100%", borderTopLeftRadius: 7, borderTopRightRadius: 7, backgroundColor: "rgba(99,102,241,0.68)" },
  barAccent: { position: "absolute", bottom: 0, width: "100%", borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: "rgba(34,211,238,0.78)" },
  barLabel: { maxWidth: "100%", color: palette.secondary, fontSize: 12 },
  chartLegend: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 14, marginTop: 7, borderTopWidth: 1, borderTopColor: COLORS.border },
  chartLegendText: { marginRight: 9, color: palette.secondary, fontSize: 12 },
  interfaceList: { paddingBottom: 4 },
  interfaceRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  interfaceName: { flex: 1, color: "#E2E8F0", fontSize: 12, fontWeight: "700" },
  interfaceValue: { color: palette.muted, fontSize: 12 },
  emptyState: { minHeight: 230, alignItems: "center", justifyContent: "center", gap: 11 },
  emptyIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "rgba(26,86,219,0.16)" },
  emptyIconText: { color: "#A5B4FC", fontSize: 23 },
  emptyTitle: { color: "#E2E8F0", fontSize: 12, fontWeight: "700" },
  emptyCaption: { maxWidth: 260, color: palette.muted, fontSize: 12, textAlign: "center", lineHeight: 18 },
  metricsRow: { flexDirection: "row", gap: 12, marginBottom: 18 },
  metricCard: { flex: 1, minWidth: 0, gap: 8, padding: 16, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  metricHeading: { flexDirection: "row", alignItems: "center", gap: 7 },
  metricLabel: { color: palette.secondary, fontSize: 12, fontWeight: "700" },
  metricValue: { color: palette.white, fontSize: 18, fontWeight: "800" },
  metricCaption: { color: palette.secondary, fontSize: 12 },
  idleValue: { color: COLORS.orange },
  historyCard: { paddingHorizontal: 16, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  historyRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  historyTime: { color: palette.secondary, fontSize: 12 },
  historyValue: { marginTop: 4, color: palette.white, fontSize: 13 },
  historyEmpty: { paddingVertical: 16, color: palette.secondary, fontSize: 13 },
});

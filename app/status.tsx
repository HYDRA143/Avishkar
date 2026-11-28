import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, Stack } from "expo-router";
import {
  apiConfig,
  DeviceRow,
  fetchJson,
  formatBytes,
  parseBandwidth,
  parseDevices,
  type DeviceInfo,
  type BandwidthInfo,
} from "./index";

type StatusData = {
  loading: boolean;
  error: string | null;
  devices: ReadonlyArray<DeviceInfo>;
  bandwidth: BandwidthInfo;
  fetchSucceeded: boolean;
};

function StatusView({ refreshKey, onRefresh }: { refreshKey: number; onRefresh: () => void }) {
  const [state, setState] = useState<StatusData>({
    loading: true,
    error: null,
    devices: [],
    bandwidth: null,
    fetchSucceeded: false,
  });

  useEffect(() => {
    const controller = new AbortController();
    const load = async (): Promise<void> => {
      const { base, key } = apiConfig();
      if (!base || !key) {
        setState({
          loading: false,
          error: "Mobile API configuration is missing",
          devices: [],
          bandwidth: null,
          fetchSucceeded: false,
        });
        return;
      }
      setState((current) => ({ ...current, error: null }));
      try {
        const [devicePayload, usage] = await Promise.all([
          fetchJson(`${base}/api/devices`, key, controller.signal),
          fetchJson(`${base}/api/usage`, key, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        const devices = parseDevices(devicePayload);
        setState({
          loading: false,
          error: null,
          devices,
          bandwidth: parseBandwidth(usage),
          fetchSucceeded: true,
        });
      } catch (caught) {
        if (!controller.signal.aborted) {
          setState({
            loading: false,
            error: caught instanceof Error ? caught.message : "Unable to load system status",
            devices: [],
            bandwidth: null,
            fetchSucceeded: false,
          });
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

  const totalBandwidth = state.bandwidth
    ? state.bandwidth.receivedBytes + state.bandwidth.sentBytes
    : null;
  const rows = [
    {
      title: "Discovered devices",
      value: state.loading ? "Checking…" : state.error ? "Unavailable" : `${state.devices.length} found`,
      good: state.fetchSucceeded,
    },
    {
      title: "Uno wlan0 total",
      value: state.loading
        ? "Checking…"
        : state.error
          ? "Unavailable"
          : totalBandwidth === null
            ? "No data"
            : formatBytes(totalBandwidth),
      good: state.fetchSucceeded && state.bandwidth !== null,
    },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Link href="/" asChild><Pressable style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable></Link>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>NETGUARD · MONITORING</Text>
            <Text style={styles.title}>System status</Text>
          </View>
          <View style={styles.headerMark}><Text style={styles.headerMarkText}>N</Text></View>
        </View>
        <Text style={styles.subtitle}>Live device discovery and Uno wlan0 counters. Per-device usage is unavailable.</Text>

        {state.error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Status check failed</Text>
            <Text style={styles.errorText}>{state.error}</Text>
          </View>
        ) : null}

        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.eyebrow}>NETWORK DISCOVERY</Text>
              <Text style={styles.heroTitle}>
                {state.loading
                  ? "Checking…"
                  : state.error
                    ? "Status unavailable"
                    : state.devices.length > 0
                      ? "Devices detected"
                      : "No devices detected"}
              </Text>
              <Text style={styles.heroCaption}>Discovered devices do not include individual usage totals.</Text>
            </View>
            {state.loading ? <ActivityIndicator color={palette.cyan} /> : (
              <View style={[styles.heroDot, state.devices.length > 0 && styles.heroDotOnline]} />
            )}
          </View>
          <View style={styles.heroRule} />
          <Text style={styles.guardLine}>Automatic polling · every 30 seconds</Text>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Health overview</Text>
            <Text style={styles.sectionCaption}>Counters reported by the Uno interface</Text>
          </View>
          <View style={styles.liveTag}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
        </View>
        <View style={styles.statusCard}>
          {rows.map((row, index) => (
            <View key={row.title} style={[styles.statusRow, index > 0 && styles.rowDivider]}>
              <View style={styles.rowLabel}>
                <View style={[
                  styles.rowDot,
                  row.good === true && styles.rowDotGood,
                  row.good === false && styles.rowDotBad,
                ]} />
                <Text style={styles.rowTitle}>{row.title}</Text>
              </View>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Device identities</Text>
                  <Text style={styles.sectionCaption}>Names use exact IP and MAC matches from the live response.</Text>
                </View>
              </View>
              <View style={styles.deviceList}>
                {state.devices.length > 0
                  ? state.devices.map((device, index) => <DeviceRow key={device.id} device={device} divider={index > 0} />)
                  : <Text style={styles.noDevices}>{state.loading ? "Loading live device list…" : state.error ? "Device discovery unavailable." : "No real devices reported."}</Text>}
              </View>
              <Text style={[
                styles.rowValue,
                row.good === true && styles.rowValueGood,
                row.good === false && styles.rowValueBad,
              ]}>{row.value}</Text>
            </View>
          ))}
        </View>

        <Pressable onPress={onRefresh} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
          <Text style={styles.refreshGlyph}>↻</Text>
          <View style={styles.refreshCopy}>
            <Text style={styles.refreshTitle}>Refresh network data</Text>
            <Text style={styles.refreshCaption}>Fetch the latest device and traffic telemetry</Text>
          </View>
          <Text style={styles.refreshArrow}>→</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default function Status() {
  const [refreshKey, setRefreshKey] = useState(0);
  return <StatusView refreshKey={refreshKey} onRefresh={() => setRefreshKey((key) => key + 1)} />;
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
  title: { marginTop: 3, color: palette.white, fontSize: 23, fontWeight: "800" },
  headerMark: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(99,102,241,0.2)", borderWidth: 1, borderColor: "rgba(129,140,248,0.3)" },
  headerMarkText: { color: palette.cyan, fontWeight: "800", fontSize: 17 },
  subtitle: { marginTop: 14, marginBottom: 18, color: palette.secondary, fontSize: 11 },
  errorCard: { padding: 13, marginBottom: 14, borderRadius: 14, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  errorTitle: { color: "#FCA5A5", fontSize: 12, fontWeight: "700" },
  errorText: { marginTop: 4, color: palette.secondary, fontSize: 10, lineHeight: 15 },
  hero: { overflow: "hidden", padding: 18, borderRadius: 21, backgroundColor: "#11162B", borderWidth: 1, borderColor: "rgba(129,140,248,0.28)" },
  heroGlow: { position: "absolute", top: -90, right: -40, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(34,211,238,0.07)" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  eyebrow: { color: "#A5B4FC", fontSize: 8, fontWeight: "800", letterSpacing: 1.5 },
  heroTitle: { marginTop: 9, color: palette.white, fontSize: 22, fontWeight: "800" },
  heroCaption: { marginTop: 5, color: palette.secondary, fontSize: 10 },
  heroDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#EF4444" },
  heroDotOnline: { backgroundColor: "#10B981" },
  heroRule: { height: 1, marginTop: 17, backgroundColor: "rgba(255,255,255,0.1)" },
  guardLine: { marginTop: 12, color: "#C7D2FE", fontSize: 10, fontWeight: "600" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 23, marginBottom: 11 },
  sectionTitle: { color: palette.white, fontSize: 15, fontWeight: "700" },
  sectionCaption: { marginTop: 4, color: palette.muted, fontSize: 10 },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(16,185,129,0.09)" },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#10B981" },
  liveText: { color: "#6EE7B7", fontSize: 8, fontWeight: "800", letterSpacing: 0.7 },
  statusCard: { paddingHorizontal: 14, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  deviceList: { padding: 8, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  noDevices: { padding: 14, color: palette.muted, fontSize: 10 },
  statusRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  rowLabel: { flexDirection: "row", alignItems: "center", gap: 9 },
  rowDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#F59E0B" },
  rowDotGood: { backgroundColor: "#10B981" },
  rowDotBad: { backgroundColor: "#EF4444" },
  rowTitle: { color: "#E2E8F0", fontSize: 11, fontWeight: "600" },
  rowValue: { color: palette.secondary, fontSize: 10, fontWeight: "700" },
  rowValueGood: { color: "#6EE7B7" },
  rowValueBad: { color: "#FCA5A5" },
  healingCard: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, marginTop: 14, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  healingIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(99,102,241,0.17)" },
  healingGlyph: { color: "#A5B4FC", fontSize: 21 },
  healingCopy: { flex: 1 },
  healingTitle: { color: "#F1F5F9", fontSize: 12, fontWeight: "700" },
  healingDetail: { marginTop: 4, color: palette.muted, fontSize: 9, lineHeight: 14 },
  healingBadge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(245,158,11,0.08)" },
  healingBadgeActive: { backgroundColor: "rgba(16,185,129,0.1)" },
  healingBadgeText: { color: "#FCD34D", fontSize: 8, fontWeight: "800" },
  healingBadgeTextActive: { color: "#6EE7B7" },
  refreshButton: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, marginTop: 19, borderRadius: 17, backgroundColor: "#252A66", borderWidth: 1, borderColor: "rgba(129,140,248,0.34)" },
  pressed: { opacity: 0.82 },
  refreshGlyph: { color: palette.cyan, fontSize: 24 },
  refreshCopy: { flex: 1 },
  refreshTitle: { color: palette.white, fontSize: 12, fontWeight: "700" },
  refreshCaption: { marginTop: 3, color: "#A5B4C7", fontSize: 9 },
  refreshArrow: { color: "#A5B4FC", fontSize: 17 },
});

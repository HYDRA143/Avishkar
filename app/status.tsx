import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { AppHeader, AppIcon, COLORS, ErrorCard, LoadingSkeleton } from "./_components/design";
import { useAutoRefresh } from "./_components/useAutoRefresh";

type StatusData = {
  loading: boolean;
  error: string | null;
  devices: ReadonlyArray<DeviceInfo>;
  bandwidth: BandwidthInfo;
  fetchSucceeded: boolean;
};

function StatusView({ refreshKey, intervalSeconds }: { refreshKey: number; intervalSeconds: number }) {
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
    return () => {
      controller.abort();
    };
  }, [refreshKey]);

  const totalBandwidth = state.bandwidth
    ? state.bandwidth.receivedBytes + state.bandwidth.sentBytes
    : null;
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom", "left", "right"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader liveStatus={state.fetchSucceeded ? "Connected - Main Network" : state.loading ? "SYNCING" : "Disconnected"} />
        <View style={styles.titleRow}><AppIcon name="devices" color={COLORS.gold} size={22} /><Text style={styles.title}>System status</Text></View>
        <Text style={styles.subtitle}>Live device discovery and Uno wlan0 counters. Per-device usage is unavailable.</Text>

        {state.error ? <ErrorCard title="Status check failed" message={state.error} /> : null}

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
          <Text style={styles.guardLine}>Auto refresh: {intervalSeconds}s</Text>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Devices ({state.devices.length})</Text>
            <Text style={styles.sectionCaption}>Live discovery · per-device usage is not reported</Text>
          </View>
          <AppIcon name="devices" color={COLORS.gold} size={21} />
        </View>
        <View style={styles.deviceList}>
          {state.loading && state.devices.length === 0 ? <LoadingSkeleton lines={3} /> : state.devices.length > 0
            ? state.devices.map((device, index) => <DeviceRow key={device.id} device={device} divider={index > 0} />)
            : <Text style={styles.noDevices}>{state.loading ? "Loading live device list…" : state.error ? "Device discovery unavailable." : "No real devices reported."}</Text>}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Bandwidth</Text>
            <Text style={styles.sectionCaption}>Uno wlan0 counters · not per-device</Text>
          </View>
          <AppIcon name="data-usage" color={COLORS.blue} size={21} />
        </View>
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.rowTitle}>Uno-only total</Text>
            <Text style={styles.rowValue}>{totalBandwidth === null ? state.loading ? "Checking…" : "No data" : formatBytes(totalBandwidth)}</Text>
          </View>
          <View style={[styles.statusRow, styles.rowDivider]}>
            <Text style={styles.rowTitle}>Network</Text>
            <View style={styles.connectionValue}>
              <View style={[styles.rowDot, state.fetchSucceeded ? styles.rowDotGood : styles.rowDotBad]} />
              <Text style={[styles.rowValue, state.fetchSucceeded ? styles.rowValueGood : styles.rowValueBad]}>
                {state.fetchSucceeded ? "Connected - Main Network" : "Disconnected"}
              </Text>
            </View>
          </View>
        </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function Status() {
  const { refreshKey, intervalSeconds } = useAutoRefresh();
  return <StatusView refreshKey={refreshKey} intervalSeconds={intervalSeconds} />;
}

const palette = { background: COLORS.background, white: COLORS.white, muted: COLORS.secondary, secondary: COLORS.secondary, indigo: COLORS.blue, cyan: COLORS.gold };
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  page: { alignItems: "center", padding: 16, paddingTop: 16, paddingBottom: 36 },
  content: { width: "100%", maxWidth: 820 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  backGlyph: { color: palette.white, fontSize: 28, lineHeight: 31 },
  headerCopy: { flex: 1 },
  kicker: { color: "#A5B4FC", fontSize: 8, fontWeight: "800", letterSpacing: 1.5 },
  title: { marginTop: 0, color: palette.white, fontSize: 23, fontWeight: "800" },
  headerMark: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(99,102,241,0.2)", borderWidth: 1, borderColor: "rgba(129,140,248,0.3)" },
  headerMarkText: { color: palette.cyan, fontWeight: "800", fontSize: 17 },
  subtitle: { marginTop: 14, marginBottom: 18, color: palette.secondary, fontSize: 12 },
  errorCard: { padding: 13, marginBottom: 14, borderRadius: 14, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  errorTitle: { color: COLORS.red, fontSize: 14, fontWeight: "700" },
  errorText: { marginTop: 4, color: palette.secondary, fontSize: 12, lineHeight: 18 },
  hero: { overflow: "hidden", padding: 18, borderRadius: 16, backgroundColor: COLORS.darkBlue, borderWidth: 1, borderColor: "rgba(26,86,219,0.4)" },
  heroGlow: { position: "absolute", top: -90, right: -40, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(34,211,238,0.07)" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  eyebrow: { color: COLORS.secondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  heroTitle: { marginTop: 9, color: palette.white, fontSize: 22, fontWeight: "800" },
  heroCaption: { marginTop: 5, color: palette.secondary, fontSize: 12 },
  heroDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#EF4444" },
  heroDotOnline: { backgroundColor: COLORS.green },
  heroRule: { height: 1, marginTop: 17, backgroundColor: "rgba(255,255,255,0.1)" },
  guardLine: { marginTop: 12, color: "#DBEAFE", fontSize: 12, fontWeight: "600" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 23, marginBottom: 11 },
  sectionTitle: { color: palette.white, fontSize: 15, fontWeight: "700" },
  sectionCaption: { marginTop: 4, color: palette.muted, fontSize: 12 },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(245,179,1,0.1)" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold },
  liveText: { color: COLORS.gold, fontSize: 12, fontWeight: "800", letterSpacing: 0.7 },
  statusCard: { padding: 16, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  deviceList: { padding: 12, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  noDevices: { padding: 14, color: palette.muted, fontSize: 13 },
  statusRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  rowLabel: { flexDirection: "row", alignItems: "center", gap: 9 },
  rowDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#F59E0B" },
  rowDotGood: { backgroundColor: COLORS.green },
  rowDotBad: { backgroundColor: "#EF4444" },
  rowTitle: { color: "#E2E8F0", fontSize: 14, fontWeight: "600" },
  rowValue: { color: palette.secondary, fontSize: 14, fontWeight: "700" },
  rowValueGood: { color: COLORS.green },
  rowValueBad: { color: "#FCA5A5" },
  connectionValue: { flexDirection: "row", alignItems: "center", gap: 8 },
  healingCard: { flexDirection: "row", alignItems: "center", gap: 11, padding: 16, marginTop: 14, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  healingIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(99,102,241,0.17)" },
  healingGlyph: { color: "#A5B4FC", fontSize: 21 },
  healingCopy: { flex: 1 },
  healingTitle: { color: "#F1F5F9", fontSize: 12, fontWeight: "700" },
  healingDetail: { marginTop: 4, color: palette.muted, fontSize: 12, lineHeight: 17 },
  healingBadge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(245,158,11,0.08)" },
  healingBadgeActive: { backgroundColor: "rgba(34,197,94,0.1)" },
  healingBadgeText: { color: COLORS.orange, fontSize: 12, fontWeight: "800" },
  healingBadgeTextActive: { color: COLORS.green },
  pressed: { opacity: 0.82 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 6 },
});

import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import {
  apiConfig,
  deviceCategoryColor,
  DeviceRow,
  fetchJson,
  formatBytes,
  parseBandwidth,
  parseDevices,
  type BandwidthInfo,
  type DeviceInfo,
} from "./index";
import { getUnoUsageHistory, recordUnoUsage, type UnoUsageEntry } from "./deviceUsageHistory";
import { AppHeader, AppIcon, COLORS, ErrorCard, LoadingSkeleton } from "./_components/design";

type ReportItem = {
  id: number;
  time: number;
  devices: ReadonlyArray<DeviceInfo>;
  bandwidth: BandwidthInfo;
};

let localReports: ReadonlyArray<ReportItem> = [];
let localUsageHistory: ReadonlyArray<UnoUsageEntry> = [];

function ReportsView({ refreshKey, onRefresh }: { refreshKey: number; onRefresh: () => void }) {
  const [reports, setReports] = useState<ReadonlyArray<ReportItem>>(localReports);
  const [usageHistory, setUsageHistory] = useState<ReadonlyArray<UnoUsageEntry>>(localUsageHistory);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async (): Promise<void> => {
      const { base, key } = apiConfig();
      if (!base || !key) {
        setError("Mobile API configuration is missing");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [devicePayload, bandwidthPayload] = await Promise.all([
          fetchJson(`${base}/api/devices`, key, controller.signal),
          fetchJson(`${base}/api/usage`, key, controller.signal),
        ]);
        if (!controller.signal.aborted) {
          const time = Date.now();
          const devices = parseDevices(devicePayload);
          const bandwidth = parseBandwidth(bandwidthPayload);
          if (bandwidth) recordUnoUsage(bandwidth, time);
          localUsageHistory = getUnoUsageHistory();
          setUsageHistory(localUsageHistory);
          const sample: ReportItem = {
            id: time,
            time,
            devices,
            bandwidth,
          };
          setReports((current) => {
            localReports = [sample, ...current].slice(0, 20);
            return localReports;
          });
          setLoading(false);
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Unable to load reports");
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
  const latestReport = reports[0];
  const discoveredDevices = latestReport?.devices ?? [];
  const latestTotal = latestReport?.bandwidth
    ? latestReport.bandwidth.receivedBytes + latestReport.bandwidth.sentBytes
    : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader back liveStatus={error ? "OFFLINE" : loading ? "SYNCING" : reports.length ? "LIVE" : "IDLE"} />
        <View style={styles.titleRow}><AppIcon name="assessment" color={COLORS.gold} size={22} /><Text style={styles.title}>Reports</Text></View>
        <Text style={styles.subtitle}>Recent real snapshots from Uno wlan0. Other discovered devices are not individually measured.</Text>

        {error ? <ErrorCard title="Reports unavailable" message={error} onRetry={onRefresh} /> : null}

        {loading && reports.length === 0 ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={palette.cyan} />
            <Text style={styles.stateTitle}>Loading network snapshot</Text>
            <Text style={styles.stateText}>Reading discovered devices and Uno wlan0 counters.</Text>
            <LoadingSkeleton lines={3} />
          </View>
        ) : reports.length === 0 && !error ? (
          <View style={styles.stateCard}>
            <View style={styles.emptyIcon}><AppIcon name="assessment" size={23} color={COLORS.gold} /></View>
            <Text style={styles.stateTitle}>No local samples yet</Text>
            <Text style={styles.stateText}>A sample will appear when the gateway returns real device and bandwidth data.</Text>
            <Pressable onPress={onRefresh} style={({ pressed }) => [styles.inlineButton, pressed && styles.pressed]}>
              <Text style={styles.inlineButtonText}>Refresh now</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.reportTop}>
              <Text style={styles.reportKicker}>LIVE DEVICE REPORTS</Text>
              <Text style={styles.guardText}>IN MEMORY · UNSIGNED</Text>
            </View>
            {discoveredDevices.length > 0 ? discoveredDevices.map((device) => {
              const isUno = device.identity.category === "uno";
              const deviceHistory = isUno
                ? usageHistory.filter((entry) => entry.intervalBytes !== null).slice(-20).reverse()
                : [];
              const identityColor = deviceCategoryColor(device.identity.category);
              return (
                <View key={device.id} style={[styles.reportCard, { borderColor: identityColor.border }]}>
                  <DeviceRow device={device} />
                  <View style={styles.deviceUsage}>
                    {isUno ? (
                      <>
                        <Text style={styles.metricLabel}>UNO-ONLY TOTAL · NOT PER-DEVICE</Text>
                        <Text style={styles.metricValue}>{formatBytes(latestTotal)}</Text>
                        <Text style={styles.historyTitle}>Recent Uno wlan0 entries (latest 20, local memory)</Text>
                        {deviceHistory.length > 0 ? deviceHistory.map((entry) => (
                          <View key={entry.at} style={styles.historyRow}>
                            <Text style={styles.historyTime}>{new Date(entry.at).toLocaleTimeString()}</Text>
                            <Text style={styles.historyBytes}>
                              {entry.intervalBytes === null ? "No interval" : `Interval ${formatBytes(entry.intervalBytes)}`}
                            </Text>
                            <Text style={styles.historyBytes}>
                              Uno total {formatBytes(entry.receivedBytes + entry.sentBytes)}
                            </Text>
                          </View>
                        )) : (
                          <Text style={styles.noDeviceUsage}>No data for this device yet.</Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.noDeviceUsage}>No data for this device yet.</Text>
                    )}
                  </View>
                </View>
              );
            }) : (
              <View style={styles.stateCard}>
                <Text style={styles.stateTitle}>No real devices reported</Text>
                <Text style={styles.stateText}>Per-device sections appear only for devices returned by the live discovery API.</Text>
              </View>
            )}
          </>
        )}

        <View style={styles.combinedTotal}>
          <Text style={styles.combinedTotalText}>
            Combined Total (Uno-only) = {formatBytes(latestTotal)}
          </Text>
        </View>

        <Pressable onPress={onRefresh} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
          <AppIcon name="refresh" size={21} color={COLORS.white} />
          <View style={styles.refreshCopy}>
            <Text style={styles.refreshTitle}>Refresh network data</Text>
            <Text style={styles.refreshCaption}>Fetch the latest device and traffic telemetry</Text>
          </View>
          <AppIcon name="arrow-forward" size={18} color={COLORS.white} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default function Reports() {
  const [refreshKey, setRefreshKey] = useState(0);
  return <ReportsView refreshKey={refreshKey} onRefresh={() => setRefreshKey((key) => key + 1)} />;
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
  stateCard: { minHeight: 220, alignItems: "center", justifyContent: "center", padding: 22, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  emptyIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "rgba(26,86,219,0.16)" },
  emptyGlyph: { color: "#A5B4FC", fontSize: 22 },
  stateTitle: { marginTop: 12, color: "#E2E8F0", fontSize: 13, fontWeight: "700", textAlign: "center" },
  stateText: { maxWidth: 280, marginTop: 5, color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  inlineButton: { paddingHorizontal: 16, paddingVertical: 12, marginTop: 16, borderRadius: 12, backgroundColor: COLORS.blue, borderWidth: 1, borderColor: COLORS.blue },
  inlineButtonText: { color: COLORS.white, fontSize: 13, fontWeight: "700" },
  reportCard: { padding: 16, marginBottom: 12, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1 },
  deviceUsage: { paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  historyTitle: { marginTop: 11, marginBottom: 5, color: palette.secondary, fontSize: 12, fontWeight: "700" },
  historyRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  historyTime: { color: palette.muted, fontSize: 12 },
  historyBytes: { marginTop: 3, color: "#CBD5E1", fontSize: 12 },
  noDeviceUsage: { paddingVertical: 11, color: palette.muted, fontSize: 13 },
  combinedTotal: { padding: 16, marginBottom: 12, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.blue },
  combinedTotalText: { color: "#DBEAFE", fontSize: 13, fontWeight: "700" },
  reportTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 9, paddingBottom: 15 },
  reportKicker: { color: COLORS.gold, fontSize: 12, fontWeight: "800", letterSpacing: 1.1 },
  reportTime: { marginTop: 6, color: palette.secondary, fontSize: 12 },
  guardBadge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(99,102,241,0.14)" },
  guardText: { color: "#DBEAFE", fontSize: 12, fontWeight: "800" },
  metrics: { flexDirection: "row", alignItems: "center", paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  metric: { flex: 1, gap: 5 },
  metricValue: { color: palette.white, fontSize: 16, fontWeight: "800" },
  metricLabel: { color: palette.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.8 },
  metricDivider: { width: 1, height: 25, marginHorizontal: 8, backgroundColor: "rgba(255,255,255,0.1)" },
  refreshButton: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, marginTop: 18, borderRadius: 12, backgroundColor: COLORS.blue, borderWidth: 1, borderColor: COLORS.blue },
  pressed: { opacity: 0.82 },
  refreshCopy: { flex: 1 },
  refreshTitle: { color: palette.white, fontSize: 14, fontWeight: "700" },
  refreshCaption: { marginTop: 3, color: "#DBEAFE", fontSize: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 6 },
});

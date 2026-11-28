import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  apiConfig,
  deviceCategoryColor,
  fetchJson,
  formatBytes,
  formatSpeed,
  getDeviceIdentity,
  parseBandwidth,
  parseDevices,
  type BandwidthInfo,
  type DeviceInfo,
} from "../index";
import { getUnoUsageHistory, recordUnoUsage, type UnoUsageEntry } from "../deviceUsageHistory";
import { AppHeader, AppIcon, COLORS, ErrorCard, LoadingSkeleton } from "../_components/design";
import { readDeviceNames, saveDeviceName } from "../_components/preferences";
import { useAutoRefresh } from "../_components/useAutoRefresh";

type DeviceState = {
  loading: boolean;
  error: string | null;
  device: DeviceInfo | null;
  bandwidth: BandwidthInfo;
  history: ReadonlyArray<UnoUsageEntry>;
};

function DeviceDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deviceIp = Array.isArray(id) ? id[0] ?? "" : id ?? "";
  const [state, setState] = useState<DeviceState>({
    loading: true,
    error: null,
    device: null,
    bandwidth: null,
    history: getUnoUsageHistory(),
  });
  const { refreshKey, intervalSeconds } = useAutoRefresh();
  const [deviceName, setDeviceName] = useState("");
  const [nameMessage, setNameMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void readDeviceNames().then((names) => {
      if (active) setDeviceName(names[deviceIp] ?? "");
    }).catch((caught: unknown) => {
      if (active) setNameMessage(caught instanceof Error ? caught.message : "Unable to load saved device name");
    });
    return () => { active = false; };
  }, [deviceIp]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async (): Promise<void> => {
      const { base, key } = apiConfig();
      if (!base || !key) {
        setState((current) => ({ ...current, loading: false, error: "Mobile API configuration is missing" }));
        return;
      }
      try {
        const [devicePayload, usagePayload] = await Promise.all([
          fetchJson(`${base}/api/devices`, key, controller.signal),
          fetchJson(`${base}/api/usage`, key, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        const devices = parseDevices(devicePayload);
        const device = devices.find((candidate) => candidate.ipAddress === deviceIp) ?? null;
        const bandwidth = parseBandwidth(usagePayload);
        if (bandwidth) recordUnoUsage(bandwidth);
        setState({
          loading: false,
          error: null,
          device,
          bandwidth,
          history: getUnoUsageHistory(),
        });
      } catch (caught) {
        if (!controller.signal.aborted) {
          setState((current) => ({
            ...current,
            loading: false,
            error: caught instanceof Error ? caught.message : "Unable to load device details",
          }));
        }
      }
    };
    void load();
    return () => {
      controller.abort();
    };
  }, [deviceIp, refreshKey]);

  const identity = state.device?.identity ?? getDeviceIdentity(deviceIp, "");
  const displayedName = deviceName || identity.name;
  const color = deviceCategoryColor(identity.category);
  const totalBytes = state.bandwidth
    ? state.bandwidth.receivedBytes + state.bandwidth.sentBytes
    : null;
  const speedEntries = useMemo(
    () => state.history.filter((entry) => entry.intervalSpeedBytesPerSecond !== null).slice(-7),
    [state.history],
  );
  const maximumSpeed = Math.max(1, ...speedEntries.map((entry) => entry.intervalSpeedBytesPerSecond ?? 0));

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom", "left", "right"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader liveStatus={state.error ? "Disconnected" : state.device ? "Connected - Main Network" : "SYNCING"} />
        <View style={styles.titleRow}>
          <AppIcon
            name={identity.category === "uno" ? "security" : identity.category === "gateway" ? "router" : identity.category === "phone" ? "smartphone" : "device-unknown"}
            color={color.text}
            size={24}
          />
          <Text style={styles.title}>{displayedName}</Text>
        </View>
        <Text style={styles.autoRefresh}>Auto refresh: {intervalSeconds}s</Text>

        {state.error ? <ErrorCard title="Device data unavailable" message={state.error} /> : null}
        {state.loading && !state.device ? (
          <View style={styles.stateCard}><Text style={styles.stateText}>Loading live device data…</Text><LoadingSkeleton lines={3} /></View>
        ) : !state.device ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Device not currently discovered</Text>
            <Text style={styles.stateText}>Details are shown only for devices present in the live `/api/devices` response.</Text>
          </View>
        ) : (
          <>
            <View style={[styles.identityCard, { borderColor: color.border }]}>
              <InfoRow label="Name" value={displayedName} />
              <InfoRow label="IP" value={state.device.ipAddress || "Not reported"} />
              <InfoRow label="MAC" value={state.device.macAddress || "Not reported"} />
              <InfoRow label="Vendor hint" value={identity.source} />
              <InfoRow
                label="Status"
                value={state.device.reachable === null ? "Unavailable" : state.device.reachable ? "Online" : "Offline"}
              />
            </View>

            <View style={styles.notice}>
              <View style={styles.noticeTitleRow}><AppIcon name="info-outline" size={18} color={COLORS.orange} /><Text style={styles.noticeTitle}>Per-device traffic is unavailable</Text></View>
              <Text style={styles.noticeBody}>
                Per-device usage needs router telemetry or a device agent. Showing Uno-only total labelled clearly; these interface counters are not attributed to this device.
              </Text>
            </View>

            <View style={styles.metricsCard}>
              <View style={styles.metricHeading}><AppIcon name="data-usage" color={COLORS.blue} /><Text style={styles.metricLabel}>UNO-ONLY TOTAL - NOT PER-DEVICE</Text></View>
              <Text style={styles.total}>{formatBytes(totalBytes)}</Text>
              <View style={styles.metricHeading}><AppIcon name="speed" color={COLORS.gold} /><Text style={styles.metricLabel}>LIVE SPEED FOR THIS DEVICE</Text></View>
              <Text style={styles.speed}>Per-device speed unavailable</Text>
            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Uno-only speed history</Text>
                <Text style={styles.sectionCaption}>Last 7 observed intervals · not this device's traffic</Text>
              </View>
            </View>
            <View style={styles.chartCard}>
              {speedEntries.length > 0 ? (
                <View style={styles.chart}>
                  {speedEntries.map((entry) => {
                    const speed = entry.intervalSpeedBytesPerSecond ?? 0;
                    const height = Math.max(5, (speed / maximumSpeed) * 100);
                    return (
                      <View key={entry.at} style={styles.chartColumn}>
                        <Text style={styles.barValue}>{formatSpeed(speed)}</Text>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { height: `${height}%` }]} />
                        </View>
                        <Text style={styles.barLabel}>{new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.noData}>No measured Uno speed intervals yet.</Text>
              )}
            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Recent local entries</Text>
                <Text style={styles.sectionCaption}>Up to 20 real Uno counter readings · app memory only</Text>
              </View>
            </View>
            <View style={styles.historyCard}>
              {state.history.length > 0 ? state.history.slice(-20).reverse().map((entry) => (
                <View key={entry.at} style={styles.historyRow}>
                  <Text style={styles.historyTime}>{new Date(entry.at).toLocaleString()}</Text>
                  <Text style={styles.historyValue}>
                    Uno-only total {formatBytes(entry.receivedBytes + entry.sentBytes)}
                  </Text>
                  <Text style={styles.historyValue}>
                    {entry.intervalBytes === null ? "Initial baseline" : `Interval ${formatBytes(entry.intervalBytes)}`}
                  </Text>
                </View>
              )) : (
                <Text style={styles.noData}>No real counter readings collected yet.</Text>
              )}
            </View>
            <View style={styles.renameCard}>
              <Text style={styles.sectionTitle}>Edit Name</Text>
              <TextInput
                value={deviceName}
                onChangeText={setDeviceName}
                placeholder={identity.name}
                placeholderTextColor={COLORS.secondary}
                style={styles.nameInput}
                accessibilityLabel="Device display name"
              />
              <Pressable onPress={() => {
                setNameMessage(null);
                void saveDeviceName(deviceIp, deviceName).then(() => setNameMessage("Name saved on this device."))
                  .catch((caught: unknown) => setNameMessage(caught instanceof Error ? caught.message : "Unable to save device name"));
              }} style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}>
                <Text style={styles.reportButtonText}>Save Name</Text>
              </Pressable>
              {nameMessage ? <Text style={styles.nameMessage}>{nameMessage}</Text> : null}
            </View>
            <Link href={{ pathname: "/reports", params: { deviceId: deviceIp } }} asChild>
              <Pressable style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}>
                <Text style={styles.reportButtonText}>View Individual Reports</Text>
                <AppIcon name="arrow-forward" color={COLORS.white} size={18} />
              </Pressable>
            </Link>
          </>
        )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function DeviceDetailRoute() {
  return <DeviceDetails />;
}

const palette = { background: COLORS.background, white: COLORS.white, muted: COLORS.secondary, secondary: COLORS.secondary, indigo: COLORS.blue, cyan: COLORS.gold };
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  page: { alignItems: "center", padding: 16, paddingTop: 16, paddingBottom: 36 },
  content: { width: "100%", maxWidth: 820 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  back: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  backGlyph: { color: palette.white, fontSize: 28, lineHeight: 31 },
  headerCopy: { flex: 1 },
  kicker: { color: "#A5B4FC", fontSize: 8, fontWeight: "800", letterSpacing: 1.5 },
  title: { marginTop: 0, color: palette.white, fontSize: 20, fontWeight: "800" },
  avatar: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, borderWidth: 1 },
  avatarText: { fontSize: 16, fontWeight: "800" },
  errorCard: { padding: 13, marginBottom: 12, borderRadius: 13, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  errorText: { color: COLORS.red, fontSize: 12 },
  stateCard: { minHeight: 130, alignItems: "center", justifyContent: "center", gap: 10, padding: 18, borderRadius: 16, backgroundColor: COLORS.card },
  stateTitle: { color: palette.white, fontSize: 12, fontWeight: "700" },
  stateText: { color: palette.secondary, fontSize: 12, lineHeight: 18, textAlign: "center" },
  identityCard: { padding: 16, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1 },
  infoRow: { minHeight: 38, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  infoLabel: { color: palette.muted, fontSize: 12, fontWeight: "700" },
  infoValue: { flex: 1, color: "#E2E8F0", fontSize: 12, fontWeight: "600", textAlign: "right" },
  notice: { padding: 16, marginTop: 12, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.orange },
  noticeTitle: { color: COLORS.orange, fontSize: 13, fontWeight: "700" },
  noticeBody: { marginTop: 7, color: palette.secondary, fontSize: 12, lineHeight: 18 },
  metricsCard: { padding: 16, marginTop: 12, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.blue },
  metricLabel: { color: palette.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  total: { marginTop: 5, marginBottom: 13, color: palette.white, fontSize: 25, fontWeight: "800" },
  speed: { marginTop: 5, color: "#C7D2FE", fontSize: 14, fontWeight: "700" },
  sectionHeader: { marginTop: 20, marginBottom: 9 },
  sectionTitle: { color: palette.white, fontSize: 14, fontWeight: "700" },
  sectionCaption: { marginTop: 4, color: palette.muted, fontSize: 12 },
  chartCard: { height: 190, justifyContent: "center", padding: 16, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  chart: { height: 150, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  chartColumn: { flex: 1, minWidth: 0, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 7 },
  barValue: { maxWidth: "100%", color: palette.muted, fontSize: 12 },
  barTrack: { width: "68%", height: 95, justifyContent: "flex-end", overflow: "hidden", borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: "rgba(26,86,219,0.12)" },
  barFill: { backgroundColor: COLORS.blue, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barLabel: { color: palette.secondary, fontSize: 12 },
  noData: { padding: 12, color: palette.muted, fontSize: 12 },
  autoRefresh: { marginBottom: 10, color: palette.muted, fontSize: 12 },
  renameCard: { padding: 16, marginTop: 16, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  nameInput: { minHeight: 44, paddingHorizontal: 10, marginTop: 10, borderRadius: 10, color: COLORS.white, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  nameMessage: { marginTop: 8, color: COLORS.green, fontSize: 12 },
  reportButton: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 14, borderRadius: 12, backgroundColor: COLORS.blue },
  reportButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "700" },
  historyCard: { paddingHorizontal: 16, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  historyRow: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  historyTime: { color: palette.muted, fontSize: 12 },
  historyValue: { marginTop: 3, color: "#CBD5E1", fontSize: 13 },
  pressed: { opacity: 0.82 },
  titleRow: { width: "100%", flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  metricHeading: { flexDirection: "row", alignItems: "center", gap: 7 },
  noticeTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
});

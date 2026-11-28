import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { permissionService } from "../src/mobile/services/permissionService";
import { AppHeader, AppIcon, COLORS, ErrorCard } from "./_components/design";
import { parseDevices, fetchJson, type DeviceInfo } from "./index";
import { readDeviceNames, saveDeviceName, REFRESH_INTERVALS } from "./_components/preferences";
import { useAutoRefresh } from "./_components/useAutoRefresh";

type SettingsData = {
  gatewayOnline: boolean | null;
  guardReady: boolean | null;
};

const config = (): { base: string; key: string } => {
  const runtime = globalThis as typeof globalThis & {
    __NETGUARD_CONFIG__?: { apiBaseUrl?: string; apiKey?: string };
  };
  return {
    base: (runtime.__NETGUARD_CONFIG__?.apiBaseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, ""),
    key: runtime.__NETGUARD_CONFIG__?.apiKey ?? process.env.EXPO_PUBLIC_NETGUARD_API_KEY ?? "",
  };
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;

function SettingsView({
  refreshKey,
  intervalSeconds,
  setRefreshInterval,
}: {
  refreshKey: number;
  intervalSeconds: number;
  setRefreshInterval: (seconds: 5 | 10 | 30 | 60) => Promise<void>;
}) {
  const [settings, setSettings] = useState<SettingsData>({ gatewayOnline: null, guardReady: null });
  const [devices, setDevices] = useState<ReadonlyArray<DeviceInfo>>([]);
  const [deviceNames, setDeviceNames] = useState<Record<string, string>>({});
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [notificationsPermission, setNotificationsPermission] = useState(false);
  const [networkPermission, setNetworkPermission] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async (): Promise<void> => {
      const { base, key } = config();
      if (!base || !key) {
        setError("Mobile API configuration is missing");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [response, devicePayload] = await Promise.all([
          fetch(`${base}/api/status`, { headers: { "x-api-key": key }, signal: controller.signal }),
          fetchJson(`${base}/api/devices`, key, controller.signal),
        ]);
        const body: unknown = await response.json();
        if (!response.ok) {
          const message = asRecord(body)?.error;
          throw new Error(typeof message === "string" ? message : `Settings request failed (${response.status})`);
        }
        const value = asRecord(body);
        if (!value) throw new Error("Status response was not a JSON object");
        if (controller.signal.aborted) return;
        const guard = asRecord(value.guard);
        const nextSettings = {
          gatewayOnline: true,
          guardReady: typeof guard?.ready === "boolean" ? guard.ready : null,
        };
        setSettings(nextSettings);
        setDevices(parseDevices(devicePayload));
        setLoading(false);
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Unable to load settings");
          setLoading(false);
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [refreshKey]);

  useEffect(() => {
    let active = true;
    void readDeviceNames().then((names) => {
      if (active) {
        setDeviceNames(names);
        setNameDrafts(names);
      }
    }).catch((caught: unknown) => {
      if (active) setPreferenceError(caught instanceof Error ? caught.message : "Unable to load saved device names");
    });
    return () => { active = false; };
  }, []);

  const persistDeviceName = async (device: DeviceInfo, reset = false): Promise<void> => {
    setPreferenceError(null);
    try {
      const updated = await saveDeviceName(device.ipAddress, reset ? null : nameDrafts[device.ipAddress] ?? "");
      setDeviceNames(updated);
      setNameDrafts(updated);
    } catch (caught) {
      setPreferenceError(caught instanceof Error ? caught.message : "Unable to save device name");
    }
  };

  useEffect(() => {
    let cancelled = false;
    const checkPermissions = async (): Promise<void> => {
      try {
        const [notifications, network] = await Promise.all([
          permissionService.check("notifications"),
          permissionService.check("network"),
        ]);
        if (!cancelled) {
          setNotificationsPermission(notifications);
          setNetworkPermission(network);
          setPermissionError(null);
        }
      } catch (caught) {
        if (!cancelled) setPermissionError(caught instanceof Error ? caught.message : "Unable to check permissions");
      }
    };
    void checkPermissions();
    return () => { cancelled = true; };
  }, []);

  const requestPermissions = async (): Promise<void> => {
    setPermissionError(null);
    try {
      const [notifications, network] = await Promise.all([
        permissionService.request("notifications"),
        permissionService.request("network"),
      ]);
      setNotificationsPermission(notifications);
      setNetworkPermission(network);
    } catch (caught) {
      setPermissionError(caught instanceof Error ? caught.message : "Unable to request permissions");
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom", "left", "right"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader liveStatus={settings.gatewayOnline ? "Connected - Main Network" : loading ? "SYNCING" : "Disconnected"} />
        <View style={styles.titleRow}><AppIcon name="settings" color={COLORS.gold} size={22} /><Text style={styles.title}>Settings</Text></View>
        <Text style={styles.subtitle}>Auto refresh, device names, and app information.</Text>

        {error ? <ErrorCard title="Settings unavailable" message={error} /> : null}

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Auto Refresh</Text><Text style={styles.sectionCaption}>Choose how often live screens update</Text></View>
          {loading ? <ActivityIndicator color={palette.cyan} /> : null}
        </View>
        <View style={styles.gatewayCard}>
          {REFRESH_INTERVALS.map((seconds, index) => (
            <Pressable key={seconds} onPress={() => {
              setPreferenceError(null);
              void setRefreshInterval(seconds).catch((caught: unknown) =>
                setPreferenceError(caught instanceof Error ? caught.message : "Unable to save auto-refresh interval"));
            }} style={[styles.radioRow, index > 0 && styles.separator]}>
              <Text style={styles.detailLabel}>{seconds} sec</Text>
              <View style={[styles.radioOuter, intervalSeconds === seconds && styles.radioOuterSelected]}>
                {intervalSeconds === seconds ? <View style={styles.radioInner} /> : null}
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Device Names</Text><Text style={styles.sectionCaption}>Names are saved on this device</Text></View>
        </View>
        <View style={styles.gatewayCard}>
          {devices.length > 0 ? devices.map((device, index) => (
            <View key={device.id} style={[styles.nameRow, index > 0 && styles.separator]}>
              <View style={styles.nameInputCopy}>
                <Text style={styles.gatewayTitle}>{deviceNames[device.ipAddress] || device.identity.name}</Text>
                <Text style={styles.gatewayCaption}>{device.ipAddress}</Text>
                <TextInput
                  value={nameDrafts[device.ipAddress] ?? deviceNames[device.ipAddress] ?? ""}
                  onChangeText={(value) => setNameDrafts((current) => ({ ...current, [device.ipAddress]: value }))}
                  placeholder={device.identity.name}
                  placeholderTextColor={COLORS.secondary}
                  style={styles.nameInput}
                  accessibilityLabel={`Edit name for ${device.ipAddress}`}
                />
              </View>
              <View style={styles.nameActions}>
                <Pressable onPress={() => void persistDeviceName(device)}><Text style={styles.viewAll}>Save</Text></Pressable>
                <Pressable onPress={() => void persistDeviceName(device, true)}><Text style={styles.resetText}>Reset</Text></Pressable>
              </View>
            </View>
          )) : <Text style={styles.gatewayCaption}>{loading ? "Loading discovered devices…" : "No live devices available to rename."}</Text>}
        </View>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>About</Text><Text style={styles.sectionCaption}>NetGuard application</Text></View>
        </View>
        <View style={styles.gatewayCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>App version</Text>
            <Text style={styles.detailValue}>1.0.0</Text>
          </View>
          <View style={[styles.detailRow, styles.separator, styles.aboutStatus]}>
            <Text style={styles.detailLabel}>Network</Text>
            <View style={styles.connectionValue}>
              <View style={[styles.connectionDot, settings.gatewayOnline ? styles.connectionDotOnline : styles.connectionDotOffline]} />
              <Text style={[styles.detailValue, settings.gatewayOnline ? styles.goodText : styles.disconnectedText]}>
                {settings.gatewayOnline ? "Connected - Main Network" : "Disconnected"}
              </Text>
            </View>
          </View>
        </View>
        {preferenceError ? <Text style={styles.preferenceError}>{preferenceError}</Text> : null}

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Usage alerts</Text><Text style={styles.sectionCaption}>Configure Uno wlan0 caps and notifications</Text></View>
        </View>
        <View style={styles.simCard}>
          <Text style={styles.simCaption}>
            Hourly, daily, and weekly caps plus unusual-usage reminders. These apply only to this Uno's interface.
          </Text>
          <Link href="/alerts" asChild>
            <Pressable style={({ pressed }) => [styles.manualButton, pressed && styles.pressed]}>
              <Text style={styles.manualButtonText}>Manage usage alerts</Text>
              <AppIcon name="arrow-forward" color={COLORS.white} size={18} />
            </Pressable>
          </Link>
        </View>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Code integrity</Text><Text style={styles.sectionCaption}>Signed GitHub verification is not configured</Text></View>
        </View>
        <View style={styles.gatewayCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Automatic source replacement</Text>
            <Text style={styles.detailValue}>Disabled</Text>
          </View>
          <View style={styles.separator} />
          <Text style={styles.integrityNote}>
            No trusted signed baseline is configured. NetGuard will not pull, modify, or execute replacement code automatically.
          </Text>
        </View>

        {permissionError ? (
          <View style={styles.permissionError}>
            <Text style={styles.permissionErrorText}>{permissionError}</Text>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>SIM monitor</Text><Text style={styles.sectionCaption}>Future scope; manual controls only in this build</Text></View>
        </View>
        <View style={styles.simCard}>
          <View style={styles.simRow}>
            <View style={styles.warningIcon}><AppIcon name="notifications-active" color={COLORS.orange} size={21} /></View>
            <View style={styles.simCopy}>
              <Text style={styles.simTitle}>Warning Only</Text>
              <Text style={styles.simCaption}>NetGuard never blocks mobile data automatically.</Text>
            </View>
            <View style={styles.warningBadge}><Text style={styles.warningBadgeText}>MANUAL</Text></View>
          </View>
          <Link href="/sim_bypass" asChild>
            <Pressable style={({ pressed }) => [styles.manualButton, pressed && styles.pressed]}>
              <Text style={styles.manualButtonText}>Open manual mobile data controls</Text>
              <AppIcon name="arrow-forward" color={COLORS.white} size={18} />
            </Pressable>
          </Link>
        </View>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Device permissions</Text><Text style={styles.sectionCaption}>Required access for supported features</Text></View>
        </View>
        <View style={styles.permissionCard}>
          <View style={styles.permissionRow}>
            <Text style={styles.permissionLabel}>Notifications</Text>
            <Text style={[styles.permissionValue, notificationsPermission && styles.goodText]}>
              {notificationsPermission ? "Granted" : "Not granted"}
            </Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.permissionRow}>
            <Text style={styles.permissionLabel}>Network access</Text>
            <Text style={[styles.permissionValue, networkPermission && styles.goodText]}>
              {networkPermission ? "Granted" : "Not granted"}
            </Text>
          </View>
          <Pressable onPress={() => void requestPermissions()} style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}>
            <Text style={styles.permissionButtonText}>Review permissions</Text>
          </Pressable>
        </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function Settings() {
  const { refreshKey, intervalSeconds, setRefreshInterval } = useAutoRefresh();
  return <SettingsView refreshKey={refreshKey} intervalSeconds={intervalSeconds} setRefreshInterval={setRefreshInterval} />;
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
  kicker: { color: COLORS.secondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  title: { marginTop: 0, color: palette.white, fontSize: 23, fontWeight: "800" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 6 },
  headerMark: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(99,102,241,0.2)", borderWidth: 1, borderColor: "rgba(129,140,248,0.3)" },
  headerMarkText: { color: palette.cyan, fontWeight: "800", fontSize: 17 },
  subtitle: { marginTop: 14, marginBottom: 18, color: palette.secondary, fontSize: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 17, marginBottom: 10 },
  sectionTitle: { color: palette.white, fontSize: 15, fontWeight: "700" },
  sectionCaption: { marginTop: 4, color: palette.muted, fontSize: 12, lineHeight: 17 },
  errorCard: { padding: 13, borderRadius: 14, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  errorTitle: { color: COLORS.red, fontSize: 14, fontWeight: "700" },
  errorText: { marginTop: 4, color: palette.secondary, fontSize: 12 },
  gatewayCard: { padding: 16, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  gatewayRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  gatewayIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(26,86,219,0.18)" },
  gatewayGlyph: { color: "#A5B4FC", fontSize: 21 },
  gatewayCopy: { flex: 1 },
  gatewayTitle: { color: "#F1F5F9", fontSize: 14, fontWeight: "700" },
  gatewayCaption: { marginTop: 4, color: palette.muted, fontSize: 12 },
  stateBadge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(245,158,11,0.09)" },
  stateBadgeGood: { backgroundColor: "rgba(34,197,94,0.09)" },
  stateBadgeText: { color: COLORS.orange, fontSize: 12, fontWeight: "800" },
  stateBadgeTextGood: { color: COLORS.green },
  separator: { height: 1, marginVertical: 12, backgroundColor: "rgba(255,255,255,0.08)" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  detailLabel: { color: palette.secondary, fontSize: 13 },
  detailValue: { color: COLORS.orange, fontSize: 13, fontWeight: "700" },
  goodText: { color: COLORS.green },
  disconnectedText: { color: COLORS.red },
  radioRow: { minHeight: 47, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  radioOuter: { width: 20, height: 20, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: COLORS.secondary, borderRadius: 10 },
  radioOuterSelected: { borderColor: COLORS.blue },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.blue },
  viewAll: { color: "#60A5FA", fontSize: 13, fontWeight: "700" },
  nameRow: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  nameInputCopy: { flex: 1 },
  nameInput: { height: 37, marginTop: 6, paddingHorizontal: 9, borderRadius: 8, color: COLORS.white, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  nameActions: { gap: 14 },
  resetText: { color: COLORS.orange, fontSize: 13, fontWeight: "700" },
  aboutStatus: { marginTop: 12, paddingTop: 12 },
  connectionValue: { flexDirection: "row", alignItems: "center", gap: 7 },
  connectionDot: { width: 7, height: 7, borderRadius: 4 },
  connectionDotOnline: { backgroundColor: COLORS.green },
  connectionDotOffline: { backgroundColor: COLORS.red },
  preferenceError: { marginTop: 9, color: COLORS.red, fontSize: 12 },
  integrityNote: { color: palette.secondary, fontSize: 12, lineHeight: 18 },
  permissionError: { padding: 11, marginTop: 10, borderRadius: 12, backgroundColor: "rgba(239,68,68,0.08)" },
  permissionErrorText: { color: COLORS.red, fontSize: 12 },
  simCard: { padding: 16, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  simRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  warningIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(249,115,22,0.12)" },
  warningGlyph: { color: "#FCD34D", fontSize: 17, fontWeight: "800" },
  simCopy: { flex: 1 },
  simTitle: { color: "#F1F5F9", fontSize: 14, fontWeight: "700" },
  simCaption: { marginTop: 4, color: palette.muted, fontSize: 12, lineHeight: 17 },
  warningBadge: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 99, backgroundColor: "rgba(245,158,11,0.09)" },
  warningBadgeText: { color: COLORS.orange, fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },
  manualButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 13, borderRadius: 12, backgroundColor: COLORS.blue, borderWidth: 1, borderColor: COLORS.blue },
  manualButtonText: { color: COLORS.white, fontSize: 13, fontWeight: "700" },
  permissionCard: { paddingHorizontal: 16, paddingTop: 3, paddingBottom: 16, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  permissionRow: { minHeight: 39, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  permissionLabel: { color: palette.secondary, fontSize: 13 },
  permissionValue: { color: COLORS.orange, fontSize: 12, fontWeight: "700" },
  permissionButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 10, borderRadius: 12, backgroundColor: COLORS.blue, borderWidth: 1, borderColor: COLORS.blue },
  permissionButtonText: { color: COLORS.white, fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.82 },
});

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import {
  DEFAULT_USAGE_ALERT_SETTINGS,
  getUsageMonitorState,
  reconcileBackgroundTask,
  requestUsageNotificationPermission,
  saveUsageAlertSettings,
  type UsageMonitorState,
} from "../src/features/wifi-monitor/usageAlerts";
import {
  formatUsageBytes,
  type UsageAlertSettings,
} from "../src/features/wifi-monitor/usageMetrics";
import { AppHeader, AppIcon, COLORS, ErrorCard } from "./_components/design";

const BYTES_PER_GB = 1_000_000_000;

type AlertForm = {
  enabled: boolean;
  anomalyEnabled: boolean;
  hourlyCap: string;
  dailyCap: string;
  weeklyCap: string;
};

const inputValue = (bytes: number | null): string =>
  bytes === null ? "" : (bytes / BYTES_PER_GB).toString();

const readCap = (value: string, label: string): number | null => {
  if (!value.trim()) return null;
  const gigabytes = Number(value);
  const bytes = Math.round(gigabytes * BYTES_PER_GB);
  if (!Number.isFinite(gigabytes) || gigabytes <= 0 || !Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new Error(`${label} must be a positive number of GB`);
  }
  return bytes;
};

const formatDuration = (milliseconds: number): string => {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
};

function UsageAlertsView() {
  const [monitor, setMonitor] = useState<UsageMonitorState | null>(null);
  const [form, setForm] = useState<AlertForm>({
    enabled: DEFAULT_USAGE_ALERT_SETTINGS.enabled,
    anomalyEnabled: DEFAULT_USAGE_ALERT_SETTINGS.anomalyEnabled,
    hourlyCap: "",
    dailyCap: "",
    weeklyCap: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const refreshMonitor = useCallback(async (): Promise<void> => {
    const state = await getUsageMonitorState();
    setMonitor(state);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      try {
        const state = await getUsageMonitorState();
        if (!active) return;
        setMonitor(state);
        setForm({
          enabled: state.settings.enabled,
          anomalyEnabled: state.settings.anomalyEnabled,
          hourlyCap: inputValue(state.settings.hourlyCapBytes),
          dailyCap: inputValue(state.settings.dailyCapBytes),
          weeklyCap: inputValue(state.settings.weeklyCapBytes),
        });
        setError(null);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load usage alert settings");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const interval = setInterval(() => {
      void refreshMonitor().catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to refresh usage data");
      });
    }, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refreshMonitor]);

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    let settingsPersisted = false;
    try {
      const settings: UsageAlertSettings = {
        enabled: form.enabled,
        hourlyCapBytes: readCap(form.hourlyCap, "Hourly cap"),
        dailyCapBytes: readCap(form.dailyCap, "Daily cap"),
        weeklyCapBytes: readCap(form.weeklyCap, "Weekly cap"),
        anomalyEnabled: form.anomalyEnabled,
        anomalyMultiplier: DEFAULT_USAGE_ALERT_SETTINGS.anomalyMultiplier,
      };
      if (settings.enabled) await requestUsageNotificationPermission();
      await saveUsageAlertSettings(settings);
      settingsPersisted = true;
      await reconcileBackgroundTask();
      await refreshMonitor();
      setSavedMessage("Usage alert settings saved.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to save usage alert settings";
      setError(settingsPersisted ? `Settings were saved, but monitoring could not be fully updated: ${message}` : message);
    } finally {
      setSaving(false);
    }
  };

  const retryMonitor = (): void => {
    void refreshMonitor().catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "Unable to refresh usage data");
    });
  };

  const totalsReady = (monitor?.sampleCount ?? 0) >= 2;
  const lastSample = monitor?.lastSampleAt
    ? new Date(monitor.lastSampleAt).toLocaleString()
    : "Waiting for first sample";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader back liveStatus={monitor?.lastError ? "WARNING" : loading ? "SYNCING" : monitor?.settings.enabled ? "LIVE" : "PAUSED"} />
        <View style={styles.titleRow}><AppIcon name="notifications-active" color={COLORS.gold} size={22} /><Text style={styles.title}>Usage alerts</Text></View>
        <Text style={styles.subtitle}>Set traffic caps and get local reminders on this device.</Text>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Uno interface only</Text>
          <Text style={styles.noticeText}>
            These figures measure this Uno's wlan0 traffic. Device discovery does not reveal how much data each phone or laptop uses; that requires router per-device telemetry.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingCard}><ActivityIndicator color={palette.cyan} /><Text style={styles.loadingText}>Loading saved settings…</Text></View>
        ) : null}

        <View style={styles.card}>
          <SettingSwitch
            title="Enable usage monitoring"
            subtitle="Sample Uno wlan0 and check enabled alerts"
            value={form.enabled}
            onChange={(enabled) => setForm((current) => ({ ...current, enabled }))}
          />
          <View style={styles.separator} />
          <CapInput
            label="Hourly cap"
            subtitle="Applies to every hour, including overnight"
            value={form.hourlyCap}
            onChange={(hourlyCap) => setForm((current) => ({ ...current, hourlyCap }))}
          />
          <View style={styles.separator} />
          <CapInput
            label="Daily cap"
            value={form.dailyCap}
            onChange={(dailyCap) => setForm((current) => ({ ...current, dailyCap }))}
          />
          <View style={styles.separator} />
          <CapInput
            label="Weekly cap"
            value={form.weeklyCap}
            onChange={(weeklyCap) => setForm((current) => ({ ...current, weeklyCap }))}
          />
          <View style={styles.separator} />
          <SettingSwitch
            title="Unusual daily usage"
            subtitle="Alert when today reaches 2× yesterday's measured usage"
            value={form.anomalyEnabled}
            onChange={(anomalyEnabled) => setForm((current) => ({ ...current, anomalyEnabled }))}
          />
        </View>

        {error ? <ErrorCard title="Action required" message={error} onRetry={retryMonitor} /> : null}
        {savedMessage ? <Text style={styles.savedMessage}>{savedMessage}</Text> : null}

        <Pressable
          onPress={() => void save()}
          disabled={loading || saving}
          style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, (loading || saving) && styles.disabled]}
          accessibilityRole="button"
        >
          <Text style={styles.saveButtonText}>{saving ? "Saving…" : "Save alert settings"}</Text>
          {saving ? <ActivityIndicator color={palette.white} /> : <AppIcon name="arrow-forward" color={COLORS.white} size={18} />}
        </Pressable>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Measured usage</Text><Text style={styles.sectionCaption}>Local calendar windows from saved interface-counter samples</Text></View>
          {monitor ? <Text style={styles.sampleCount}>{monitor.sampleCount} samples</Text> : null}
        </View>
        <View style={styles.card}>
          <UsageRow label="This hour" value={totalsReady ? formatUsageBytes(monitor?.totals.hourlyBytes ?? 0) : "Collecting baseline"} />
          <View style={styles.separator} />
          <UsageRow label="Today" value={totalsReady ? formatUsageBytes(monitor?.totals.dailyBytes ?? 0) : "Collecting baseline"} />
          <View style={styles.separator} />
          <UsageRow label="This week" value={totalsReady ? formatUsageBytes(monitor?.totals.weeklyBytes ?? 0) : "Collecting baseline"} />
          <View style={styles.separator} />
          <UsageRow label="Yesterday" value={totalsReady ? formatUsageBytes(monitor?.totals.previousDayBytes ?? 0) : "Collecting baseline"} />
          <View style={styles.separator} />
          <UsageRow label="Last interface sample" value={lastSample} />
          <View style={styles.separator} />
          <UsageRow label="Sampling gap" value={monitor?.lastGapMs === null || monitor?.lastGapMs === undefined ? "No sample yet" : monitor.lastGapMs === 0 ? "Initial baseline" : formatDuration(monitor.lastGapMs)} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Sampling is approximate</Text>
          <Text style={styles.noticeText}>
            Sampling starts from the first baseline while monitoring is enabled; earlier traffic is not included. Counter resets can leave an interval uncounted. The app samples about once per minute while open; Android background checks have a 15-minute minimum and may be delayed.
          </Text>
          <Text style={styles.permissionText}>
            Notifications: {monitor?.notificationsGranted ? "allowed" : "not allowed"} · Background task: {monitor?.backgroundRegistered ? "registered" : monitor?.backgroundSupported ? "available" : "unavailable"}
          </Text>
        </View>

        {monitor?.lastError ? <ErrorCard title="Latest monitoring error" message={monitor.lastError} onRetry={retryMonitor} /> : null}

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Recent alerts</Text><Text style={styles.sectionCaption}>Saved locally on this device</Text></View>
        </View>
        {monitor?.recentAlerts.length ? monitor.recentAlerts.map((alert) => (
          <View key={alert.id} style={styles.alertCard}>
            <View style={styles.alertTop}>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertPeriod}>{alert.period}</Text>
            </View>
            <Text style={styles.alertBody}>{alert.body}</Text>
            <Text style={styles.alertTime}>{new Date(alert.at).toLocaleString()}</Text>
          </View>
        )) : (
          <View style={styles.card}><Text style={styles.emptyHistory}>No usage alerts recorded yet.</Text></View>
        )}
      </View>
    </ScrollView>
  );
}

function SettingSwitch({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "rgba(148,163,184,0.28)", true: COLORS.blue }}
        thumbColor={palette.white}
        accessibilityLabel={title}
      />
    </View>
  );
}

function CapInput({
  label,
  subtitle = "Leave blank for no cap",
  value,
  onChange,
}: {
  label: string;
  subtitle?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.capRow}>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{label}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder="No cap"
          placeholderTextColor={palette.muted}
          style={styles.input}
          accessibilityLabel={`${label} in GB`}
        />
        <Text style={styles.inputUnit}>GB</Text>
      </View>
    </View>
  );
}

function UsageRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.usageRow}>
      <Text style={styles.usageLabel}>{label}</Text>
      <Text style={styles.usageValue}>{value}</Text>
    </View>
  );
}

export default function Alerts() {
  return <UsageAlertsView />;
}

const palette = { background: COLORS.background, white: COLORS.white, muted: COLORS.secondary, secondary: COLORS.secondary, indigo: COLORS.blue, cyan: COLORS.gold };
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  page: { alignItems: "center", padding: 16, paddingTop: 16, paddingBottom: 36 },
  content: { width: "100%", maxWidth: 820 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 6 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  backGlyph: { color: palette.white, fontSize: 28, lineHeight: 31 },
  headerCopy: { flex: 1 },
  kicker: { color: COLORS.secondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  title: { marginTop: 0, color: palette.white, fontSize: 23, fontWeight: "800" },
  headerMark: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(99,102,241,0.2)", borderWidth: 1, borderColor: "rgba(129,140,248,0.3)" },
  headerMarkText: { color: palette.cyan, fontWeight: "800", fontSize: 17 },
  subtitle: { marginTop: 14, marginBottom: 16, color: palette.secondary, fontSize: 12 },
  notice: { padding: 14, marginBottom: 14, borderRadius: 15, backgroundColor: "rgba(245,158,11,0.07)", borderWidth: 1, borderColor: "rgba(245,158,11,0.18)" },
  noticeTitle: { color: COLORS.orange, fontSize: 14, fontWeight: "700" },
  noticeText: { marginTop: 5, color: palette.secondary, fontSize: 12, lineHeight: 18 },
  loadingCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, marginBottom: 14, borderRadius: 16, backgroundColor: COLORS.card },
  loadingText: { color: palette.secondary, fontSize: 13 },
  card: { padding: 16, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  settingRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10 },
  capRow: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  settingCopy: { flex: 1 },
  settingTitle: { color: "#F1F5F9", fontSize: 14, fontWeight: "700" },
  settingSubtitle: { marginTop: 4, color: palette.muted, fontSize: 12, lineHeight: 17 },
  separator: { height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  inputWrap: { width: 122, height: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 9, borderRadius: 10, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, minWidth: 0, color: palette.white, fontSize: 14, textAlign: "right" },
  inputUnit: { marginLeft: 6, color: palette.muted, fontSize: 12 },
  errorCard: { padding: 13, marginTop: 12, borderRadius: 14, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  errorTitle: { color: COLORS.red, fontSize: 13, fontWeight: "700" },
  errorText: { marginTop: 4, color: palette.secondary, fontSize: 12, lineHeight: 18 },
  savedMessage: { marginTop: 10, color: COLORS.green, fontSize: 12 },
  saveButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 14, borderRadius: 12, backgroundColor: COLORS.blue, borderWidth: 1, borderColor: COLORS.blue },
  saveButtonText: { color: palette.white, fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 22, marginBottom: 10 },
  sectionTitle: { color: palette.white, fontSize: 15, fontWeight: "700" },
  sectionCaption: { marginTop: 4, color: palette.muted, fontSize: 12, lineHeight: 17 },
  sampleCount: { color: palette.muted, fontSize: 12 },
  usageRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  usageLabel: { color: palette.secondary, fontSize: 13 },
  usageValue: { color: palette.white, fontSize: 13, fontWeight: "700", textAlign: "right" },
  permissionText: { marginTop: 10, color: "#CBD5E1", fontSize: 12, lineHeight: 18 },
  alertCard: { padding: 16, marginBottom: 10, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  alertTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  alertTitle: { flex: 1, color: "#F1F5F9", fontSize: 14, fontWeight: "700" },
  alertPeriod: { color: COLORS.secondary, fontSize: 12, textTransform: "uppercase" },
  alertBody: { marginTop: 7, color: palette.secondary, fontSize: 12, lineHeight: 18 },
  alertTime: { marginTop: 7, color: palette.muted, fontSize: 12 },
  emptyHistory: { paddingVertical: 18, color: palette.muted, fontSize: 13, textAlign: "center" },
});

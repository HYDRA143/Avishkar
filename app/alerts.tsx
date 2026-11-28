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
import { Link, Stack } from "expo-router";
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

  const totalsReady = (monitor?.sampleCount ?? 0) >= 2;
  const lastSample = monitor?.lastSampleAt
    ? new Date(monitor.lastSampleAt).toLocaleString()
    : "Waiting for first sample";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Link href="/" asChild><Pressable style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable></Link>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>NETGUARD · USAGE MONITOR</Text>
            <Text style={styles.title}>Usage alerts</Text>
          </View>
          <View style={styles.headerMark}><Text style={styles.headerMarkText}>◉</Text></View>
        </View>
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

        {error ? <View style={styles.errorCard}><Text style={styles.errorTitle}>Action required</Text><Text style={styles.errorText}>{error}</Text></View> : null}
        {savedMessage ? <Text style={styles.savedMessage}>{savedMessage}</Text> : null}

        <Pressable
          onPress={() => void save()}
          disabled={loading || saving}
          style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, (loading || saving) && styles.disabled]}
          accessibilityRole="button"
        >
          <Text style={styles.saveButtonText}>{saving ? "Saving…" : "Save alert settings"}</Text>
          {saving ? <ActivityIndicator color={palette.white} /> : <Text style={styles.saveArrow}>→</Text>}
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

        {monitor?.lastError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Latest monitoring error</Text>
            <Text style={styles.errorText}>{monitor.lastError}</Text>
          </View>
        ) : null}

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
        trackColor={{ false: "rgba(148,163,184,0.28)", true: "rgba(99,102,241,0.8)" }}
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
  subtitle: { marginTop: 14, marginBottom: 16, color: palette.secondary, fontSize: 11 },
  notice: { padding: 14, marginBottom: 14, borderRadius: 15, backgroundColor: "rgba(245,158,11,0.07)", borderWidth: 1, borderColor: "rgba(245,158,11,0.18)" },
  noticeTitle: { color: "#FCD34D", fontSize: 11, fontWeight: "700" },
  noticeText: { marginTop: 5, color: palette.secondary, fontSize: 10, lineHeight: 15 },
  loadingCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 15, marginBottom: 14, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.055)" },
  loadingText: { color: palette.secondary, fontSize: 10 },
  card: { paddingHorizontal: 14, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  settingRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10 },
  capRow: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  settingCopy: { flex: 1 },
  settingTitle: { color: "#F1F5F9", fontSize: 11, fontWeight: "700" },
  settingSubtitle: { marginTop: 4, color: palette.muted, fontSize: 9, lineHeight: 13 },
  separator: { height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  inputWrap: { width: 122, height: 40, flexDirection: "row", alignItems: "center", paddingHorizontal: 9, borderRadius: 10, backgroundColor: "rgba(8,11,20,0.7)", borderWidth: 1, borderColor: "rgba(148,163,184,0.18)" },
  input: { flex: 1, minWidth: 0, color: palette.white, fontSize: 11, textAlign: "right" },
  inputUnit: { marginLeft: 6, color: palette.muted, fontSize: 9 },
  errorCard: { padding: 13, marginTop: 12, borderRadius: 14, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  errorTitle: { color: "#FCA5A5", fontSize: 11, fontWeight: "700" },
  errorText: { marginTop: 4, color: palette.secondary, fontSize: 10, lineHeight: 15 },
  savedMessage: { marginTop: 10, color: "#6EE7B7", fontSize: 10 },
  saveButton: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, marginTop: 14, borderRadius: 12, backgroundColor: "#252A66", borderWidth: 1, borderColor: "rgba(129,140,248,0.34)" },
  saveButtonText: { color: palette.white, fontSize: 10, fontWeight: "700" },
  saveArrow: { color: palette.cyan, fontSize: 17 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 22, marginBottom: 10 },
  sectionTitle: { color: palette.white, fontSize: 15, fontWeight: "700" },
  sectionCaption: { marginTop: 4, color: palette.muted, fontSize: 9, lineHeight: 14 },
  sampleCount: { color: palette.muted, fontSize: 8 },
  usageRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  usageLabel: { color: palette.secondary, fontSize: 10 },
  usageValue: { color: palette.white, fontSize: 10, fontWeight: "700", textAlign: "right" },
  permissionText: { marginTop: 10, color: "#CBD5E1", fontSize: 9, lineHeight: 14 },
  alertCard: { padding: 14, marginBottom: 9, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  alertTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  alertTitle: { flex: 1, color: "#F1F5F9", fontSize: 10, fontWeight: "700" },
  alertPeriod: { color: "#A5B4FC", fontSize: 8, textTransform: "uppercase" },
  alertBody: { marginTop: 7, color: palette.secondary, fontSize: 9, lineHeight: 14 },
  alertTime: { marginTop: 7, color: palette.muted, fontSize: 8 },
  emptyHistory: { paddingVertical: 18, color: palette.muted, fontSize: 10, textAlign: "center" },
});

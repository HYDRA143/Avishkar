import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, Stack } from "expo-router";

type ReportItem = {
  id: string;
  time: string;
  devices: unknown;
  bandwidth: unknown;
  guard: unknown;
};

type JsonRecord = Record<string, unknown>;

const config = (): { base: string; key: string } => {
  const runtime = globalThis as typeof globalThis & {
    __NETGUARD_CONFIG__?: { apiBaseUrl?: string; apiKey?: string };
  };
  return {
    base: (runtime.__NETGUARD_CONFIG__?.apiBaseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, ""),
    key: runtime.__NETGUARD_CONFIG__?.apiKey ?? process.env.EXPO_PUBLIC_NETGUARD_API_KEY ?? "",
  };
};

const asRecord = (value: unknown): JsonRecord | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : null;

const stringField = (record: JsonRecord, ...keys: string[]): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const countEntries = (value: unknown): number =>
  Array.isArray(value)
    ? value.length
    : typeof value === "string" && value.trim()
      ? Math.max(1, [...value.matchAll(/Device\s*\(/g)].length)
      : 0;

const sumCounters = (value: unknown, fields: ReadonlyArray<string>): number => {
  const entries = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return entries.reduce<number>((total, entry) => {
    if (typeof entry === "string") {
      const matches = [...entry.matchAll(/InterfaceBandwidth\s*\(([^)]*)\)/g)];
      const lines = matches.length > 0 ? matches.map((match) => match[1]) : [entry];
      const subtotal = lines.reduce((lineTotal, line) => {
        for (const field of fields) {
          const values = [...line.matchAll(new RegExp(`${field}\\s*=\\s*([0-9]+)`, "g"))];
          if (values.length > 0) {
            return lineTotal + values.reduce((sum, match) => sum + Number(match[1]), 0);
          }
        }
        return lineTotal;
      }, 0);
      return total + subtotal;
    }
    const item = asRecord(entry);
    const raw = item && fields.map((field) => item[field]).find((candidate) => candidate !== undefined);
    return total + (typeof raw === "number" && Number.isFinite(raw) ? raw : typeof raw === "string" && Number.isFinite(Number(raw)) ? Number(raw) : 0);
  }, 0);
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
};

function ReportsView({ refreshKey, onRefresh }: { refreshKey: number; onRefresh: () => void }) {
  const [reports, setReports] = useState<ReadonlyArray<ReportItem>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const response = await fetch(`${base}/api/report`, {
          headers: { "x-api-key": key },
          signal: controller.signal,
        });
        const payload: unknown = await response.json();
        if (!response.ok) {
          throw new Error(stringField(asRecord(payload) ?? {}, "error") || `Reports request failed with status ${response.status}`);
        }
        const raw = asRecord(payload)?.reports;
        const parsed = Array.isArray(raw)
          ? raw.flatMap((item): ReadonlyArray<ReportItem> => {
            const value = asRecord(item);
            if (!value) return [];
            const time = stringField(value, "time", "timestamp", "createdAt");
            return [{
              id: stringField(value, "id") || time,
              time,
              devices: value.devices,
              bandwidth: value.bandwidth,
              guard: value.gateway ?? value.guard,
            }];
          })
          : [];
        if (!controller.signal.aborted) {
          setReports(parsed);
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
    return () => controller.abort();
  }, [refreshKey]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Link href="/" asChild><Pressable style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable></Link>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>NETGUARD · ACTIVITY</Text>
            <Text style={styles.title}>Reports</Text>
          </View>
          <View style={styles.headerMark}><Text style={styles.headerMarkText}>N</Text></View>
        </View>
        <Text style={styles.subtitle}>Live snapshots generated from gateway telemetry.</Text>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Reports unavailable</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading && reports.length === 0 ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={palette.cyan} />
            <Text style={styles.stateTitle}>Collecting live snapshot</Text>
            <Text style={styles.stateText}>Requesting the latest gateway report.</Text>
          </View>
        ) : reports.length === 0 && !error ? (
          <View style={styles.stateCard}>
            <View style={styles.emptyIcon}><Text style={styles.emptyGlyph}>▤</Text></View>
            <Text style={styles.stateTitle}>No reports yet</Text>
            <Text style={styles.stateText}>Refresh to generate a report from current gateway data.</Text>
            <Pressable onPress={onRefresh} style={({ pressed }) => [styles.inlineButton, pressed && styles.pressed]}>
              <Text style={styles.inlineButtonText}>Refresh to generate</Text>
            </Pressable>
          </View>
        ) : (
          reports.map((report) => {
            const deviceCount = countEntries(report.devices);
            const received = sumCounters(report.bandwidth, ["received_bytes", "rx_bytes"]);
            const sent = sumCounters(report.bandwidth, ["sent_bytes", "transmitted_bytes", "tx_bytes"]);
            const guardReady = asRecord(report.guard)?.ready === true;
            return (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportTop}>
                  <View>
                    <Text style={styles.reportKicker}>GATEWAY SNAPSHOT</Text>
                    <Text style={styles.reportTime}>
                      {report.time ? new Date(report.time).toLocaleString() : "Time unavailable"}
                    </Text>
                  </View>
                  <View style={[styles.guardBadge, guardReady && styles.guardBadgeReady]}>
                    <View style={[styles.guardDot, guardReady && styles.guardDotReady]} />
                    <Text style={[styles.guardText, guardReady && styles.guardTextReady]}>
                      {guardReady ? "READY" : "NOT READY"}
                    </Text>
                  </View>
                </View>
                <View style={styles.metrics}>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>{deviceCount}</Text>
                    <Text style={styles.metricLabel}>DEVICES</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>{formatBytes(received)}</Text>
                    <Text style={styles.metricLabel}>DOWN</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>{formatBytes(sent)}</Text>
                    <Text style={styles.metricLabel}>UP</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

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

export default function Reports() {
  const [refreshKey, setRefreshKey] = useState(0);
  return <ReportsView refreshKey={refreshKey} onRefresh={() => setRefreshKey((key) => key + 1)} />;
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
  stateCard: { minHeight: 220, alignItems: "center", justifyContent: "center", padding: 22, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  emptyIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "rgba(99,102,241,0.16)" },
  emptyGlyph: { color: "#A5B4FC", fontSize: 22 },
  stateTitle: { marginTop: 12, color: "#E2E8F0", fontSize: 13, fontWeight: "700", textAlign: "center" },
  stateText: { maxWidth: 280, marginTop: 5, color: palette.muted, fontSize: 10, lineHeight: 15, textAlign: "center" },
  inlineButton: { paddingHorizontal: 15, paddingVertical: 10, marginTop: 16, borderRadius: 11, backgroundColor: "rgba(99,102,241,0.2)", borderWidth: 1, borderColor: "rgba(129,140,248,0.3)" },
  inlineButtonText: { color: "#C7D2FE", fontSize: 10, fontWeight: "700" },
  reportCard: { padding: 16, marginBottom: 12, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  reportTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 9, paddingBottom: 15 },
  reportKicker: { color: "#A5B4FC", fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  reportTime: { marginTop: 6, color: palette.secondary, fontSize: 10 },
  guardBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(245,158,11,0.08)" },
  guardBadgeReady: { backgroundColor: "rgba(16,185,129,0.09)" },
  guardDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#F59E0B" },
  guardDotReady: { backgroundColor: "#10B981" },
  guardText: { color: "#FCD34D", fontSize: 8, fontWeight: "800" },
  guardTextReady: { color: "#6EE7B7" },
  metrics: { flexDirection: "row", alignItems: "center", paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  metric: { flex: 1, gap: 5 },
  metricValue: { color: palette.white, fontSize: 15, fontWeight: "800" },
  metricLabel: { color: palette.muted, fontSize: 8, fontWeight: "700", letterSpacing: 0.8 },
  metricDivider: { width: 1, height: 25, marginHorizontal: 8, backgroundColor: "rgba(255,255,255,0.1)" },
  refreshButton: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, marginTop: 18, borderRadius: 17, backgroundColor: "#252A66", borderWidth: 1, borderColor: "rgba(129,140,248,0.34)" },
  pressed: { opacity: 0.82 },
  refreshGlyph: { color: palette.cyan, fontSize: 24 },
  refreshCopy: { flex: 1 },
  refreshTitle: { color: palette.white, fontSize: 12, fontWeight: "700" },
  refreshCaption: { marginTop: 3, color: "#A5B4C7", fontSize: 9 },
  refreshArrow: { color: "#A5B4FC", fontSize: 17 },
});

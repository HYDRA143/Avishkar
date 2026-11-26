import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, Stack } from "expo-router";
import { vpnService } from "../src/features/sim-monitor/vpnService";

export default function SimBypass() {
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const openSettings = async (): Promise<void> => {
    setError(null);
    setOpening(true);
    try {
      await vpnService.openMobileDataSettings();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open mobile data settings");
    } finally {
      setOpening(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Link href="/" asChild><Pressable style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable></Link>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>NETGUARD · SIM MONITOR</Text>
            <Text style={styles.title}>Manual controls</Text>
          </View>
          <View style={styles.headerMark}><Text style={styles.headerMarkText}>N</Text></View>
        </View>
        <Text style={styles.subtitle}>You stay in control of mobile data at all times.</Text>

        <View style={styles.hero}>
          <View style={styles.warningIcon}><Text style={styles.warningGlyph}>!</Text></View>
          <Text style={styles.eyebrow}>WARNING ONLY</Text>
          <Text style={styles.heroTitle}>No automatic blocking.</Text>
          <Text style={styles.heroText}>
            NetGuard can notify you about SIM usage. It will never switch off mobile data automatically.
          </Text>
          <View style={styles.policyRow}>
            <View style={styles.policyDot} />
            <Text style={styles.policyText}>Any mobile-data change is manual and happens in Android settings.</Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Couldn’t open system settings</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.manualCard}>
          <View style={styles.manualTop}>
            <View style={styles.manualIcon}><Text style={styles.manualGlyph}>↗</Text></View>
            <View style={styles.manualCopy}>
              <Text style={styles.manualTitle}>Mobile data settings</Text>
              <Text style={styles.manualCaption}>Review your connection and switch it off yourself.</Text>
            </View>
          </View>
          <Pressable
            onPress={() => void openSettings()}
            disabled={opening}
            style={({ pressed }) => [styles.manualButton, pressed && styles.pressed, opening && styles.disabled]}
            accessibilityRole="button"
          >
            <Text style={styles.manualButtonText}>{opening ? "Opening settings…" : "Open Android mobile data settings"}</Text>
            <Text style={styles.manualArrow}>→</Text>
          </Pressable>
        </View>

        <View style={styles.note}>
          <Text style={styles.noteTitle}>Manual off, only</Text>
          <Text style={styles.noteText}>
            This screen does not disable cellular data or perform network actions. Use your device’s system controls.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
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
  subtitle: { marginTop: 14, marginBottom: 19, color: palette.secondary, fontSize: 11 },
  hero: { padding: 20, borderRadius: 21, backgroundColor: "#11162B", borderWidth: 1, borderColor: "rgba(245,158,11,0.2)" },
  warningIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", marginBottom: 16, borderRadius: 14, backgroundColor: "rgba(245,158,11,0.14)", borderWidth: 1, borderColor: "rgba(245,158,11,0.2)" },
  warningGlyph: { color: "#FCD34D", fontSize: 21, fontWeight: "800" },
  eyebrow: { color: "#FCD34D", fontSize: 8, fontWeight: "800", letterSpacing: 1.5 },
  heroTitle: { marginTop: 8, color: palette.white, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  heroText: { marginTop: 8, color: palette.secondary, fontSize: 11, lineHeight: 17 },
  policyRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingTop: 14, marginTop: 15, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" },
  policyDot: { width: 6, height: 6, marginTop: 4, borderRadius: 3, backgroundColor: "#F59E0B" },
  policyText: { flex: 1, color: "#CBD5E1", fontSize: 10, lineHeight: 15 },
  errorCard: { padding: 13, marginTop: 14, borderRadius: 14, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  errorTitle: { color: "#FCA5A5", fontSize: 12, fontWeight: "700" },
  errorText: { marginTop: 4, color: palette.secondary, fontSize: 10, lineHeight: 15 },
  manualCard: { padding: 15, marginTop: 15, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  manualTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  manualIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(99,102,241,0.17)" },
  manualGlyph: { color: "#A5B4FC", fontSize: 19 },
  manualCopy: { flex: 1 },
  manualTitle: { color: "#F1F5F9", fontSize: 12, fontWeight: "700" },
  manualCaption: { marginTop: 4, color: palette.muted, fontSize: 9, lineHeight: 14 },
  manualButton: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, marginTop: 15, borderRadius: 12, backgroundColor: "#252A66", borderWidth: 1, borderColor: "rgba(129,140,248,0.34)" },
  manualButtonText: { color: palette.white, fontSize: 10, fontWeight: "700" },
  manualArrow: { color: palette.cyan, fontSize: 17 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.6 },
  note: { padding: 14, marginTop: 15, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  noteTitle: { color: "#CBD5E1", fontSize: 10, fontWeight: "700" },
  noteText: { marginTop: 5, color: palette.muted, fontSize: 9, lineHeight: 14 },
});

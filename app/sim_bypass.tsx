import { useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { vpnService } from "../src/features/sim-monitor/vpnService";
import { AppHeader, AppIcon, COLORS, ErrorCard } from "./_components/design";

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
    <SafeAreaView style={styles.screen} edges={["top", "bottom", "left", "right"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.screen} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader back liveStatus="MANUAL ONLY" />
        <View style={styles.titleRow}><AppIcon name="smartphone" color={COLORS.gold} size={22} /><Text style={styles.title}>Manual controls</Text></View>
        <Text style={styles.subtitle}>You stay in control of mobile data at all times.</Text>

        <View style={styles.futureNotice}>
          <Text style={styles.futureTitle}>SIM measurement is future scope</Text>
          <Text style={styles.futureText}>
            No real SIM usage is collected in this build. Connect the app to a supported Android phone with the required permissions before enabling SIM alerts.
          </Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.warningIcon}><AppIcon name="notifications-active" color={COLORS.orange} size={23} /></View>
          <Text style={styles.eyebrow}>WARNING ONLY</Text>
          <Text style={styles.heroTitle}>No automatic blocking.</Text>
          <Text style={styles.heroText}>
            SIM usage is not measured in this build. This screen only provides manual access to Android mobile-data settings.
          </Text>
          <View style={styles.policyRow}>
            <View style={styles.policyDot} />
            <Text style={styles.policyText}>Any mobile-data change is manual and happens in Android settings.</Text>
          </View>
        </View>

        {error ? <ErrorCard title="Couldn’t open system settings" message={error} onRetry={() => void openSettings()} /> : null}

        <View style={styles.manualCard}>
          <View style={styles.manualTop}>
            <View style={styles.manualIcon}><AppIcon name="open-in-new" color={COLORS.blue} size={21} /></View>
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
            <AppIcon name="arrow-forward" color={COLORS.white} size={18} />
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
    </SafeAreaView>
  );
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
  subtitle: { marginTop: 14, marginBottom: 19, color: palette.secondary, fontSize: 12 },
  futureNotice: { padding: 14, marginBottom: 15, borderRadius: 16, backgroundColor: "rgba(245,158,11,0.07)", borderWidth: 1, borderColor: "rgba(245,158,11,0.18)" },
  futureTitle: { color: COLORS.orange, fontSize: 14, fontWeight: "700" },
  futureText: { marginTop: 5, color: palette.secondary, fontSize: 12, lineHeight: 18 },
  hero: { padding: 20, borderRadius: 16, backgroundColor: COLORS.darkBlue, borderWidth: 1, borderColor: COLORS.orange },
  warningIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", marginBottom: 16, borderRadius: 14, backgroundColor: "rgba(245,158,11,0.14)", borderWidth: 1, borderColor: "rgba(245,158,11,0.2)" },
  warningGlyph: { color: "#FCD34D", fontSize: 21, fontWeight: "800" },
  eyebrow: { color: COLORS.orange, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  heroTitle: { marginTop: 8, color: palette.white, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  heroText: { marginTop: 8, color: palette.secondary, fontSize: 13, lineHeight: 19 },
  policyRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingTop: 14, marginTop: 15, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" },
  policyDot: { width: 6, height: 6, marginTop: 4, borderRadius: 3, backgroundColor: "#F59E0B" },
  policyText: { flex: 1, color: "#CBD5E1", fontSize: 12, lineHeight: 18 },
  errorCard: { padding: 13, marginTop: 14, borderRadius: 14, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  errorTitle: { color: COLORS.red, fontSize: 14, fontWeight: "700" },
  errorText: { marginTop: 4, color: palette.secondary, fontSize: 12, lineHeight: 18 },
  manualCard: { padding: 16, marginTop: 15, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  manualTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  manualIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "rgba(99,102,241,0.17)" },
  manualGlyph: { color: "#A5B4FC", fontSize: 19 },
  manualCopy: { flex: 1 },
  manualTitle: { color: "#F1F5F9", fontSize: 12, fontWeight: "700" },
  manualCaption: { marginTop: 4, color: palette.muted, fontSize: 12, lineHeight: 17 },
  manualButton: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 15, borderRadius: 12, backgroundColor: COLORS.blue, borderWidth: 1, borderColor: COLORS.blue },
  manualButtonText: { color: palette.white, fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.6 },
  note: { padding: 16, marginTop: 15, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  noteTitle: { color: "#CBD5E1", fontSize: 13, fontWeight: "700" },
  noteText: { marginTop: 5, color: palette.muted, fontSize: 12, lineHeight: 17 },
});

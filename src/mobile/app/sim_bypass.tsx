import { vpnService } from "../../features/sim-monitor/vpnService";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

export default function SimBypass() {
  const [error, setError] = useState<string | null>(null);

  const openSettings = async (): Promise<void> => {
    setError(null);
    try {
      await vpnService.openMobileDataSettings();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open mobile data settings");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Manual mobile data control</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable onPress={() => void openSettings()} style={styles.button}>
        <Text style={styles.buttonText}>Turn off mobile data in Android settings</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  error: { color: "#f87171" },
  button: { backgroundColor: "#2563eb", padding: 12, borderRadius: 8 },
  buttonText: { color: "#fff", textAlign: "center" },
});

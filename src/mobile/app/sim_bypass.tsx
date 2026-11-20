import { vpnService } from "../../features/sim-monitor/vpnService";
import { useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";

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
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700" }}>Manual mobile data control</Text>
      {error ? <Text style={{ color: "#f87171" }}>{error}</Text> : null}
      <Pressable onPress={() => void openSettings()} style={{ backgroundColor: "#2563eb", padding: 12, borderRadius: 8 }}>
        <Text style={{ color: "#fff", textAlign: "center" }}>Turn off mobile data in Android settings</Text>
      </Pressable>
    </ScrollView>
  );
}

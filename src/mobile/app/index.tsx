import { BandwidthMeter } from "../components/BandwidthMeter";
import { DeviceList } from "../components/DeviceList";
import { SelfHealingBadge } from "../components/SelfHealingBadge";
import { WifiUsageCard } from "../components/WifiUsageCard";
import { useDeviceUsage } from "../hooks/useDeviceUsage";
import { useSelfHealing } from "../hooks/useSelfHealing";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";

export default function Home() {
  const usageState = useDeviceUsage();
  const healingState = useSelfHealing();
  const totalBytes = usageState.usage.reduce((sum, point) => sum + point.bytes, 0);
  const latestLimit = null;
  const devices = DeviceList(usageState.devices);
  const wifi = WifiUsageCard(usageState.usage.length > 0 ? totalBytes : null);
  const bandwidth = BandwidthMeter(totalBytes, latestLimit);
  const selfHealing = SelfHealingBadge(healingState.active, healingState.message);
  const error = usageState.error ?? healingState.error;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>NetGuard</Text>
      {usageState.loading || healingState.loading ? <Text style={styles.muted}>Loading...</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View>
        <Text style={styles.sectionTitle}>{devices.title}</Text>
        {devices.empty
          ? <Text style={styles.muted}>{devices.message}</Text>
          : devices.items.map((item) => (
              <Text key={item.id} style={styles.device}>
                {item.label}{item.detail ? ` - ${item.detail}` : ""}
              </Text>
            ))}
      </View>
      <Text style={styles.wifiTitle}>{wifi.title}: {wifi.value}</Text>
      <Text style={styles.text}>{bandwidth.message}</Text>
      <Text style={styles.text}>{selfHealing.label}</Text>
      <Link href="/graph" style={styles.link}>Usage graph</Link>
      <Link href="/reports" style={styles.link}>Reports</Link>
      <Link href="/status" style={styles.link}>System status</Link>
      <Link href="/settings" style={styles.link}>Settings</Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  title: { color: "#fff", fontSize: 28, fontWeight: "700" },
  muted: { color: "#9ca3af" },
  error: { color: "#f87171" },
  sectionTitle: { color: "#fff", fontSize: 20 },
  device: { color: "#d1d5db", paddingVertical: 4 },
  wifiTitle: { color: "#fff", fontSize: 18 },
  text: { color: "#d1d5db" },
  link: { color: "#60a5fa" },
});

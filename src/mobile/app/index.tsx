import { BandwidthMeter } from "../components/BandwidthMeter";
import { DeviceList } from "../components/DeviceList";
import { SelfHealingBadge } from "../components/SelfHealingBadge";
import { WifiUsageCard } from "../components/WifiUsageCard";
import { useDeviceUsage } from "../hooks/useDeviceUsage";
import { useSelfHealing } from "../hooks/useSelfHealing";
import { ScrollView, Text, View } from "react-native";
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
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700" }}>NetGuard</Text>
      {usageState.loading || healingState.loading ? <Text style={{ color: "#9ca3af" }}>Loading...</Text> : null}
      {error ? <Text style={{ color: "#f87171" }}>{error}</Text> : null}
      <View>
        <Text style={{ color: "#fff", fontSize: 20 }}>{devices.title}</Text>
        {devices.empty
          ? <Text style={{ color: "#9ca3af" }}>{devices.message}</Text>
          : devices.items.map((item) => (
              <Text key={item.id} style={{ color: "#d1d5db", paddingVertical: 4 }}>
                {item.label}{item.detail ? ` - ${item.detail}` : ""}
              </Text>
            ))}
      </View>
      <Text style={{ color: "#fff", fontSize: 18 }}>{wifi.title}: {wifi.value}</Text>
      <Text style={{ color: "#d1d5db" }}>{bandwidth.message}</Text>
      <Text style={{ color: "#d1d5db" }}>{selfHealing.label}</Text>
      <Link href="/graph" style={{ color: "#60a5fa" }}>Usage graph</Link>
      <Link href="/reports" style={{ color: "#60a5fa" }}>Reports</Link>
      <Link href="/status" style={{ color: "#60a5fa" }}>System status</Link>
      <Link href="/settings" style={{ color: "#60a5fa" }}>Settings</Link>
    </ScrollView>
  );
}

import { useEffect } from "react";
import { Stack } from "expo-router";
import { startUsageMonitor } from "../src/features/wifi-monitor/usageAlerts";

export default function RootLayout() {
  useEffect(() => startUsageMonitor(), []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#101827" },
        headerTintColor: "#ffffff",
        contentStyle: { backgroundColor: "#0b1220" },
      }}
    />
  );
}

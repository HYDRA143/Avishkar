import { useEffect } from "react";
import { Stack } from "expo-router";
import { startUsageMonitor } from "../src/features/wifi-monitor/usageAlerts";

export default function RootLayout() {
  useEffect(() => startUsageMonitor(), []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0B1B3A" },
        headerTintColor: "#FFFFFF",
        contentStyle: { backgroundColor: "#070D1F" },
      }}
    />
  );
}

import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Stack, useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { startUsageMonitor } from "../src/features/wifi-monitor/usageAlerts";

export default function RootLayout() {
  useEffect(() => startUsageMonitor(), []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={[]}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#070D1F" },
          }}
        />
        <BottomNavigation />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const tabs = [
  { label: "Devices", icon: "devices" as const, path: "/?view=devices" },
  { label: "Graph", icon: "show-chart" as const, path: "/graph" },
  { label: "Home", icon: "home" as const, path: "/?view=home" },
  { label: "Reports", icon: "assessment" as const, path: "/reports" },
  { label: "Settings", icon: "settings" as const, path: "/settings" },
];

function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ view?: string }>();
  const indexView = params.view;
  const selected = pathname === "/"
    ? indexView === "devices" ? "Devices" : "Home"
    : pathname === "/graph" ? "Graph"
      : pathname === "/reports" ? "Reports"
        : pathname === "/settings" ? "Settings" : "";

  return (
    <SafeAreaView edges={["bottom"]} style={styles.navSafeArea}>
      <View style={styles.navbar}>
        {tabs.map((tab) => {
          const active = selected === tab.label;
          const home = tab.label === "Home";
          return (
            <Pressable
              key={tab.label}
              onPress={() => router.navigate(tab.path)}
              style={styles.tab}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.iconWrap, home && styles.homeIconWrap, active && !home && styles.activeIconWrap]}>
                <MaterialIcons
                  name={tab.icon}
                  size={home ? 29 : 24}
                  color={home ? "#FFFFFF" : active ? "#1A56DB" : "#94A3B8"}
                />
              </View>
              {!home ? <View style={[styles.activeDot, active && styles.activeDotVisible]} /> : null}
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#070D1F" },
  navSafeArea: { backgroundColor: "#101A33" },
  navbar: {
    height: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: "#101A33",
  },
  tab: { flex: 1, height: 60, alignItems: "center", justifyContent: "center" },
  iconWrap: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21 },
  activeIconWrap: { backgroundColor: "rgba(26,86,219,0.12)" },
  homeIconWrap: {
    width: 56,
    height: 56,
    marginTop: -20,
    borderRadius: 28,
    backgroundColor: "#1A56DB",
    borderWidth: 2,
    borderColor: "#F5B301",
  },
  activeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "transparent" },
  activeDotVisible: { backgroundColor: "#F5B301" },
});

import { Stack } from "expo-router";

export default function MobileLayout() {
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

import { PermissionScreen } from "../components/PermissionScreen";
import { permissionService } from "../services/permissionService";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";

export default function Settings() {
  const [permissions, setPermissions] = useState(PermissionScreen(false));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async (): Promise<void> => {
      try {
        const [notifications, network] = await Promise.all([
          permissionService.check("notifications"),
          permissionService.check("network"),
        ]);
        if (!cancelled) {
          setPermissions(PermissionScreen(notifications && network));
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setPermissions(PermissionScreen(false));
          setError(caught instanceof Error ? caught.message : "Unable to check permissions");
        }
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestPermissions = async (): Promise<void> => {
    const [notifications, network] = await Promise.all([
      permissionService.request("notifications"),
      permissionService.request("network"),
    ]);
    setPermissions(PermissionScreen(notifications && network));
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700" }}>Settings</Text>
      {error ? <Text style={{ color: "#f87171" }}>{error}</Text> : null}
      <Text style={{ color: "#d1d5db" }}>{permissions.message}</Text>
      {!permissions.canContinue ? (
        <Pressable onPress={() => void requestPermissions()} style={{ backgroundColor: "#2563eb", padding: 12, borderRadius: 8 }}>
          <Text style={{ color: "#fff", textAlign: "center" }}>{permissions.actionLabel}</Text>
        </Pressable>
      ) : (
        <Text style={{ color: "#4ade80" }}>{permissions.actionLabel}</Text>
      )}
    </ScrollView>
  );
}

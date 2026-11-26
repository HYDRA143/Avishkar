import { PermissionScreen } from "../components/PermissionScreen";
import { permissionService } from "../services/permissionService";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.text}>{permissions.message}</Text>
      {!permissions.canContinue ? (
        <Pressable onPress={() => void requestPermissions()} style={styles.button}>
          <Text style={styles.buttonText}>{permissions.actionLabel}</Text>
        </Pressable>
      ) : (
        <Text style={styles.success}>{permissions.actionLabel}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  error: { color: "#f87171" },
  text: { color: "#d1d5db" },
  button: { backgroundColor: "#2563eb", padding: 12, borderRadius: 8 },
  buttonText: { color: "#fff", textAlign: "center" },
  success: { color: "#4ade80" },
});

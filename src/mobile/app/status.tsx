import { SelfHealingBadge } from "../components/SelfHealingBadge";
import { useSelfHealing } from "../hooks/useSelfHealing";
import { ScrollView, StyleSheet, Text } from "react-native";

export default function Status() {
  const state = useSelfHealing();
  const selfHealing = SelfHealingBadge(state.active, state.message);
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>System status</Text>
      {state.loading ? <Text style={styles.muted}>Loading...</Text> : null}
      {state.error ? <Text style={styles.error}>{state.error}</Text> : null}
      <Text style={styles.text}>{selfHealing.label}</Text>
      <Text style={styles.muted}>{selfHealing.detail}</Text>
      {state.lastActionAt ? <Text style={styles.muted}>Last action: {state.lastActionAt}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  muted: { color: "#9ca3af" },
  error: { color: "#f87171" },
  text: { color: "#d1d5db" },
});

import { SelfHealingBadge } from "../components/SelfHealingBadge";
import { useSelfHealing } from "../hooks/useSelfHealing";
import { ScrollView, Text } from "react-native";

export default function Status() {
  const state = useSelfHealing();
  const selfHealing = SelfHealingBadge(state.active, state.message);
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700" }}>System status</Text>
      {state.loading ? <Text style={{ color: "#9ca3af" }}>Loading...</Text> : null}
      {state.error ? <Text style={{ color: "#f87171" }}>{state.error}</Text> : null}
      <Text style={{ color: "#d1d5db" }}>{selfHealing.label}</Text>
      <Text style={{ color: "#9ca3af" }}>{selfHealing.detail}</Text>
      {state.lastActionAt ? <Text style={{ color: "#9ca3af" }}>Last action: {state.lastActionAt}</Text> : null}
    </ScrollView>
  );
}

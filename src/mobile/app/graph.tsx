import { HourlyChart } from "../components/HourlyChart";
import { UsageGraph } from "../components/UsageGraph";
import { useDeviceUsage } from "../hooks/useDeviceUsage";
import { ScrollView, Text, View } from "react-native";

export default function Graph() {
  const state = useDeviceUsage();
  const hourlyValues = state.usage.map((point) => ({
    hour: new Date(point.timestamp).toISOString().slice(11, 13),
    bytes: point.bytes,
  }));
  const graph = UsageGraph(state.usage);
  const hourly = HourlyChart(hourlyValues);
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700" }}>Usage graph</Text>
      {state.loading ? <Text style={{ color: "#9ca3af" }}>Loading...</Text> : null}
      {state.error ? <Text style={{ color: "#f87171" }}>{state.error}</Text> : null}
      <View>
        <Text style={{ color: "#fff", fontSize: 18 }}>{graph.title}</Text>
        <Text style={{ color: "#9ca3af" }}>{graph.empty ? graph.message : `${graph.points.length} samples`}</Text>
      </View>
      <View>
        <Text style={{ color: "#fff", fontSize: 18 }}>{hourly.title}</Text>
        <Text style={{ color: "#9ca3af" }}>{hourly.empty ? hourly.message : `${hourly.values.length} hourly values`}</Text>
      </View>
    </ScrollView>
  );
}

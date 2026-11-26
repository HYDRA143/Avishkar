import { HourlyChart } from "../components/HourlyChart";
import { UsageGraph } from "../components/UsageGraph";
import { useDeviceUsage } from "../hooks/useDeviceUsage";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function Graph() {
  const state = useDeviceUsage();
  const hourlyValues = state.usage.map((point) => ({
    hour: new Date(point.timestamp).toISOString().slice(11, 13),
    bytes: point.bytes,
  }));
  const graph = UsageGraph(state.usage);
  const hourly = HourlyChart(hourlyValues);
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Usage graph</Text>
      {state.loading ? <Text style={styles.muted}>Loading...</Text> : null}
      {state.error ? <Text style={styles.error}>{state.error}</Text> : null}
      <View>
        <Text style={styles.sectionTitle}>{graph.title}</Text>
        <Text style={styles.muted}>{graph.empty ? graph.message : `${graph.points.length} samples`}</Text>
      </View>
      <View>
        <Text style={styles.sectionTitle}>{hourly.title}</Text>
        <Text style={styles.muted}>{hourly.empty ? hourly.message : `${hourly.values.length} hourly values`}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  muted: { color: "#9ca3af" },
  error: { color: "#f87171" },
  sectionTitle: { color: "#fff", fontSize: 18 },
});

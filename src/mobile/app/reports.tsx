import { useReports } from "../hooks/useReports";
import { ScrollView, StyleSheet, Text } from "react-native";

export default function Reports() {
  const state = useReports();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Reports</Text>
      {state.loading ? <Text style={styles.muted}>Loading...</Text> : null}
      {state.error ? <Text style={styles.error}>{state.error}</Text> : null}
      {!state.loading && state.reports.length === 0 && !state.error
        ? <Text style={styles.muted}>No data yet</Text>
        : state.reports.map((report) => (
            <Text key={report.id} style={styles.text}>
              {report.title} - {report.createdAt}
            </Text>
          ))}
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

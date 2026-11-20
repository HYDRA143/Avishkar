import { useReports } from "../hooks/useReports";
import { ScrollView, Text } from "react-native";

export default function Reports() {
  const state = useReports();
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700" }}>Reports</Text>
      {state.loading ? <Text style={{ color: "#9ca3af" }}>Loading...</Text> : null}
      {state.error ? <Text style={{ color: "#f87171" }}>{state.error}</Text> : null}
      {!state.loading && state.reports.length === 0 && !state.error
        ? <Text style={{ color: "#9ca3af" }}>No data yet</Text>
        : state.reports.map((report) => (
            <Text key={report.id} style={{ color: "#d1d5db" }}>
              {report.title} - {report.createdAt}
            </Text>
          ))}
    </ScrollView>
  );
}

import { HourlyChart } from "../components/HourlyChart";
import { UsageGraph } from "../components/UsageGraph";
import { useDeviceUsage } from "../hooks/useDeviceUsage";

export interface GraphScreen {
  title: string;
  loading: boolean;
  error: string | null;
  graph: ReturnType<typeof UsageGraph>;
  hourly: ReturnType<typeof HourlyChart>;
}

export default async function Graph(): Promise<GraphScreen> {
  const state = await useDeviceUsage();
  const hourlyValues = state.usage.map((point) => ({
    hour: new Date(point.timestamp).toISOString().slice(11, 13),
    bytes: point.bytes,
  }));
  return {
    title: "Usage graph",
    loading: state.loading,
    error: state.error,
    graph: UsageGraph(state.usage),
    hourly: HourlyChart(hourlyValues),
  };
}

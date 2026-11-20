import type { UsagePoint } from "../hooks/useDeviceUsage";

export interface UsageGraphModel {
  title: string;
  empty: boolean;
  message: string | null;
  points: ReadonlyArray<{ timestamp: string; bytes: number }>;
  maximum: number;
  unit: string;
}

export const UsageGraph = (usage: ReadonlyArray<UsagePoint>): UsageGraphModel => {
  const points = usage.map(({ timestamp, bytes }) => ({ timestamp, bytes }));
  return {
    title: "Network usage",
    empty: points.length === 0,
    message: points.length === 0 ? "No data yet" : null,
    points,
    maximum: points.reduce((maximum, point) => Math.max(maximum, point.bytes), 0),
    unit: "bytes",
  };
};

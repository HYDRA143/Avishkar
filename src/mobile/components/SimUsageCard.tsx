import type { UsageSnapshot } from "../../features/sim-monitor/usageStats";

export interface SimUsageCardModel {
  title: string;
  empty: boolean;
  message: string;
  usage: UsageSnapshot | null;
}

export const SimUsageCard = (usage: UsageSnapshot | null): SimUsageCardModel => ({
  title: "SIM usage",
  empty: usage === null,
  message: usage === null ? "No data yet" : "",
  usage,
});

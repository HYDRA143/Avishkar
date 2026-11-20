import { usageStats, type UsageSnapshot } from "../../features/sim-monitor/usageStats";

export interface SimUsageState {
  loading: boolean;
  permissionDenied: boolean;
  error: string | null;
  data: UsageSnapshot | null;
}

const initialState: SimUsageState = {
  loading: false,
  permissionDenied: false,
  error: null,
  data: null,
};

export const useSimUsage = async (): Promise<SimUsageState> => {
  try {
    const data = await usageStats.getUsage();
    return { loading: false, permissionDenied: false, error: null, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read SIM usage";
    return {
      ...initialState,
      permissionDenied: message.includes("permission"),
      error: message,
    };
  }
};

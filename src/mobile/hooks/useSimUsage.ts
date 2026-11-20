import { useEffect, useState } from "react";

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

export const useSimUsage = (): SimUsageState => {
  const [state, setState] = useState<SimUsageState>({
    loading: true,
    permissionDenied: false,
    error: null,
    data: null,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      setState({ loading: true, permissionDenied: false, error: null, data: null });
      try {
        const data = await usageStats.getUsage();
        if (!cancelled) {
          setState({ loading: false, permissionDenied: false, error: null, data });
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to read SIM usage";
          setState({
            ...initialState,
            loading: false,
            permissionDenied: message.toLowerCase().includes("permission"),
            error: message,
          });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};

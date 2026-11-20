export interface UsageSnapshot {
  lastHourBytes: number;
  todayBytes: number;
  weekBytes: number;
  monthBytes: number;
  byApplication: ReadonlyArray<{ packageName: string; bytes: number }>;
}

interface SimNativeBridge {
  hasPermission(): boolean;
  getUsageStats(): Promise<UsageSnapshot>;
}

const getBridge = (): SimNativeBridge => {
  const bridge = (globalThis as typeof globalThis & {
    __NETGUARD_SIM_NATIVE__?: SimNativeBridge;
  }).__NETGUARD_SIM_NATIVE__;
  if (!bridge || !bridge.hasPermission()) {
    throw new Error("No real SIM data - Run on real Android device with permission");
  }
  return bridge;
};

const getUsage = async (): Promise<UsageSnapshot> => {
  try {
    return await getBridge().getUsageStats();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Android usage statistics";
    throw new Error(message);
  }
};

export const usageStats = { getUsage };

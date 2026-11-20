export interface SimInfo {
  slot: number;
  operator: string;
  signalLevel: number | null;
}

interface SimNativeBridge {
  hasPermission(): boolean;
  detectSims(): Promise<ReadonlyArray<SimInfo>>;
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

const detect = async (): Promise<ReadonlyArray<SimInfo>> => {
  try {
    return await getBridge().detectSims();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Android SIM subscriptions";
    throw new Error(message);
  }
};

export const simDetector = { detect };

export interface NetworkSnapshot {
  mobileBytes: number;
  wifiBytes: number;
  byApplication: ReadonlyArray<{
    packageName: string;
    mobileBytes: number;
    wifiBytes: number;
  }>;
}

interface SimNativeBridge {
  hasPermission(): boolean;
  getNetworkStats(): Promise<NetworkSnapshot>;
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

const getStats = async (): Promise<NetworkSnapshot> => {
  try {
    return await getBridge().getNetworkStats();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Android network statistics";
    throw new Error(message);
  }
};

const getMobile = async (): Promise<number> => (await getStats()).mobileBytes;
const getWifi = async (): Promise<number> => (await getStats()).wifiBytes;

export const networkStats = { getStats, getMobile, getWifi };

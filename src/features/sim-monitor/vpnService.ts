interface SimNativeBridge {
  hasPermission(): boolean;
  openMobileDataSettings(): Promise<void>;
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

const openMobileDataSettings = async (): Promise<void> => {
  try {
    await getBridge().openMobileDataSettings();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open mobile data settings";
    throw new Error(message);
  }
};

export const vpnService = { openMobileDataSettings };

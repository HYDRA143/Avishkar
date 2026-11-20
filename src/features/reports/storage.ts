interface ReportStorageBridge {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const bridge = (): ReportStorageBridge => {
  const value = (globalThis as typeof globalThis & {
    __NETGUARD_REPORT_STORAGE__?: ReportStorageBridge;
  }).__NETGUARD_REPORT_STORAGE__;
  if (!value) {
    throw new Error("Report storage bridge is unavailable");
  }
  return value;
};

const get = (key: string): string | null => {
  try {
    if (!key.trim()) {
      throw new Error("Storage key is required");
    }
    return bridge().get(key);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report storage read failed";
    throw new Error(message);
  }
};

const set = (key: string, value: string): void => {
  try {
    if (!key.trim()) {
      throw new Error("Storage key is required");
    }
    bridge().set(key, value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report storage write failed";
    throw new Error(message);
  }
};

export const storage = { get, set };

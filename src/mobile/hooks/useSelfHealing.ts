import { useEffect, useState } from "react";

export interface SelfHealingState {
  loading: boolean;
  active: boolean | null;
  message: string | null;
  lastActionAt: string | null;
  error: string | null;
}

type JsonObject = Record<string, unknown>;

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const readBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

export const useSelfHealing = (): SelfHealingState => {
  const [state, setState] = useState<SelfHealingState>({
    loading: true,
    active: null,
    message: null,
    lastActionAt: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const runtime = (globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
      __NETGUARD_CONFIG__?: { apiBaseUrl?: string; apiKey?: string };
    });
    const base = (runtime.__NETGUARD_CONFIG__?.apiBaseUrl ?? runtime.process?.env?.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
    const key = runtime.__NETGUARD_CONFIG__?.apiKey ?? runtime.process?.env?.EXPO_PUBLIC_NETGUARD_API_KEY ?? "";

    const load = async (): Promise<void> => {
      setState({ loading: true, active: null, message: null, lastActionAt: null, error: null });
      try {
        if (!base || !key) throw new Error("Mobile API configuration is missing");
        const response = await fetch(`${base}/api/status`, {
          headers: { "x-api-key": key },
          signal: controller.signal,
        });
        const payload: unknown = await response.json();
        if (!response.ok) {
          const error = payload as JsonObject;
          throw new Error(readString(error.error) ?? `Status request failed with status ${response.status}`);
        }
        const status = payload as JsonObject;
        if (!controller.signal.aborted) {
          setState({
            loading: false,
            active: readBoolean(status.selfHealing ?? status.self_healing ?? status.active),
            message: readString(status.message),
            lastActionAt: readString(status.lastActionAt ?? status.last_action_at),
            error: null,
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            loading: false,
            active: null,
            message: null,
            lastActionAt: null,
            error: error instanceof Error ? error.message : "Unable to load self-healing status",
          });
        }
      }
    };

    void load();
    return () => controller.abort();
  }, []);

  return state;
};

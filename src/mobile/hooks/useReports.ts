export interface Report {
  id: string;
  title: string;
  createdAt: string;
  summary?: string;
  downloadUrl?: string;
}

export interface ReportsState {
  loading: boolean;
  reports: ReadonlyArray<Report>;
  error: string | null;
}

type JsonObject = Record<string, unknown>;

const config = (): { base: string; key: string } => {
  const runtime = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
    __NETGUARD_CONFIG__?: { apiBaseUrl?: string; apiKey?: string };
  });
  return {
    base: (runtime.__NETGUARD_CONFIG__?.apiBaseUrl ?? runtime.process?.env?.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, ""),
    key: runtime.__NETGUARD_CONFIG__?.apiKey ?? runtime.process?.env?.EXPO_PUBLIC_NETGUARD_API_KEY ?? "",
  };
};

const object = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : null;

const string = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

export const useReports = async (): Promise<ReportsState> => {
  const controller = new AbortController();
  const { base, key } = config();
  try {
    if (!base || !key) {
      throw new Error("Mobile API configuration is missing");
    }
    const response = await fetch(`${base}/api/report`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify({}),
      signal: controller.signal,
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      throw new Error(string(object(payload)?.error) ?? `Report request failed with status ${response.status}`);
    }
    const raw = object(payload)?.reports ?? object(payload)?.data ?? payload;
    const reports = (Array.isArray(raw) ? raw : []).flatMap((value): ReadonlyArray<Report> => {
      const item = object(value);
      const id = string(item?.id ?? item?.reportId);
      const title = string(item?.title ?? item?.name);
      const createdAt = string(item?.createdAt ?? item?.created_at ?? item?.timestamp);
      if (!id || !title || !createdAt) return [];
      return [{ id, title, createdAt, summary: string(item?.summary), downloadUrl: string(item?.downloadUrl ?? item?.url) }];
    });
    return { loading: false, reports, error: null };
  } catch (error) {
    return { loading: false, reports: [], error: error instanceof Error ? error.message : "Unable to load reports" };
  } finally {
    controller.abort();
  }
};

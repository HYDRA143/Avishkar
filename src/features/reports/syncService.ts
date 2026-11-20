import { storage } from "./storage";

export interface SignedReport {
  [key: string]: unknown;
  signature: string;
}

export interface SyncResult {
  synced: boolean;
  queued: boolean;
  error: string | null;
}

const QUEUE_KEY = "netguard.report.queue";

const sync = async (
  report: SignedReport,
  endpoint: string,
  apiKey: string,
): Promise<SyncResult> => {
  try {
    if (!endpoint.trim() || !apiKey.trim()) {
      throw new Error("Report sync endpoint and API key are required");
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(report),
    });
    if (!response.ok) {
      throw new Error(`Report sync failed with status ${response.status}`);
    }
    return { synced: true, queued: false, error: null };
  } catch (error) {
    try {
      const current = storage.get(QUEUE_KEY);
      const reports: SignedReport[] = current ? JSON.parse(current) as SignedReport[] : [];
      reports.push(report);
      storage.set(QUEUE_KEY, JSON.stringify(reports));
      const message = error instanceof Error ? error.message : "Report sync failed";
      return { synced: false, queued: true, error: message };
    } catch (queueError) {
      const message = queueError instanceof Error ? queueError.message : "Report queue failed";
      throw new Error(message);
    }
  }
};

export const syncService = { sync };

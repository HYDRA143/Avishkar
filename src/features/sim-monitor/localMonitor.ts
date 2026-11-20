import { notificationService } from "../../mobile/services/notificationService";
import { usageStats, type UsageSnapshot } from "./usageStats";

export interface MonitorResult {
  usage: UsageSnapshot;
  warning: boolean;
  alarm: boolean;
}

const ONE_HOUR_BYTES = 50 * 1024 * 1024;
const ALARM_HOUR_BYTES = 100 * 1024 * 1024;
const ALARM_DAY_BYTES = 500 * 1024 * 1024;

const start = async (): Promise<MonitorResult> => {
  try {
    const usage = await usageStats.getUsage();
    const warning = usage.lastHourBytes > ONE_HOUR_BYTES;
    const alarm = usage.lastHourBytes > ALARM_HOUR_BYTES || usage.todayBytes > ALARM_DAY_BYTES;

    if (warning) {
      notificationService.notify("Mobile data usage exceeded 50 MB in the last hour");
    }
    if (alarm) {
      notificationService.notify("High mobile data usage detected");
    }
    return { usage, warning, alarm };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to monitor mobile data";
    throw new Error(message);
  }
};

export const localMonitor = { start };

export type UsagePeriod = "hourly" | "daily" | "weekly" | "anomaly";

export interface UsageSample {
  at: number;
  bytes: number;
  gapMs: number;
}

export interface UsageAlertSettings {
  enabled: boolean;
  hourlyCapBytes: number | null;
  dailyCapBytes: number | null;
  weeklyCapBytes: number | null;
  anomalyEnabled: boolean;
  anomalyMultiplier: number;
}

export interface UsageTotals {
  hourlyBytes: number;
  dailyBytes: number;
  weeklyBytes: number;
  previousDayBytes: number;
}

export interface UsageAlert {
  id: string;
  period: UsagePeriod;
  title: string;
  body: string;
  at: number;
}

const localHourStart = (timestamp: number): number => {
  const date = new Date(timestamp);
  date.setMinutes(0, 0, 0);
  return date.getTime();
};

const localDayStart = (timestamp: number): number => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const localWeekStart = (timestamp: number): number => {
  const date = new Date(localDayStart(timestamp));
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.getTime();
};

const sumBetween = (
  samples: ReadonlyArray<UsageSample>,
  start: number,
  end: number,
): number =>
  samples.reduce(
    (total, sample) => total + (sample.at >= start && sample.at < end ? sample.bytes : 0),
    0,
  );

const periodId = (period: UsagePeriod, start: number): string =>
  `${period}:${new Date(start).toISOString()}`;

export const formatUsageBytes = (bytes: number): string => {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
};

export const counterDelta = (previous: number, current: number): number => {
  if (
    !Number.isSafeInteger(previous)
    || !Number.isSafeInteger(current)
    || previous < 0
    || current < 0
  ) {
    throw new RangeError("Interface counters must be non-negative safe integers");
  }
  return current >= previous ? current - previous : 0;
};

export const calculateUsageTotals = (
  samples: ReadonlyArray<UsageSample>,
  now: number,
): UsageTotals => {
  const hourStart = localHourStart(now);
  const dayStart = localDayStart(now);
  const yesterday = new Date(dayStart);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = yesterday.getTime();

  return {
    hourlyBytes: sumBetween(samples, hourStart, now + 1),
    dailyBytes: sumBetween(samples, dayStart, now + 1),
    weeklyBytes: sumBetween(samples, localWeekStart(now), now + 1),
    previousDayBytes: sumBetween(samples, yesterdayStart, dayStart),
  };
};

export const evaluateUsageAlerts = (
  samples: ReadonlyArray<UsageSample>,
  settings: UsageAlertSettings,
  now: number,
  alreadySent: ReadonlySet<string>,
): ReadonlyArray<UsageAlert> => {
  if (!settings.enabled) return [];
  if (!Number.isFinite(settings.anomalyMultiplier) || settings.anomalyMultiplier < 1) {
    throw new RangeError("Anomaly multiplier must be at least 1");
  }

  const totals = calculateUsageTotals(samples, now);
  const periods: ReadonlyArray<{
    period: Exclude<UsagePeriod, "anomaly">;
    cap: number | null;
    bytes: number;
    start: number;
  }> = [
    { period: "hourly", cap: settings.hourlyCapBytes, bytes: totals.hourlyBytes, start: localHourStart(now) },
    { period: "daily", cap: settings.dailyCapBytes, bytes: totals.dailyBytes, start: localDayStart(now) },
    { period: "weekly", cap: settings.weeklyCapBytes, bytes: totals.weeklyBytes, start: localWeekStart(now) },
  ];

  const alerts: UsageAlert[] = [];
  for (const item of periods) {
    if (item.cap === null) continue;
    if (!Number.isSafeInteger(item.cap) || item.cap <= 0) {
      throw new RangeError(`${item.period} cap must be a positive safe integer`);
    }
    const id = periodId(item.period, item.start);
    if (item.bytes >= item.cap && !alreadySent.has(id)) {
      alerts.push({
        id,
        period: item.period,
        title: `${item.period[0].toUpperCase()}${item.period.slice(1)} usage cap reached`,
        body: `Uno interface traffic reached ${formatUsageBytes(item.bytes)} of ${formatUsageBytes(item.cap)}.`,
        at: now,
      });
    }
  }

  if (settings.anomalyEnabled && totals.previousDayBytes > 0) {
    const id = periodId("anomaly", localDayStart(now));
    if (
      totals.dailyBytes >= totals.previousDayBytes * settings.anomalyMultiplier
      && !alreadySent.has(id)
    ) {
      alerts.push({
        id,
        period: "anomaly",
        title: "Unusual daily usage increase",
        body: `Uno interface traffic is ${formatUsageBytes(totals.dailyBytes)} today, at least ${settings.anomalyMultiplier}x yesterday's ${formatUsageBytes(totals.previousDayBytes)}.`,
        at: now,
      });
    }
  }

  return alerts;
};

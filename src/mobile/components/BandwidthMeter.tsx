export interface BandwidthMeterModel {
  title: string;
  used: number;
  limit: number | null;
  ratio: number | null;
  message: string;
  hasLimit: boolean;
}

export const BandwidthMeter = (used: number, limit: number | null): BandwidthMeterModel => {
  const ratio = limit !== null && limit > 0 ? Math.min(used / limit, 1) : null;
  return {
    title: "Bandwidth",
    used,
    limit,
    ratio,
    message: limit === null ? "No limit data yet" : `${Math.round((ratio ?? 0) * 100)}% of limit`,
    hasLimit: limit !== null,
  };
};

export const bandwidthPercent = (meter: BandwidthMeterModel): number | null =>
  meter.hasLimit ? meter.ratio === null ? null : Math.round(meter.ratio * 100) : null;

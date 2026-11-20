export interface HourlyValue {
  hour: string;
  bytes: number;
}

export interface HourlyChartModel {
  title: string;
  empty: boolean;
  message: string | null;
  values: ReadonlyArray<HourlyValue>;
  maximum: number;
}

export const HourlyChart = (values: ReadonlyArray<HourlyValue>): HourlyChartModel => ({
  title: "Hourly usage",
  empty: values.length === 0,
  message: values.length === 0 ? "No data yet" : null,
  values: values.filter((value) => Number.isFinite(value.bytes) && value.hour.length > 0),
  maximum: values.reduce((maximum, value) => Math.max(maximum, value.bytes), 0),
});

export const hourlyLabel = (value: HourlyValue): string =>
  `${value.hour}:00 - ${value.bytes} bytes`;

import type { BandwidthInfo } from "./index";

export type UnoUsageEntry = {
  at: number;
  receivedBytes: number;
  sentBytes: number;
  intervalBytes: number | null;
  intervalSpeedBytesPerSecond: number | null;
};

const HISTORY_LIMIT = 20;
const DUPLICATE_WINDOW_MS = 10_000;

let history: ReadonlyArray<UnoUsageEntry> = [];

export const recordUnoUsage = (
  bandwidth: NonNullable<BandwidthInfo>,
  at = Date.now(),
): ReadonlyArray<UnoUsageEntry> => {
  const previous = history.at(-1);
  if (previous && (at <= previous.at || at - previous.at < DUPLICATE_WINDOW_MS)) {
    return history;
  }

  const elapsedSeconds = previous ? (at - previous.at) / 1000 : 0;
  const receivedDelta = previous && bandwidth.receivedBytes >= previous.receivedBytes
    ? bandwidth.receivedBytes - previous.receivedBytes
    : 0;
  const sentDelta = previous && bandwidth.sentBytes >= previous.sentBytes
    ? bandwidth.sentBytes - previous.sentBytes
    : 0;
  const intervalBytes = previous ? receivedDelta + sentDelta : null;
  const entry: UnoUsageEntry = {
    at,
    receivedBytes: bandwidth.receivedBytes,
    sentBytes: bandwidth.sentBytes,
    intervalBytes,
    intervalSpeedBytesPerSecond: intervalBytes === null || elapsedSeconds <= 0
      ? null
      : intervalBytes / elapsedSeconds,
  };
  history = [...history, entry].slice(-HISTORY_LIMIT);
  return history;
};

export const getUnoUsageHistory = (): ReadonlyArray<UnoUsageEntry> => history;

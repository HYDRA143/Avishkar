export interface WifiUsageCardModel {
  title: string;
  value: string;
  empty: boolean;
  message: string | null;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
};

export const WifiUsageCard = (bytes: number | null): WifiUsageCardModel => ({
  title: "Wi-Fi usage",
  value: bytes === null ? "No data yet" : formatBytes(bytes),
  empty: bytes === null,
  message: bytes === null ? "No data yet" : null,
});

export const isWifiUsageAvailable = (card: WifiUsageCardModel): boolean =>
  !card.empty && card.message === null;

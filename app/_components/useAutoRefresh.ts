import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { readRefreshInterval, saveRefreshInterval, type RefreshInterval } from "./preferences";

export const useAutoRefresh = (): {
  intervalSeconds: number;
  refreshKey: number;
  setRefreshInterval: (seconds: RefreshInterval) => Promise<void>;
} => {
  const [intervalSeconds, setIntervalSeconds] = useState(30);
  const [refreshKey, setRefreshKey] = useState(0);
  const setRefreshInterval = useCallback(async (seconds: RefreshInterval): Promise<void> => {
    await saveRefreshInterval(seconds);
    setIntervalSeconds(seconds);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    void readRefreshInterval().then((seconds) => {
      if (active) setIntervalSeconds(seconds);
    }).catch((error: unknown) => {
      console.error("Unable to read auto-refresh interval", error);
    });
    return () => { active = false; };
  }, []));

  useEffect(() => {
    const timer = setInterval(() => setRefreshKey((key) => key + 1), intervalSeconds * 1000);
    return () => clearInterval(timer);
  }, [intervalSeconds]);

  return { intervalSeconds, refreshKey, setRefreshInterval };
};

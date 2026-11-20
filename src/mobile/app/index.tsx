import { BandwidthMeter } from "../components/BandwidthMeter";
import { DeviceList } from "../components/DeviceList";
import { SelfHealingBadge } from "../components/SelfHealingBadge";
import { WifiUsageCard } from "../components/WifiUsageCard";
import { useDeviceUsage } from "../hooks/useDeviceUsage";
import { useSelfHealing } from "../hooks/useSelfHealing";

export interface HomeScreen {
  title: string;
  loading: boolean;
  error: string | null;
  devices: ReturnType<typeof DeviceList>;
  wifi: ReturnType<typeof WifiUsageCard>;
  bandwidth: ReturnType<typeof BandwidthMeter>;
  selfHealing: ReturnType<typeof SelfHealingBadge>;
}

export default async function Home(): Promise<HomeScreen> {
  const [usageState, healingState] = await Promise.all([useDeviceUsage(), useSelfHealing()]);
  const totalBytes = usageState.usage.reduce((sum, point) => sum + point.bytes, 0);
  const latestLimit = null;
  return {
    title: "NetGuard",
    loading: usageState.loading || healingState.loading,
    error: usageState.error ?? healingState.error,
    devices: DeviceList(usageState.devices),
    wifi: WifiUsageCard(usageState.usage.length > 0 ? totalBytes : null),
    bandwidth: BandwidthMeter(totalBytes, latestLimit),
    selfHealing: SelfHealingBadge(healingState.active, healingState.message),
  };
}

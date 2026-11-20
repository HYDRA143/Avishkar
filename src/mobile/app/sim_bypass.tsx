import { vpnService } from "../../features/sim-monitor/vpnService";

export interface SimBypassScreen {
  title: string;
  action: () => Promise<void>;
}

export default function SimBypass(): SimBypassScreen {
  return {
    title: "Turn off mobile data in Android settings",
    action: vpnService.openMobileDataSettings,
  };
}

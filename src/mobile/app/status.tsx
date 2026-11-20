import { SelfHealingBadge } from "../components/SelfHealingBadge";
import { useSelfHealing } from "../hooks/useSelfHealing";

export interface StatusScreen {
  title: string;
  loading: boolean;
  error: string | null;
  selfHealing: ReturnType<typeof SelfHealingBadge>;
  lastActionAt: string | null;
}

export default async function Status(): Promise<StatusScreen> {
  const state = await useSelfHealing();
  return {
    title: "System status",
    loading: state.loading,
    error: state.error,
    selfHealing: SelfHealingBadge(state.active, state.message),
    lastActionAt: state.lastActionAt,
  };
}

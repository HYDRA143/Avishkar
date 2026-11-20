export interface SelfHealingBadgeModel {
  label: string;
  tone: "active" | "inactive" | "unknown";
  detail: string;
  accessibleLabel: string;
}

export const SelfHealingBadge = (
  active: boolean | null,
  message?: string | null,
): SelfHealingBadgeModel => ({
  label: active === true ? "Self-healing active" : active === false ? "Self-healing inactive" : "Self-healing status unavailable",
  tone: active === true ? "active" : active === false ? "inactive" : "unknown",
  detail: message ?? "No status detail available",
  accessibleLabel: `${active === true ? "Active" : active === false ? "Inactive" : "Unavailable"} self-healing status`,
});

export const isSelfHealingOperational = (badge: SelfHealingBadgeModel): boolean =>
  badge.tone === "active";

export const selfHealingTone = (badge: SelfHealingBadgeModel): string => badge.tone;

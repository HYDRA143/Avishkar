# COPILOT - Stage 3 SIM Monitoring - Real Data Only, No Mock
# Tech: TypeScript Strict, pnpm only, Vercel only, No Java, No KVM, No STM32
# Scope: src/features/sim-monitor/*, SimUsageCard, sim_bypass, useSimUsage, api/sim-bypass.ts ONLY
# Rules: No mock/dummy/fake/hardcoded MB, Real Android UsageStatsManager + NetworkStatsManager + SubscriptionManager only
# If no real data: show "No real SIM data - Run on real Android device with permission", do NOT fallback to mock
# No auto-block SIM, only warning + alarm + manual off
# pnpm run typecheck must pass

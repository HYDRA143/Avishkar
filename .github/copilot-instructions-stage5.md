# COPILOT - Stage 5 Mobile App Full - Real Data Only, No Mock
# Project: NetGuard / Avishkar

## GOAL
Build Stage 5 Mobile App Full. All 1-line placeholder files ko real code se replace karo.

## SCOPE - ONLY THESE FILES
- src/mobile/app/_layout.tsx, index.tsx, graph.tsx, reports.tsx, status.tsx, settings.tsx
- src/mobile/components/DeviceList.tsx, UsageGraph.tsx, WifiUsageCard.tsx, HourlyChart.tsx, SelfHealingBadge.tsx, BandwidthMeter.tsx, PermissionScreen.tsx
- src/mobile/hooks/useDeviceUsage.ts, useReports.ts, useSelfHealing.ts
- src/mobile/services/notificationService.ts, permissionService.ts

## DO NOT TOUCH
- src/mobile/app/sim_bypass.tsx, src/mobile/components/SimUsageCard.tsx, src/mobile/hooks/useSimUsage.ts - Ye already done hai, mat chhedo
- api/*, src/cloud/*, src/features/* - Mat chhedo

## RULES - STRICT
- No mock, no dummy, no fake, no placeholder, no hardcoded devices
- Real backend API se data lo: /api/devices, /api/usage, /api/report, /api/status
- Agar data nahi hai to "No data yet" dikhao, fake graph mat banao
- Every hook must call real fetch with AbortController + try/catch
- Every component must show real props, no placeholder true
- TypeScript Strict, pnpm only

## VERIFICATION
- pnpm run typecheck must pass
- grep placeholder must return 0
- wc -l must be > 20 lines per file, 1 line file forbidden

# NetGuard / Avishkar Knowledgebase

This document consolidates the repository's available Copilot and project instructions. NetGuard is a defensive system for monitoring the user's own network, devices, and code.

## Global project rules

- Backend runs only on Vercel.
- Use Vercel rewrites and the Vercel load balancer where routing is required.
- Use strict TypeScript.
- Use `pnpm` only; do not use `npm`.
- Organize code by feature. Keep a feature's code in its own folder and do not modify another feature's files unnecessarily.
- Do not use Java or a JDK, KVM, STM32, AWS, GCP, Render, Koyeb, or Nginx.
- Keep the Uno Q 4 GB target at 49% RAM; avoid heavy code.
- Push the project in one GitHub push, not folder-by-folder pushes.
- `docs/` was previously out of scope; this document is the requested exception.
- Do not write hacking or attack code. Monitor only the user's own network, devices, and code.
- Do not create mock, dummy, fake, placeholder, or hardcoded operational data.
- SIM functionality must never auto-block. It may issue a warning and alarm, with manual disabling only.

## Secrets and vault safety

- Never place vault keys on GitHub.
- Store only placeholder `.txt` files and a README where vault documentation is needed.
- Never print, push, copy, or hardcode a real key, hash, private key, API key, or token.
- Read or edit files in `vault/` or `src/features/vault/` only after obtaining permission.
- Load private keys and other secrets from environment variables.

## Stage 1: WiFi monitoring

### Scope

Stage 1 is limited to:

- `src/features/wifi-monitor/*`
- `uno_guard`
- `device_tracker`
- `bandwidth_logger`
- `threshold`
- `auto_restart`

Do not touch `sim-monitor`, `vault`, `reports`, `gateway`, or mobile files for this stage.

### Requirements

- Use real data only; never use mock, dummy, fake, or hardcoded devices.
- Use direct checks with `device_tracker` and `bandwidth_logger` only.
- Use real ARP, ping sweep, and `/proc/net/arp` data.
- If no real device is available, return an empty list and the message `No real device - Run on Uno Q / real WiFi`; do not fall back to mock data.
- Arduino must not create a new WiFi network. It monitors whichever hotspot or WiFi network is in use.
- Target Python verification with:

  ```sh
  python3 -m py_compile
  ```

## Stage 2: reports and signing

### Goal and flow

Every report must be signed and verifiable; fake or tampered reports must be rejected.

```text
WiFi Monitor + SIM Data
        -> Report
        -> deterministic_hash
        -> Key Vault sign
        -> Backend
        -> signature_verify
        -> reject if verification fails
```

### Allowed files

- `src/features/vault/builder.c`
- `src/features/vault/hash_gen.c`
- `src/features/vault/deterministic_hash.py`
- `src/features/vault/signature_verify.py`
- `src/features/vault/audit_report.py`
- `src/features/reports/sync_reports.py`
- `src/features/reports/syncService.ts`
- `src/features/reports/storage.ts`
- `src/features/reports/SignedReport.tsx`

Do not touch `api/*`, `wifi-monitor`, `sim-monitor`, `cloud`, `mobile`, `security-gateway`, or `vault/keys` for this stage.

### Requirements

- `deterministic_hash` uses SHA-256 and JSON `sort_keys=True`; identical input must produce the identical hash.
- Hardcoded hashes are forbidden.
- `hash_gen.c` and `builder.c` must contain real C logic; hardcoded `printf` output is forbidden.
- `signature_verify` must verify with the public key.
- On verification failure, return `verified=False` and `Tampered`; never force `True`.
- `audit_report` records a real timestamp, hash, and verification status; fake entries are forbidden.
- Report synchronization must be real. If there is no internet connection, queue the report; never claim it synced when it did not.
- `SignedReport.tsx` displays:
  - a green tick for verified reports;
  - red `Tampered` for failed verification;
  - `No report yet` when there is no report.
- Every function must use `try/catch` and return a real error.

### Verification

```sh
pnpm run typecheck
python3 -m py_compile src/features/vault/*.py src/features/reports/*.py
grep mock/dummy/fake
```

The typecheck and Python compilation must pass, and the mock/dummy/fake check must return no matches.

## Stage 3: SIM monitoring

### Scope

- `src/features/sim-monitor/*`
- `SimUsageCard`
- `sim_bypass`
- `useSimUsage`
- `api/sim-bypass.ts`

### Requirements

- Use strict TypeScript and `pnpm`.
- Use real Android `UsageStatsManager`, `NetworkStatsManager`, and `SubscriptionManager` data only.
- Do not use mock, dummy, fake, or hardcoded megabytes.
- If real data is unavailable, show `No real SIM data - Run on real Android device with permission`; never fall back to mock data.
- SIM must not be auto-blocked. Use warning, alarm, and manual off only.

### Verification

```sh
pnpm run typecheck
```

## Stage 4: Vercel app backend

### Goal and flow

The React Native app uses the Vercel backend and does not communicate directly with the Uno Q.

```text
App
 -> Gateway
 -> App Backend
 -> Key Vault Verify
 -> WiFi Monitor Data
 -> JSON response to App
```

### Allowed files

- `api/check.ts`
- `api/status.ts`
- `api/devices.ts`
- `api/usage.ts`
- `api/report.ts`
- `src/cloud/nvidia_api.py`
- `src/cloud/rate_limiter.py`
- `src/cloud/mtls_client.py`
- `src/cloud/deploy_vercel.py`
- `src/cloud/telegram_alert.py`
- `vercel.json`

Do not touch `api/sim-bypass.ts`, `wifi-monitor`, `sim-monitor`, `vault`, `mobile`, or `security-gateway` for this stage.

### Requirements

- Use strict TypeScript and Vercel only.
- Configure Vercel rewrites/load balancing as required.
- APIs must use real data only; never use mock, dummy, fake, or hardcoded devices, megabytes, or `verified: true`.
- When real data is unavailable, return an empty array or an error; never manufacture data.
- Read API keys, tokens, and private keys from `process.env`; never hardcode them.
- Every API must have `try/catch` and proper HTTP statuses: `200`, `400`, `401`, `429`, and `500` as applicable.

### Verification

```sh
pnpm run typecheck
grep mock/dummy/fake
```

Typecheck must pass with zero errors and the forbidden-data check must return no results.

## Stage 5: mobile app

### Allowed files

- `src/mobile/app/_layout.tsx`
- `src/mobile/app/index.tsx`
- `src/mobile/app/graph.tsx`
- `src/mobile/app/reports.tsx`
- `src/mobile/app/status.tsx`
- `src/mobile/app/settings.tsx`
- `src/mobile/components/DeviceList.tsx`
- `src/mobile/components/UsageGraph.tsx`
- `src/mobile/components/WifiUsageCard.tsx`
- `src/mobile/components/HourlyChart.tsx`
- `src/mobile/components/SelfHealingBadge.tsx`
- `src/mobile/components/BandwidthMeter.tsx`
- `src/mobile/components/PermissionScreen.tsx`
- `src/mobile/hooks/useDeviceUsage.ts`
- `src/mobile/hooks/useReports.ts`
- `src/mobile/hooks/useSelfHealing.ts`
- `src/mobile/services/notificationService.ts`
- `src/mobile/services/permissionService.ts`

Do not touch `src/mobile/app/sim_bypass.tsx`, `src/mobile/components/SimUsageCard.tsx`, or `src/mobile/hooks/useSimUsage.ts`; those are already complete. Do not touch `api/*`, `src/cloud/*`, or `src/features/*` for this stage.

### Requirements

- Replace one-line placeholders with real code.
- Use real backend endpoints: `/api/devices`, `/api/usage`, `/api/report`, and `/api/status`.
- If data is unavailable, show `No data yet`; never draw a fake graph.
- Every hook must call the real API with `fetch`, `AbortController`, and `try/catch`.
- Components must render real props and must not use placeholder `true` values.
- Do not use mock, dummy, fake, placeholder, or hardcoded devices.
- Use strict TypeScript and `pnpm`.

### Verification

```sh
pnpm run typecheck
grep placeholder
wc -l <file>
```

Typecheck must pass, the placeholder check must return no results, and each target file must contain more than 20 lines; one-line files are forbidden.

## Stage 6: security gateway

### Scope

Stage 6 is limited to `src/features/security-gateway/*`.

### Requirements

- Implement real firewall, WAF, rate limiter, and mTLS behavior.
- Do not use mock, dummy, fake, or placeholder behavior.
- Do not modify files outside the stage scope unless a directly required call site must be kept consistent.

## Engineering and validation checklist

Before completing a change:

1. Keep the change within the applicable stage and feature scope.
2. Confirm no secrets or real keys were printed, copied, committed, or hardcoded.
3. Confirm real data paths are used and unavailable data produces an explicit empty state or error.
4. Preserve strict TypeScript and run the smallest applicable `pnpm` validation.
5. Run the relevant Python compilation checks for Python changes.
6. Confirm user-facing states distinguish unavailable data, queued data, verified data, and tampered data.
7. Avoid heavy implementations that exceed the Uno Q memory target.

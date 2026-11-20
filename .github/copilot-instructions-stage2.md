# COPILOT - Stage 2 Reports + Signing - Real Data Only, No Mock
# Project: NetGuard / Avishkar
# Workspace: GitHub Workspaces - Avishkar

## GOAL
Build Stage 2 - Reports + Signing - Har report ko sign karke verify karna, fake report reject karna.

## TECH STACK - DO NOT CHANGE
- Language: Python + C + TypeScript Strict
- Platform: Vercel Backend + Uno Q Key Vault
- Package Manager: pnpm only
- No Java, No KVM, No STM32, No AWS / GCP, No Nginx
- No mock, No dummy, No fake, No hardcoded data

## SCOPE - ONLY STAGE 2
Files to build ONLY:
- src/features/vault/builder.c
- src/features/vault/hash_gen.c
- src/features/vault/deterministic_hash.py
- src/features/vault/signature_verify.py
- src/features/vault/audit_report.py
- src/features/reports/sync_reports.py
- src/features/reports/syncService.ts
- src/features/reports/storage.ts
- src/features/reports/SignedReport.tsx

Do NOT touch api/*, wifi-monitor, sim-monitor, cloud, mobile, security-gateway, vault/keys

## REAL FLOW - NO MOCK
WiFi Monitor + SIM Data -> Report -> deterministic_hash -> Key Vault sign -> Backend -> signature_verify -> Agar fail to reject

## RULES
- deterministic_hash: SHA256, json sort_keys True, same input same hash, hardcoded hash forbidden
- hash_gen.c + builder.c: Real C logic, hardcoded printf forbidden
- signature_verify: public key se verify, private key kabhi file me mat likhna, fail pe verified False + Tampered, fake True forbidden
- audit_report: Real log timestamp + hash + verified status, fake entry forbidden
- sync_reports + syncService + storage: Real sync, internet nahi hai to queue, fake synced forbidden
- SignedReport.tsx: Verified True to green tick, False to red Tampered, no data to No report yet, fake tick forbidden
- Private key kabhi hardcode mat karna, env se lo
- Every function try/catch + real error return

## VERIFICATION
- pnpm run typecheck must pass
- python3 -m py_compile src/features/vault/*.py src/features/reports/*.py must pass
- grep mock/dummy/fake must return 0

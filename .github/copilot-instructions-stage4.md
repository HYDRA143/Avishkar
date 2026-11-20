# COPILOT - Stage 4 App Backend - Real Backend, No Mock
# Project: NetGuard / Avishkar - Defensive AI System
# Workspace: GitHub Workspaces - Avishkar

## GOAL
Build FULL App Backend on Vercel - Ye React Native App ka apna backend hai.
App seedha Uno Q se baat nahi karega, hamesha isi backend se karega.

## TECH STACK - DO NOT CHANGE
- Language: TypeScript Strict
- Platform: Vercel only, Vercel rewrites / load balancer use karna hai
- Package Manager: pnpm only
- No Java, No KVM, No STM32, No AWS / GCP, No Render / Koyeb, No Nginx
- No mock, No dummy, No fake, No hardcoded data

## SCOPE - ONLY STAGE 4
Files to build ONLY:
- api/check.ts, api/status.ts, api/devices.ts, api/usage.ts, api/report.ts
- src/cloud/nvidia_api.py, rate_limiter.py, mtls_client.py, deploy_vercel.py, telegram_alert.py
- vercel.json

Do NOT touch api/sim-bypass.ts, wifi-monitor, sim-monitor, vault, mobile, security-gateway

## BACKEND FLOW
App -> Gateway -> App Backend -> Key Vault Verify -> WiFi Monitor Data -> App ko JSON

## REAL DATA RULES - STRICT - NO MOCK
- Mock / dummy / fake / hardcoded devices / hardcoded MB / hardcoded verified true FORBIDDEN
- Agar real data nahi hai to empty array / error return karo, fake data mat banao
- API key, token, private key kabhi hardcode mat karna, process.env se lo
- Every API must have try/catch + proper HTTP status 200, 400, 401, 429, 500

## VERIFICATION
- pnpm run typecheck must pass 0 errors
- grep mock/dummy/fake must return 0 results

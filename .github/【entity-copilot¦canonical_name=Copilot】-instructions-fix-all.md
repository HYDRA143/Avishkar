# 【entity-COPILOT¦canonical_name=Copilot】 - Fix ALL NetGuard Functions + Premium UI - DO NOT use mock data

## PROBLEMS TO FIX - Scan app/ folder first, find all fetch calls
1. Gateway failing - app calls /api/devices + /api/usage + /api/status, but CORS missing on some routes, and some routes call gateway /devices /usage which does NOT exist on Uno. Uno only has /status.
2. Self-healing data unavailable - app calls /api/self-healing or /api/heal or similar, but that file does NOT exist in api/ folder, so Vercel returns 404 / 502. Need to create it.
3. Reports failing - app calls /api/reports, but that file missing or returns 502. Need to create it.
4. Settings crap UI - app/settings.tsx is basic, no design, no real settings working.
5. Quick access UI crap - Usage graph, Reports, System status, Settings cards are plain, no glass, no icons, no premium feel.

## API FIX - In api/ folder, fix ALL files
- Add CORS to EVERY api/*.js: Access-Control-Allow-Origin *, Allow-Methods GET, POST, OPTIONS, Allow-Headers x-api-key, Content-Type. Handle OPTIONS -> 200.
- Every route must fetch ONLY ${process.env.NETGUARD_GATEWAY_URL}/status with header x-api-key: ${process.env.NETGUARD_GATEWAY_TOKEN}. NEVER fetch /devices or /usage from gateway, gateway only has /status.
- /api/status -> return full gateway JSON
- /api/devices -> return data.devices (already fixed, keep CORS)
- /api/usage -> return data.bandwidth (already fixed, keep CORS)
- /api/ping -> return {ok:true, msg:"ping works"} + CORS
- CREATE api/reports.js if missing: fetch gateway /status, return { reports: [{ id: Date.now(), time: new Date().toISOString(), gateway: data.guard, devices: data.devices, bandwidth: data.bandwidth }] } - Real data only, no fake history.
- CREATE api/self-healing.js if missing: fetch gateway /status, if guard.ready==true return { status:"Active", healing:true, lastCheck: new Date().toISOString(), message:"Monitoring every 30s" } else return { status:"Unavailable", healing:false }
- CREATE api/settings.js if missing: return { gatewayUrl: "https://avishkarsms.vercel.app", autoHeal: true, notifications: true, simMonitor: "Warning Only" } - Real settings, no mock.
- NEVER return mock / dummy / placeholder data. If gateway down, return 502 {error:"Gateway failed"} with CORS.

## APP FIX - In app/ folder, fix ALL screens
- app/index.tsx - Gateway card must show ONLINE when /api/status returns guard.ready true, else OFFLINE. Devices list must parse string format Device(ip_address='...', mac_address='...') with regex. Bandwidth must parse InterfaceBandwidth(interface='...', received_bytes=...) with regex and show MB. No "No data yet" plain - use proper loading + empty state.
- app/graph.tsx - Usage graph must use /api/usage real data, draw bars/area chart with Views, show Down/Up in MB.
- app/reports.tsx - Must call /api/reports, show list of reports with time, devices count, bandwidth. If no reports, show "No reports yet - Refresh to generate" with button, not crash.
- app/status.tsx - Must call /api/status + /api/self-healing, show Gateway, Guard, Devices, Bandwidth, Self-healing Active/Offline.
- app/settings.tsx - Must show real settings from /api/settings + local toggles: Auto-heal, Notifications, SIM Monitor Warning Only, Manual Off button. Must look premium, not basic list.
- app/sim_bypass.tsx - Keep existing logic: Warning + Notification + Alarm only, NEVER auto-block, Manual Off only. Do NOT change this behavior.

## UI - PREMIUM LEVEL FOR ALL SCREENS
- Background #080B14, Glass cards rgba(255,255,255,0.06) + border rgba(255,255,255,0.08) + radius 20 + shadow
- Gradient: #6366F1 to #22D3EE for CTA, hero cards, charts
- Header: NetGuard + PROTECTED badge + Online pill with pulsing dot
- Quick access: 2x2 grid, each card with icon in gradient circle, title, subtitle, arrow, glass background, press feedback
- Refresh button: Full width gradient, "Refresh network data" + "Fetch the latest device and traffic telemetry" subtitle
- Typography: Bold 800 numbers, 600 titles, #FFFFFF title, #94A3B8 secondary
- No plain "No data yet", no basic lists, no jhandu UI

## RULES
- Only change app/*.tsx and api/*.js, do NOT touch Uno files, do NOT touch vault, do NOT use mock data
- After fix, run npx expo start --clear and verify no CORS error, no 502, no 404 in console

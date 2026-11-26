# 【entity-COPILOT¦canonical_name=Copilot】 - NetGuard Premium UI Rebuild - DO NOT change API logic, ONLY UI

## GOAL
Rebuild app/index.tsx to PREMIUM level like Linear / Vercel / Ubiquiti UniFi / Cloudflare Zero Trust dashboard. NOT basic cards. Must look like a paid SaaS product.

## DESIGN SYSTEM
- Background: #080B14 deep dark, not #0f172a flat
- Cards: Glassmorphism - background rgba(255,255,255,0.06), border 1px rgba(255,255,255,0.08), blur, radius 20, shadow
- Primary: #6366F1 indigo + #22D3EE cyan gradient for CTA / charts
- Success: #10B981, Danger: #EF4444, Warning: #F59E0B
- Text: White #FFFFFF for title, #94A3B8 for secondary, #64748B for muted
- Font: System bold 800 for numbers, 600 for titles, use letterSpacing
- Spacing: 16px page padding, 14px card gap, 12px inner padding

## LAYOUT - Single Scroll Dashboard
1. TOP HEADER: Left - NetGuard logo with gradient shield icon + "NetGuard" + "PROTECTED" small badge. Right - Online pill with pulsing green dot + Refresh icon button. Below - "Laptop Hotspot • 192.168.137.1 • Last sync 30s ago"
2. HERO CARD - Gateway Status: Large gradient card (indigo to cyan). Left - Big number "1 Device" + "Gateway Online". Right - Animated pulse ring. Bottom - 3 mini stats: Down, Up, Latency
3. DEVICES SECTION: Title "Devices" + "1 found" + "View all". Each device row: 44px avatar circle with gradient, device icon (phone/laptop), IP in bold, MAC + interface below, Right - "Live" green pill + signal bars (4 bars). If 0 devices, show empty state with illustration text, not "No data yet" plain.
4. BANDWIDTH CHART CARD: Title "Wi-Fi Usage" + Live badge. Big total "50.9 MB" + Down/Up split. Draw a real area chart using Views (not library) - bars for last 7 points from bandwidth data, gradient fill, rounded bars. Below - List of interfaces (wlan0, docker0, etc) with progress bars.
5. SECURITY CARD: "Self-healing" with shield icon, status Active, "Monitoring every 30s", plus 2 rows: SIM Monitor - Warning Only, Firewall - Active
6. QUICK ACTIONS GRID: 4 buttons in 2x2 grid - Usage graph, Reports, System status, Settings - Each with icon, title, subtitle, arrow, glass background, onPress navigate.
7. BOTTOM: Refresh button - Full width gradient button, haptic feel.

## LOGIC - DO NOT BREAK
- Keep same fetch: GET ${EXPO_PUBLIC_API_BASE_URL}/api/devices and /api/usage with header x-api-key: EXPO_PUBLIC_NETGUARD_API_KEY
- Keep parse functions for Device(ip_address='...') and InterfaceBandwidth(...) string format - parse with regex, do NOT assume JSON objects
- Handle loading with shimmer / ActivityIndicator, error with Offline state, not crash
- Keep all existing navigation links working

## RULES
- Use only React Native + Expo Router + StyleSheet, no new dependency unless needed
- No mock / dummy / fake data - only real API data
- No placeholder text like "No data yet" in plain - use proper empty state
- Must work on Web (github.dev) and Mobile both, responsive
- File to change: ONLY app/index.tsx, do NOT touch api/ folder, do NOT touch Uno files

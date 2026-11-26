# COPILOT - Fix All UI Issues - App only, Do NOT touch api/, Do NOT touch Uno
# Files: app/index.tsx, app/graph.tsx, app/status.tsx (or health screen), app/reports.tsx

## 1. FIX USAGE PARSER - Sabse bada bug
# Vercel /api/usage returns: { bandwidth: { wlan0: { received_bytes: "51530574", transmitted_bytes: "1680000" } } }
# Kabhi kabhi returns: { interfaces: [{name:"wlan0", received_bytes, transmitted_bytes}] }
# App must handle BOTH formats:
# - Try data.bandwidth.wlan0, then data.interfaces[0], then data.wlan0
# - Parse with parseFloat(String(value)) || 0, NOT Number(value) directly, kyunki string aa sakta hai
# - If wlan0 found: totalDown = received_bytes, totalUp = transmitted_bytes, interfacesCount = 1, show "1 INTERFACE", "Total 51.5 MB"
# - If not found: Show "No data" - but do NOT show 0.0 KB as success

## 2. FIX DEVICE NAME - 1 aur 9 wala placement issue
# Abhi avatar me last octet (9, 1) dikh raha hai, wo hatana hai.
# Add function getDeviceName(ip, mac):
# - if ip == "192.168.137.1" => name="Gateway • Laptop Hotspot", avatarLetter="G"
# - if ip == "192.168.137.29" => name="Phone", avatarLetter="P"
# - if ip == "192.168.137.65" => name="Uno Q • NetGuard", avatarLetter="U"
# - else => name="Device • ."+lastOctet, avatarLetter="D"
# Show in list: [Avatar Letter centered] + Name (bold) + IP + MAC below. Avatar me number mat dikhao.
# Avatar style: 48x48 circle, letter centered vertically + horizontally, no extra badge.

## 3. FIX STATUS SCREEN MISMATCH
# Status screen must use SAME fetch as Main screen: fetch /api/devices + /api/usage together in one useEffect, same parser from #1.
# Show: Devices = Available (2) if devices.length>0 else Unavailable, Bandwidth = Available if wlan0 found else Unavailable. Do NOT fetch separate /api/status.

## 4. FIX REAL-TIME SPEED + 30s REPORT (Stage 4)
# Keep prevBandwidth {rx, tx, time} in state, fetch every 30s.
# speedDown = (currentRx - prevRx)/seconds, speedUp = (currentTx - prevTx)/seconds
# Show in Main: "Total: 51.5 MB Down" + "Live: 120 KB/s Down • 30 KB/s Up" + if speed==0 show "Idle" not "0.0 KB"
# Graph: Show speed bars for last 7 intervals, not total.

## RULES: No mock, real data only. Only root app/ screens.

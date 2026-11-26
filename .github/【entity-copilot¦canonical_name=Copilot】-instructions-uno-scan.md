# 【entity-COPILOT¦canonical_name=Copilot】 - Fix Uno Device Discovery to Active ARP Scan - Docker rebuild needed
# File to fix: find device_tracker / run_wifi_monitor.py in repo, do NOT touch vault, do NOT touch Vercel api/, do NOT touch app/
# CURRENT: Only reads arp -a passive table, returns only gateway 192.168.137.1
# FIX:
# 1. Get Uno's own IP via socket / hostname -I, add it as device with interface wlan0, reachable True
# 2. Active scan: For 192.168.137.1 to 192.168.137.254, send ARP ping / ping -c 1 -W 1, or use arp-scan, collect replies
# 3. For each reply, get IP + MAC via arp table, add to devices list, deduplicate
# 4. Also add gateway 192.168.137.1 if not already found
# 5. Return DiscoveryResult(devices=(...), message=None) with all found devices, not just gateway
# RULES: No mock, no fake, only real scan. Must work on Uno Q Imola, Linux, Python 3.13. Keep existing guard + bandwidth + http on 8080 /status working.

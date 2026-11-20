# COPILOT - Stage 1 WiFi Monitoring - Real Data Only, No Mock
# Tech: Python, Docker, Uno Q 4GB, 49% RAM target
# Scope ONLY: src/features/wifi-monitor/* - uno_guard, device_tracker, bandwidth_logger, threshold, auto_restart
# Rules: No mock/dummy/fake/hardcoded devices, Real ARP + ping sweep + /proc/net/arp only
# If no real device: return empty list + message "No real device - Run on Uno Q / real WiFi", do NOT fallback to mock
# Arduino naya WiFi nahi banayega, kisi bhi hotspot / WiFi se monitor karega
# Do NOT touch sim-monitor, vault, reports, gateway, mobile files
# python3 -m py_compile must pass

"""Loop runner for wifi-monitor - keeps container alive, one-shot files ko loop me chalata hai."""
import sys, time, json, os
sys.path.insert(0, "/app")
sys.path.insert(0, "/app/wifi-monitor")
sys.path.insert(0, "/app/shared")
try:
    from wifi_monitor import uno_guard as _g
except Exception:
    import uno_guard as _g
try:
    from wifi_monitor import device_tracker as _d
except Exception:
    import device_tracker as _d
try:
    from wifi_monitor import bandwidth_logger as _b
except Exception:
    import bandwidth_logger as _b

interval = int(os.environ.get("WIFI_SCAN_INTERVAL_SECONDS", "30"))
print("[wifi-monitor] start interval=%s" % interval, flush=True)
while True:
    try:
        guard = _g.check()
        print("[wifi-monitor] guard ready=%s msg=%s" % (guard.ready, guard.message or "Uno Q WiFi monitor ready"), flush=True)
        try:
            devices = _d.discover_devices()
            print("[wifi-monitor] devices=%s" % json.dumps(devices, default=str), flush=True)
        except Exception as e:
            print("[wifi-monitor] devices error: %s" % e, flush=True)
        try:
            bw = _b.read_bandwidth()
            print("[wifi-monitor] bandwidth=%s" % json.dumps(bw, default=str), flush=True)
        except Exception as e:
            print("[wifi-monitor] bandwidth error: %s" % e, flush=True)
    except Exception as e:
        print("[wifi-monitor] loop error: %s" % e, flush=True)
    time.sleep(interval)

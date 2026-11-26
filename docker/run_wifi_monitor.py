"""Loop runner for wifi-monitor + HTTP server for Cloudflare Tunnel."""
import sys, time, json, os, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
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

last_result = {"guard": None, "devices": None, "bandwidth": None, "updated": None}
interval = int(os.environ.get("WIFI_SCAN_INTERVAL_SECONDS", "30"))

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ("/", "/status", "/health"):
            body = json.dumps(last_result, default=str).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()
    def log_message(self, *a):
        pass

def serve():
    srv = ThreadingHTTPServer(("0.0.0.0", 8080), Handler)
    print("[wifi-monitor] http on 0.0.0.0:8080 /status", flush=True)
    srv.serve_forever()

threading.Thread(target=serve, daemon=True).start()
print("[wifi-monitor] start interval=%s" % interval, flush=True)
while True:
    try:
        guard = _g.check()
        last_result["guard"] = {"ready": guard.ready, "message": guard.message}
        try:
            last_result["devices"] = _d.discover_devices().__dict__
        except Exception as e:
            last_result["devices"] = {"error": str(e)}
        try:
            last_result["bandwidth"] = _b.read_bandwidth().__dict__
        except Exception as e:
            last_result["bandwidth"] = {"error": str(e)}
        last_result["updated"] = time.time()
        print("[wifi-monitor] guard=%s devices=%s" % (guard.ready, last_result["devices"]), flush=True)
    except Exception as e:
        print("[wifi-monitor] loop error: %s" % e, flush=True)
    time.sleep(interval)

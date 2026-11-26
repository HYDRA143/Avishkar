"""Loop runner for key-vault - sync_reports library hai, isliye loop me status deta hai, band nahi hota."""
import os, time
from pathlib import Path
interval = int(os.environ.get("VAULT_SYNC_INTERVAL_SECONDS", "60"))
vault = Path("/app/vault")
print("[key-vault] start interval=%s vault=%s" % (interval, vault), flush=True)
while True:
    try:
        keys = list((vault / "keys").glob("*")) if (vault / "keys").exists() else []
        hashes = list((vault / "hashes").glob("*")) if (vault / "hashes").exists() else []
        print("[key-vault] alive keys=%d hashes=%d" % (len(keys), len(hashes)), flush=True)
    except Exception as e:
        print("[key-vault] loop error: %s" % e, flush=True)
    time.sleep(interval)

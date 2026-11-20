"""Synchronize signed reports or queue them when the backend is unavailable."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from deterministic_hash import deterministic_hash
from signature_verify import verify_signature


@dataclass(frozen=True)
class SyncResult:
    synced: bool
    queued: bool
    report_hash: str
    error: str | None = None


def _queue(report: Any, queue_path: Path) -> None:
    queue_path.parent.mkdir(parents=True, exist_ok=True)
    with queue_path.open("a", encoding="utf-8") as queue_file:
        queue_file.write(json.dumps(report, sort_keys=True, separators=(",", ":")) + "\n")
        queue_file.flush()
        os.fsync(queue_file.fileno())


def sync_report(report: dict[str, Any]) -> SyncResult:
    try:
        signature = report.get("signature")
        payload = {key: value for key, value in report.items() if key != "signature"}
        report_hash = deterministic_hash(payload)
        verification = verify_signature(payload, signature if isinstance(signature, str) else "")
        if not verification.verified:
            return SyncResult(False, False, report_hash, verification.error or "Report is Tampered")

        queue_value = os.environ.get("NETGUARD_REPORT_QUEUE_PATH", "")
        if not queue_value:
            raise RuntimeError("NETGUARD_REPORT_QUEUE_PATH is required")
        queue_path = Path(queue_value)
        endpoint = os.environ.get("NETGUARD_REPORT_SYNC_URL", "")
        token = os.environ.get("NETGUARD_REPORT_SYNC_TOKEN", "")
        if not endpoint or not token:
            _queue(report, queue_path)
            return SyncResult(False, True, report_hash, "Report sync configuration is unavailable")

        request = urllib.request.Request(
            endpoint,
            data=json.dumps(report, separators=(",", ":")).encode("utf-8"),
            headers={
                "authorization": f"Bearer {token}",
                "content-type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                if response.status not in (200, 201, 202):
                    raise urllib.error.HTTPError(
                        endpoint,
                        response.status,
                        "Report sync was rejected",
                        response.headers,
                        None,
                    )
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as error:
            _queue(report, queue_path)
            return SyncResult(False, True, report_hash, str(error))
        return SyncResult(True, False, report_hash)
    except (OSError, TypeError, ValueError, RuntimeError) as error:
        return SyncResult(False, False, "", str(error))


def main() -> None:
    raise SystemExit("Use sync_report with a signed report")

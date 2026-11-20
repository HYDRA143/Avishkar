"""Append real report verification events to an audit log."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

from signature_verify import VerificationResult


def write_audit_entry(report_hash: str, result: VerificationResult) -> None:
    try:
        if not report_hash.strip():
            raise ValueError("report_hash is required")
        path_value = os.environ.get("NETGUARD_AUDIT_LOG_PATH", "")
        if not path_value:
            raise RuntimeError("NETGUARD_AUDIT_LOG_PATH is required")
        path = Path(path_value)
        path.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": time.time(),
            "report_hash": report_hash,
            "verified": result.verified,
            "status": result.status,
        }
        with path.open("a", encoding="utf-8") as audit_file:
            audit_file.write(json.dumps(entry, sort_keys=True) + "\n")
            audit_file.flush()
            os.fsync(audit_file.fileno())
    except (OSError, TypeError, ValueError, RuntimeError) as error:
        raise RuntimeError("Audit entry could not be written") from error


def main() -> None:
    raise SystemExit("Use write_audit_entry with a verified report result")

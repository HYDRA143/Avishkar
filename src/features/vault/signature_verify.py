"""Verify report signatures with the deployment-provided public key."""

from __future__ import annotations

import base64
import json
import os
import subprocess
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from deterministic_hash import canonical_json, deterministic_hash


@dataclass(frozen=True)
class VerificationResult:
    verified: bool
    status: str
    report_hash: str | None
    error: str | None = None


def verify_signature(
    report: Any,
    signature: str,
    public_key_path: str | None = None,
) -> VerificationResult:
    try:
        if not signature.strip():
            return VerificationResult(False, "Tampered", None, "Signature is required")
        key_value = public_key_path or os.environ.get("NETGUARD_PUBLIC_KEY_PATH", "")
        if not key_value:
            return VerificationResult(False, "Tampered", None, "Public key path is required")
        key_path = Path(key_value)
        if not key_path.is_file():
            return VerificationResult(False, "Tampered", None, "Public key file is unavailable")

        report_hash = deterministic_hash(report)
        try:
            signature_bytes = base64.b64decode(signature, validate=True)
        except (ValueError, UnicodeError):
            return VerificationResult(False, "Tampered", report_hash, "Signature encoding is invalid")

        with tempfile.TemporaryDirectory() as directory:
            payload_path = Path(directory) / "report.json"
            signature_path = Path(directory) / "report.signature"
            payload_path.write_bytes(canonical_json(report))
            signature_path.write_bytes(signature_bytes)
            result = subprocess.run(
                [
                    "openssl",
                    "pkeyutl",
                    "-verify",
                    "-pubin",
                    "-inkey",
                    str(key_path),
                    "-rawin",
                    "-in",
                    str(payload_path),
                    "-sigfile",
                    str(signature_path),
                ],
                check=False,
                capture_output=True,
                timeout=10,
            )
        if result.returncode == 0:
            return VerificationResult(True, "Verified", report_hash)
        return VerificationResult(False, "Tampered", report_hash, "Signature verification failed")
    except (OSError, subprocess.SubprocessError, ValueError, TypeError, json.JSONDecodeError) as error:
        return VerificationResult(False, "Tampered", None, str(error))


def result_dict(result: VerificationResult) -> dict[str, object]:
    return asdict(result)


def main() -> None:
    raise SystemExit("Use verify_signature with a report and its signature")

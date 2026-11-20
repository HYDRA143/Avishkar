"""Verify deployment-provided client certificates for mutual TLS."""

from __future__ import annotations

import json
import os
import ssl
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class CertificateDecision:
    verified: bool
    certificate: str | None
    error: str | None = None


def _required_path(name: str) -> Path:
    try:
        value = os.environ.get(name, "").strip()
        if not value:
            raise ValueError(f"{name} is required")
        return Path(value).expanduser()
    except (OSError, ValueError) as error:
        raise RuntimeError(str(error)) from error


def _verify_chain(certificate: Path, ca_file: Path) -> None:
    try:
        result = subprocess.run(
            ["openssl", "verify", "-CAfile", str(ca_file), str(certificate)],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError) as error:
        raise RuntimeError("Unable to run certificate chain verification") from error
    if result.returncode != 0:
        raise RuntimeError("Client certificate is not trusted by the configured CA")


def verify_client_certificate(
    certificate: str | None = None,
    private_key: str | None = None,
    ca_file: str | None = None,
) -> CertificateDecision:
    try:
        certificate_path = Path(certificate).expanduser() if certificate else _required_path("NETGUARD_CLIENT_CERT")
        key_path = Path(private_key).expanduser() if private_key else _required_path("NETGUARD_CLIENT_KEY")
        ca_path = Path(ca_file).expanduser() if ca_file else _required_path("NETGUARD_CA_FILE")
        if not certificate_path.is_file() or not key_path.is_file() or not ca_path.is_file():
            raise RuntimeError("Client certificate, private key, and CA file must exist")
        context = ssl.create_default_context(cafile=str(ca_path))
        context.load_cert_chain(certfile=str(certificate_path), keyfile=str(key_path))
        _verify_chain(certificate_path, ca_path)
        return CertificateDecision(True, str(certificate_path))
    except (OSError, RuntimeError, ssl.SSLError, ValueError) as error:
        return CertificateDecision(False, None, str(error))


def main() -> None:
    try:
        print(json.dumps(asdict(verify_client_certificate()), sort_keys=True))
    except (OSError, TypeError, ValueError) as error:
        raise SystemExit(str(error)) from error


if __name__ == "__main__":
    main()

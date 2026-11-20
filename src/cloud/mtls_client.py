"""HTTPS client requiring deployment-provided mutual TLS material."""

from __future__ import annotations

import os
import ssl
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class MtlsClientError(RuntimeError):
    """Raised when a mutual TLS request cannot be completed."""


def request(
    url: str,
    method: str = "GET",
    body: bytes | None = None,
    timeout_seconds: float = 15.0,
) -> bytes:
    certificate = os.environ.get("NETGUARD_CLIENT_CERT", "")
    private_key = os.environ.get("NETGUARD_CLIENT_KEY", "")
    ca_file = os.environ.get("NETGUARD_CA_FILE", "")
    if not certificate or not private_key or not ca_file:
        raise MtlsClientError(
            "NETGUARD_CLIENT_CERT, NETGUARD_CLIENT_KEY, and NETGUARD_CA_FILE are required"
        )
    if timeout_seconds <= 0:
        raise ValueError("timeout_seconds must be positive")

    context = ssl.create_default_context(cafile=ca_file)
    try:
        context.load_cert_chain(certificate, private_key)
        with urlopen(Request(url, data=body, method=method), context=context, timeout=timeout_seconds) as response:
            return response.read()
    except (HTTPError, URLError, TimeoutError, OSError, ssl.SSLError) as error:
        raise MtlsClientError("Mutual TLS request failed") from error


def main() -> None:
    raise SystemExit("Use request with a configured HTTPS endpoint")

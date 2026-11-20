"""Client for the configured NVIDIA inference endpoint."""

from __future__ import annotations

import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class NvidiaApiError(RuntimeError):
    """Raised when the configured NVIDIA service cannot be reached."""


def generate(prompt: str, timeout_seconds: float = 30.0) -> dict[str, object]:
    if not prompt.strip():
        raise ValueError("prompt must not be empty")
    endpoint = os.environ.get("NVIDIA_API_URL", "")
    api_key = os.environ.get("NVIDIA_API_KEY", "")
    if not endpoint or not api_key:
        raise NvidiaApiError("NVIDIA_API_URL and NVIDIA_API_KEY are required")
    if timeout_seconds <= 0:
        raise ValueError("timeout_seconds must be positive")

    payload = json.dumps({"prompt": prompt}).encode("utf-8")
    request = Request(
        endpoint,
        data=payload,
        headers={
            "authorization": f"Bearer {api_key}",
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, OSError, UnicodeError, json.JSONDecodeError) as error:
        raise NvidiaApiError("NVIDIA API request failed") from error
    if not isinstance(body, dict):
        raise NvidiaApiError("NVIDIA API returned an invalid response")
    return body


def main() -> None:
    raise SystemExit("Use generate with a prompt from a trusted backend request")

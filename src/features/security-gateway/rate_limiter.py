"""Persistent per-IP sliding-window request limiter."""

from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import asdict, dataclass
from pathlib import Path


REQUEST_LIMIT = 100
WINDOW_SECONDS = 60.0
_LOCK = threading.Lock()


@dataclass(frozen=True)
class RateLimitDecision:
    ip_address: str
    allowed: bool
    status_code: int
    remaining: int
    retry_after_seconds: int
    error: str | None = None


def _state_path() -> Path:
    try:
        return Path(os.environ.get("NETGUARD_RATE_LIMIT_FILE", "/var/lib/netguard/rate_limits.json")).expanduser()
    except (OSError, ValueError) as error:
        raise RuntimeError("Invalid rate-limit state path") from error


def _read(path: Path) -> dict[str, list[float]]:
    try:
        if not path.exists():
            return {}
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("Rate-limit state must be an object")
        result: dict[str, list[float]] = {}
        for address, values in payload.items():
            if isinstance(address, str) and isinstance(values, list):
                result[address] = [float(value) for value in values]
        return result
    except (OSError, UnicodeError, json.JSONDecodeError, TypeError, ValueError) as error:
        raise RuntimeError(f"Unable to read rate-limit state from {path}") from error


def _write(path: Path, state: dict[str, list[float]]) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(f"{path.suffix}.tmp")
        temporary.write_text(json.dumps(state, sort_keys=True), encoding="utf-8")
        temporary.replace(path)
    except (OSError, UnicodeError, TypeError, ValueError) as error:
        raise RuntimeError(f"Unable to write rate-limit state to {path}") from error


def allow_request(ip_address: str, now: float | None = None) -> RateLimitDecision:
    try:
        if not isinstance(ip_address, str) or not ip_address.strip():
            return RateLimitDecision(ip_address, False, 400, 0, 0, "IP address is required")
        current = time.time() if now is None else float(now)
        cutoff = current - WINDOW_SECONDS
        path = _state_path()
        with _LOCK:
            state = _read(path)
            timestamps = [stamp for stamp in state.get(ip_address, []) if stamp > cutoff]
            if len(timestamps) >= REQUEST_LIMIT:
                retry_after = max(1, int(timestamps[0] + WINDOW_SECONDS - current))
                state[ip_address] = timestamps
                _write(path, state)
                return RateLimitDecision(ip_address, False, 429, 0, retry_after)
            timestamps.append(current)
            state[ip_address] = timestamps
            _write(path, state)
            return RateLimitDecision(ip_address, True, 200, REQUEST_LIMIT - len(timestamps), 0)
    except (RuntimeError, TypeError, ValueError, OSError) as error:
        return RateLimitDecision(ip_address, False, 500, 0, 0, str(error))


def main() -> None:
    try:
        import sys

        address = sys.argv[1] if len(sys.argv) > 1 else ""
        print(json.dumps(asdict(allow_request(address)), sort_keys=True))
    except (OSError, TypeError, ValueError) as error:
        raise SystemExit(str(error)) from error


if __name__ == "__main__":
    main()

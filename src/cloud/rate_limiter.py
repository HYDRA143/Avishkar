"""Small in-process request limiter for a single server instance."""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field


@dataclass
class RateLimiter:
    limit: int
    window_seconds: float
    _requests: deque[float] = field(default_factory=deque, init=False)

    def __post_init__(self) -> None:
        if self.limit <= 0 or self.window_seconds <= 0:
            raise ValueError("limit and window_seconds must be positive")

    def allow(self, now: float | None = None) -> bool:
        current = time.monotonic() if now is None else now
        cutoff = current - self.window_seconds
        while self._requests and self._requests[0] <= cutoff:
            self._requests.popleft()
        if len(self._requests) >= self.limit:
            return False
        self._requests.append(current)
        return True


def main() -> None:
    raise SystemExit("Create RateLimiter with deployment-specific limits")

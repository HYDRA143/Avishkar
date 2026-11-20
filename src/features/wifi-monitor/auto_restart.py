"""Restart a monitored process only when an explicit health check fails."""

from __future__ import annotations

import subprocess
from collections.abc import Sequence


def restart(command: Sequence[str]) -> None:
    if not command or any(not item for item in command):
        raise ValueError("A non-empty restart command is required")
    try:
        subprocess.run(list(command), check=True, timeout=30)
    except (OSError, subprocess.SubprocessError) as error:
        raise RuntimeError("Unable to restart the monitored service") from error


def main() -> None:
    raise SystemExit("Use restart with an explicit service command")

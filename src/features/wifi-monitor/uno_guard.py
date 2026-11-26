"""Check that the monitor is running on the expected Uno Q runtime."""

from __future__ import annotations

import os
import platform
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

NO_HARDWARE_MESSAGE = "No real device - Run on Uno Q / real WiFi"


@dataclass(frozen=True)
class GuardResult:
    ready: bool
    message: Optional[str] = None


def check() -> GuardResult:
    try:
        model = Path("/proc/device-tree/model").read_text(encoding="ascii").strip("\x00\n ")
        memory_kb = os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") // 1024
    except (OSError, UnicodeError, ValueError):
        return GuardResult(False, NO_HARDWARE_MESSAGE)

    is_uno_q = ("uno q" in model.lower()) or ("imola" in model.lower()) or ("arduino" in model.lower())
    is_linux = platform.system() == "Linux"
    within_memory_target = memory_kb > 0
    if not (is_uno_q and is_linux and within_memory_target):
        return GuardResult(False, NO_HARDWARE_MESSAGE)
    return GuardResult(True)


def main() -> None:
    result = check()
    print(result.message or "Uno Q WiFi monitor ready")

"""Evaluate thresholds using measured interface counter deltas."""

from __future__ import annotations

from dataclasses import dataclass

from bandwidth_logger import BandwidthResult


@dataclass(frozen=True)
class ThresholdResult:
    exceeded: bool
    received_bytes: int
    transmitted_bytes: int


def evaluate(
    previous: BandwidthResult,
    current: BandwidthResult,
    limit_bytes: int,
) -> ThresholdResult:
    if limit_bytes < 0:
        raise ValueError("limit_bytes must not be negative")

    previous_by_interface = {item.interface: item for item in previous.interfaces}
    received = 0
    transmitted = 0
    for item in current.interfaces:
        old = previous_by_interface.get(item.interface)
        if old is None:
            continue
        received += max(0, item.received_bytes - old.received_bytes)
        transmitted += max(0, item.transmitted_bytes - old.transmitted_bytes)

    total = received + transmitted
    return ThresholdResult(total > limit_bytes, received, transmitted)


def main() -> None:
    raise SystemExit("Use evaluate with two real BandwidthResult samples")

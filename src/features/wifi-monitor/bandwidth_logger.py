"""Read real interface byte counters from the Linux kernel."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional

NO_BANDWIDTH_MESSAGE = "No real device - Run on Uno Q / real WiFi"
NET_DEV = Path("/proc/net/dev")


@dataclass(frozen=True)
class InterfaceBandwidth:
    interface: str
    received_bytes: int
    transmitted_bytes: int


@dataclass(frozen=True)
class BandwidthResult:
    interfaces: tuple[InterfaceBandwidth, ...]
    message: Optional[str] = None


def read_bandwidth() -> BandwidthResult:
    try:
        lines = NET_DEV.read_text(encoding="ascii").splitlines()
    except (OSError, UnicodeError):
        return BandwidthResult((), NO_BANDWIDTH_MESSAGE)

    interfaces: list[InterfaceBandwidth] = []
    for line in lines:
        if ":" not in line:
            continue
        interface, values = (part.strip() for part in line.split(":", 1))
        if interface == "lo":
            continue
        fields = values.split()
        if len(fields) < 9:
            continue
        try:
            interfaces.append(
                InterfaceBandwidth(
                    interface,
                    int(fields[0]),
                    int(fields[8]),
                )
            )
        except ValueError:
            continue

    return BandwidthResult(tuple(interfaces), None if interfaces else NO_BANDWIDTH_MESSAGE)


def main() -> None:
    print(json.dumps(asdict(read_bandwidth()), sort_keys=True))


if __name__ == "__main__":
    main()

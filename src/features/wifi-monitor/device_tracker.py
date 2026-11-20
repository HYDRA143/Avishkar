"""Discover devices on the current WiFi network using local kernel data and ping."""

from __future__ import annotations

import ipaddress
import json
import re
import socket
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional

NO_DEVICE_MESSAGE = "No real device - Run on Uno Q / real WiFi"
ARP_TABLE = Path("/proc/net/arp")


@dataclass(frozen=True)
class Device:
    ip_address: str
    mac_address: str
    interface: str
    reachable: bool


@dataclass(frozen=True)
class DiscoveryResult:
    devices: tuple[Device, ...]
    message: Optional[str] = None


def _read_arp_table() -> list[tuple[str, str, str]]:
    entries: list[tuple[str, str, str]] = []
    try:
        lines = ARP_TABLE.read_text(encoding="ascii").splitlines()[1:]
    except (OSError, UnicodeError):
        return entries

    for line in lines:
        fields = line.split()
        if len(fields) < 6 or fields[2] == "0x0":
            continue
        ip_address, mac_address, interface = fields[0], fields[3], fields[5]
        if re.fullmatch(r"[0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5}", mac_address):
            entries.append((ip_address, mac_address.lower(), interface))
    return entries


def _local_network() -> Optional[ipaddress.IPv4Network]:
    try:
        route = subprocess.run(
            ["ip", "-4", "route", "get", "1.1.1.1"],
            check=True,
            capture_output=True,
            text=True,
            timeout=2,
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return None

    match = re.search(r"\bsrc\s+(\d+\.\d+\.\d+\.\d+)", route)
    if match is None:
        return None
    try:
        return ipaddress.ip_network(f"{match.group(1)}/24", strict=False)
    except ValueError:
        return None


def _ping(ip_address: str, timeout_seconds: float) -> bool:
    try:
        subprocess.run(
            ["ping", "-c", "1", "-W", str(max(1, int(timeout_seconds))), ip_address],
            check=False,
            capture_output=True,
            timeout=timeout_seconds + 1,
        )
    except (OSError, subprocess.SubprocessError):
        return False
    return True


def discover_devices(
    network: Optional[ipaddress.IPv4Network] = None,
    ping_timeout_seconds: float = 0.5,
) -> DiscoveryResult:
    """Return devices observed in ARP after a real local-subnet ping sweep."""
    if ping_timeout_seconds <= 0:
        raise ValueError("ping_timeout_seconds must be positive")

    selected_network = network or _local_network()
    if selected_network is None:
        return DiscoveryResult((), NO_DEVICE_MESSAGE)

    for host in selected_network.hosts():
        _ping(str(host), ping_timeout_seconds)

    devices = tuple(
        Device(ip_address, mac_address, interface, True)
        for ip_address, mac_address, interface in _read_arp_table()
        if ipaddress.ip_address(ip_address) in selected_network
    )
    return DiscoveryResult(devices, None if devices else NO_DEVICE_MESSAGE)


def main() -> None:
    print(json.dumps(asdict(discover_devices()), sort_keys=True))


if __name__ == "__main__":
    main()

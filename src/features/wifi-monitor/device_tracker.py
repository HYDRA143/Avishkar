"""Discover devices on the current WiFi network using local kernel data."""

from __future__ import annotations

import ipaddress
import json
import re
import socket
import struct
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from pathlib import Path
from shutil import which
from typing import Optional

NO_DEVICE_MESSAGE = "No real device - Run on Uno Q / real WiFi"
ARP_TABLE = Path("/proc/net/arp")
ROUTE_TABLE = Path("/proc/net/route")
SYS_CLASS_NET = Path("/sys/class/net")
PING_WORKERS = 16

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

def _read_neighbor_table() -> list[tuple[str, str, str]]:
    entries: dict[str, tuple[str, str, str]] = {}
    ip_command = which("ip")
    if ip_command:
        try:
            result = subprocess.run(
                (ip_command, "neigh", "show"),
                capture_output=True,
                text=True,
                check=False,
                timeout=2,
            )
        except (OSError, subprocess.TimeoutExpired):
            result = None
        if result is not None and result.returncode == 0:
            for line in result.stdout.splitlines():
                fields = line.split()
                try:
                    ip_address = str(ipaddress.IPv4Address(fields[0]))
                    interface = fields[fields.index("dev") + 1]
                    mac_address = fields[fields.index("lladdr") + 1].lower()
                except (ValueError, IndexError):
                    continue
                if re.fullmatch(r"[0-9a-f]{2}(?::[0-9a-f]{2}){5}", mac_address):
                    entries[ip_address] = (ip_address, mac_address, interface)

    try:
        lines = ARP_TABLE.read_text(encoding="ascii").splitlines()[1:]
    except (OSError, UnicodeError):
        return list(entries.values())
    for line in lines:
        fields = line.split()
        if len(fields) < 6 or fields[2] == "0x0":
            continue
        ip_address, mac_address, interface = fields[0], fields[3], fields[5]
        if re.fullmatch(r"[0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5}", mac_address):
            entries.setdefault(ip_address, (ip_address, mac_address.lower(), interface))
    return list(entries.values())

def _local_ip() -> Optional[str]:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("1.1.1.1", 80))
            return s.getsockname()[0]
        finally:
            s.close()
    except OSError:
        return None

def _local_network() -> Optional[ipaddress.IPv4Network]:
    local_ip = _local_ip()
    if local_ip is None:
        return None
    try:
        return ipaddress.ip_network(f"{local_ip}/24", strict=False)
    except ValueError:
        return None

def _route_info(local_ip: str) -> tuple[str, Optional[str]]:
    """Return the connected interface and default gateway from the kernel route table."""
    try:
        lines = ROUTE_TABLE.read_text(encoding="ascii").splitlines()[1:]
    except (OSError, UnicodeError):
        return "", None

    address = ipaddress.IPv4Address(local_ip)
    interface = ""
    best_prefix = -1
    gateway: Optional[str] = None
    for line in lines:
        fields = line.split()
        if len(fields) < 8:
            continue
        try:
            route_flags = int(fields[3], 16)
            destination = ipaddress.IPv4Address(struct.pack("<I", int(fields[1], 16)))
            gateway_address = ipaddress.IPv4Address(struct.pack("<I", int(fields[2], 16)))
            mask = ipaddress.IPv4Address(struct.pack("<I", int(fields[7], 16)))
            prefix = ipaddress.IPv4Network(f"0.0.0.0/{mask}").prefixlen
            route_network = ipaddress.ip_network(f"{destination}/{prefix}", strict=False)
        except (ValueError, struct.error):
            continue
        if route_flags & 0x1 and address in route_network and prefix > best_prefix:
            interface = fields[0]
            best_prefix = prefix
        if route_flags & 0x3 == 0x3 and destination == ipaddress.IPv4Address("0.0.0.0"):
            gateway = str(gateway_address)
    return interface, gateway

def _interface_mac(interface: str) -> str:
    if not interface or not re.fullmatch(r"[a-zA-Z0-9_.-]+", interface):
        return ""
    try:
        mac_address = (SYS_CLASS_NET / interface / "address").read_text(encoding="ascii").strip().lower()
    except (OSError, UnicodeError):
        return ""
    return mac_address if re.fullmatch(r"[0-9a-f]{2}(?::[0-9a-f]{2}){5}", mac_address) else ""

def _ping_host(ip_address: str, timeout_seconds: float) -> bool:
    timeout = max(1, int(timeout_seconds + 0.999))
    try:
        result = subprocess.run(
            ("ping", "-n", "-c", "1", "-W", str(timeout), ip_address),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
            timeout=timeout + 1,
        )
    except subprocess.TimeoutExpired:
        return False
    return result.returncode == 0

def discover_devices(
    network: Optional[ipaddress.IPv4Network] = None,
    ping_timeout_seconds: float = 0.5,
) -> DiscoveryResult:
    """Actively probe the current local /24 and return real kernel neighbor data."""
    local_ip = _local_ip()
    if local_ip is None:
        return DiscoveryResult((), NO_DEVICE_MESSAGE)
    try:
        local_address = ipaddress.IPv4Address(local_ip)
        local_network = ipaddress.ip_network(f"{local_address}/24", strict=False)
    except ipaddress.AddressValueError:
        return DiscoveryResult((), NO_DEVICE_MESSAGE)

    selected_network = local_network
    if network is not None and network.subnet_of(local_network) and local_address in network:
        selected_network = network

    interface, gateway_ip = _route_info(local_ip)
    local_device = Device(local_ip, _interface_mac(interface), interface, True)
    found: dict[str, Device] = {local_ip: local_device}
    scan_error: Optional[str] = None
    ping_available = which("ping") is not None

    if ping_available:
        targets = tuple(
            str(address)
            for address in selected_network.hosts()
            if str(address) != local_ip
        )
        try:
            with ThreadPoolExecutor(max_workers=PING_WORKERS) as executor:
                probes = {
                    executor.submit(_ping_host, address, ping_timeout_seconds): address
                    for address in targets
                }
                for probe in as_completed(probes):
                    probe.result()
        except OSError as error:
            scan_error = f"Active scan failed: {error}"
    else:
        scan_error = "Active scan unavailable: ping command not found"

    neighbor_entries = _read_neighbor_table()
    for ip_address, mac_address, neighbor_interface in neighbor_entries:
        if ipaddress.ip_address(ip_address) in selected_network:
            found.setdefault(ip_address, Device(ip_address, mac_address, neighbor_interface, True))

    if gateway_ip and ipaddress.ip_address(gateway_ip) in selected_network:
        found.setdefault(gateway_ip, Device(gateway_ip, "", interface, False))

    devices = tuple(found.values())
    return DiscoveryResult(
        devices,
        scan_error if scan_error else (None if devices else NO_DEVICE_MESSAGE),
    )

def main() -> None:
    print(json.dumps(asdict(discover_devices()), sort_keys=True))

if __name__ == "__main__":
    main()

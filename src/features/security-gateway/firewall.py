"""File-backed IP firewall for the local NetGuard gateway."""

from __future__ import annotations

import ipaddress
import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class FirewallDecision:
    ip_address: str
    allowed: bool
    reason: str


@dataclass(frozen=True)
class FirewallState:
    blocked: tuple[str, ...]
    allowed: tuple[str, ...]
    error: str | None = None


def _path(name: str, default: str) -> Path:
    try:
        return Path(os.environ.get(name, default)).expanduser()
    except (OSError, ValueError) as error:
        raise ValueError(f"Invalid firewall path for {name}") from error


def _normalise(entries: Iterable[str]) -> set[str]:
    try:
        result: set[str] = set()
        for entry in entries:
            result.add(str(ipaddress.ip_network(entry, strict=False)))
        return result
    except (TypeError, ValueError) as error:
        raise ValueError("Firewall entries must be valid IP addresses or networks") from error


def _read(path: Path) -> set[str]:
    try:
        if not path.exists():
            return set()
        payload = json.loads(path.read_text(encoding="utf-8"))
        entries = payload.get("entries", []) if isinstance(payload, dict) else payload
        if not isinstance(entries, list):
            raise ValueError("Firewall file must contain an entries list")
        return _normalise(str(entry) for entry in entries)
    except (OSError, UnicodeError, json.JSONDecodeError, TypeError, ValueError) as error:
        raise RuntimeError(f"Unable to read firewall file {path}") from error


def _write(path: Path, entries: set[str]) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(f"{path.suffix}.tmp")
        temporary.write_text(
            json.dumps({"entries": sorted(entries)}, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)
    except (OSError, UnicodeError, TypeError, ValueError) as error:
        raise RuntimeError(f"Unable to write firewall file {path}") from error


def firewall_state() -> FirewallState:
    try:
        blocked = _read(_path("NETGUARD_BLOCKLIST_FILE", "/var/lib/netguard/blocked_ips.json"))
        allowed = _read(_path("NETGUARD_ALLOWLIST_FILE", "/var/lib/netguard/allowed_ips.json"))
        return FirewallState(tuple(sorted(blocked)), tuple(sorted(allowed)))
    except (RuntimeError, ValueError) as error:
        return FirewallState((), (), str(error))


def _contains(entries: Iterable[str], address: ipaddress._BaseAddress) -> bool:
    try:
        return any(address in ipaddress.ip_network(entry) for entry in entries)
    except (TypeError, ValueError) as error:
        raise ValueError("Firewall state contains an invalid network") from error


def check_ip(ip_address: str) -> FirewallDecision:
    try:
        address = ipaddress.ip_address(ip_address)
        state = firewall_state()
        if state.error:
            return FirewallDecision(ip_address, False, state.error)
        if _contains(state.blocked, address):
            return FirewallDecision(ip_address, False, "IP address is blocked")
        if state.allowed and not _contains(state.allowed, address):
            return FirewallDecision(ip_address, False, "IP address is not allow-listed")
        return FirewallDecision(ip_address, True, "IP address is allowed")
    except (TypeError, ValueError) as error:
        return FirewallDecision(str(ip_address), False, f"Invalid IP address: {error}")


def block_ip(ip_address: str) -> FirewallState:
    try:
        network = str(ipaddress.ip_network(ip_address, strict=False))
        path = _path("NETGUARD_BLOCKLIST_FILE", "/var/lib/netguard/blocked_ips.json")
        entries = _read(path)
        entries.add(network)
        _write(path, entries)
        return firewall_state()
    except (RuntimeError, ValueError) as error:
        return FirewallState((), (), str(error))


def unblock_ip(ip_address: str) -> FirewallState:
    try:
        network = str(ipaddress.ip_network(ip_address, strict=False))
        path = _path("NETGUARD_BLOCKLIST_FILE", "/var/lib/netguard/blocked_ips.json")
        entries = _read(path)
        entries.discard(network)
        _write(path, entries)
        return firewall_state()
    except (RuntimeError, ValueError) as error:
        return FirewallState((), (), str(error))


def main() -> None:
    try:
        print(json.dumps(asdict(firewall_state()), sort_keys=True))
    except (OSError, TypeError, ValueError) as error:
        raise SystemExit(str(error)) from error


if __name__ == "__main__":
    main()

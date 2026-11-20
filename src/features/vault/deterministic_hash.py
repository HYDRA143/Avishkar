"""Canonical JSON hashing for reports."""

from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_json(value: Any) -> bytes:
    try:
        return json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    except (TypeError, ValueError, UnicodeEncodeError) as error:
        raise ValueError("Report cannot be serialized deterministically") from error


def deterministic_hash(value: Any) -> str:
    try:
        return hashlib.sha256(canonical_json(value)).hexdigest()
    except ValueError:
        raise
    except (TypeError, ValueError) as error:
        raise ValueError("Report hash could not be calculated") from error


def main() -> None:
    raise SystemExit("Use deterministic_hash with a report value")

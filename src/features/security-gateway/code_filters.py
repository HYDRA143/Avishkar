"""Reject dangerous code constructs before defensive rules are stored or run."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from typing import Iterable


@dataclass(frozen=True)
class CodeFinding:
    rule: str
    line: int
    excerpt: str


@dataclass(frozen=True)
class CodeFilterResult:
    allowed: bool
    findings: tuple[CodeFinding, ...]
    error: str | None = None


_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("dynamic-eval", re.compile(r"\beval\s*\(")),
    ("dynamic-exec", re.compile(r"\bexec\s*\(")),
    ("shell-command", re.compile(r"\bos\.system\s*\(")),
    ("shell-subprocess", re.compile(r"\bsubprocess\.(?:run|call|Popen|check_call)\s*\(")),
    ("shell-enabled", re.compile(r"\bshell\s*=\s*True\b", re.IGNORECASE)),
    ("command-interpolation", re.compile(r"\bos\.popen\s*\(")),
)


def _findings(lines: Iterable[str]) -> tuple[CodeFinding, ...]:
    try:
        findings: list[CodeFinding] = []
        for line_number, line in enumerate(lines, start=1):
            for rule, pattern in _PATTERNS:
                match = pattern.search(line)
                if match is not None:
                    excerpt = line.strip()
                    findings.append(CodeFinding(rule, line_number, excerpt[:200]))
        return tuple(findings)
    except (TypeError, ValueError) as error:
        raise RuntimeError("Unable to inspect code input") from error


def check_code(source: str) -> CodeFilterResult:
    try:
        if not isinstance(source, str):
            return CodeFilterResult(False, (), "Code input must be text")
        findings = _findings(source.splitlines())
        return CodeFilterResult(not findings, findings)
    except (RuntimeError, TypeError, ValueError) as error:
        return CodeFilterResult(False, (), str(error))


def is_code_safe(source: str) -> bool:
    try:
        return check_code(source).allowed
    except (TypeError, ValueError):
        return False


def main() -> None:
    try:
        import sys

        result = check_code(sys.stdin.read())
        print(json.dumps(asdict(result), sort_keys=True))
    except (OSError, TypeError, ValueError) as error:
        raise SystemExit(str(error)) from error


if __name__ == "__main__":
    main()

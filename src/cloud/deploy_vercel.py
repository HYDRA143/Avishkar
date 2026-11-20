"""Deploy the current application through the Vercel CLI."""

from __future__ import annotations

import os
import subprocess


def deploy(project_directory: str = ".", timeout_seconds: float = 300.0) -> str:
    token = os.environ.get("VERCEL_TOKEN", "")
    if not token:
        raise RuntimeError("VERCEL_TOKEN is required")
    if timeout_seconds <= 0:
        raise ValueError("timeout_seconds must be positive")
    try:
        result = subprocess.run(
            ["vercel", "--prod"],
            cwd=project_directory,
            check=True,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            env={**os.environ, "VERCEL_TOKEN": token},
        )
    except (OSError, subprocess.SubprocessError) as error:
        raise RuntimeError("Vercel deployment failed") from error
    return result.stdout.strip()


def main() -> None:
    print(deploy())

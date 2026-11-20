"""Send operational alerts through the configured Telegram bot."""

from __future__ import annotations

import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class TelegramAlertError(RuntimeError):
    """Raised when an alert cannot be delivered."""


def send(message: str, timeout_seconds: float = 10.0) -> dict[str, object]:
    if not message.strip():
        raise ValueError("message must not be empty")
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not bot_token or not chat_id:
        raise TelegramAlertError("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required")
    if timeout_seconds <= 0:
        raise ValueError("timeout_seconds must be positive")

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = urlencode({"chat_id": chat_id, "text": message}).encode("utf-8")
    try:
        with urlopen(Request(url, data=payload), timeout=timeout_seconds) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, OSError, UnicodeError, json.JSONDecodeError) as error:
        raise TelegramAlertError("Telegram alert request failed") from error
    if not isinstance(body, dict):
        raise TelegramAlertError("Telegram returned an invalid response")
    return body


def main() -> None:
    raise SystemExit("Use send with an operational alert message")

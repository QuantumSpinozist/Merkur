"""Outbound Telegram message sender (thin wrapper around Bot API)."""

import logging
import os

import httpx

logger = logging.getLogger(__name__)


def _api_url(method: str) -> str:
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    return f"https://api.telegram.org/bot{token}/{method}"


async def send_message(chat_id: int, text: str) -> None:
    """Send a text message to a Telegram chat."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            _api_url("sendMessage"),
            json={"chat_id": chat_id, "text": text},
        )
        if response.status_code != 200:
            logger.error(
                "Telegram send failed: %s %s", response.status_code, response.text
            )
        else:
            logger.info("Telegram message sent to chat %s.", chat_id)

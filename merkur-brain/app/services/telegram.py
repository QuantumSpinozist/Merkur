"""Outbound Telegram message sender (thin wrapper around Bot API)."""

import logging
import os

import httpx

logger = logging.getLogger(__name__)


def _api_url(method: str) -> str:
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    return f"https://api.telegram.org/bot{token}/{method}"


async def send_message(chat_id: int, text: str) -> None:
    """Send a text message to a Telegram chat (Markdown V2 parse mode)."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            _api_url("sendMessage"),
            json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
        )
        if response.status_code != 200:
            logger.error(
                "Telegram send failed: %s %s", response.status_code, response.text
            )
        else:
            logger.info("Telegram message sent to chat %s.", chat_id)


async def get_file_path(file_id: str) -> str:
    """Resolve a Telegram file_id to a downloadable file_path via getFile."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            _api_url("getFile"),
            params={"file_id": file_id},
        )
        response.raise_for_status()
        data = response.json()
        return data["result"]["file_path"]


async def download_file(file_path: str) -> bytes:
    """Download a file from Telegram's CDN by its file_path."""
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    url = f"https://api.telegram.org/file/bot{token}/{file_path}"
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


async def set_commands() -> None:
    """Register bot commands so they appear in the Telegram / menu."""
    commands = [
        {"command": "note", "description": "Save a note: /note <text>"},
        {
            "command": "todo",
            "description": "Add a todo: /todo <text> [due:DATE] [repeat:…] [note:…]",
        },
        {"command": "done", "description": "Check off a todo: /done <number>"},
        {
            "command": "remind",
            "description": "Set daily reminder: /remind HH:MM | off | status",
        },
        {"command": "help", "description": "Show available commands"},
    ]
    async with httpx.AsyncClient() as client:
        response = await client.post(
            _api_url("setMyCommands"),
            json={"commands": commands},
        )
        if response.status_code != 200:
            logger.error("Failed to set bot commands: %s", response.text)
        else:
            logger.info("Bot commands registered.")

"""Persistent key-value settings backed by the `settings` Supabase table."""

import logging

from app.services.notes import get_client

logger = logging.getLogger(__name__)


async def get_setting(key: str) -> str | None:
    client = get_client()
    result = client.table("settings").select("value").eq("key", key).limit(1).execute()
    if result.data:
        return result.data[0]["value"]
    return None


async def set_setting(key: str, value: str) -> None:
    client = get_client()
    client.table("settings").upsert({"key": key, "value": value}).execute()
    logger.debug("Setting %r = %r saved.", key, value)

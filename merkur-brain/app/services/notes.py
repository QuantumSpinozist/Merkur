"""Supabase read/write helpers for notes and folders.

All DB access in merkur-brain goes through this module.
Routers never call Supabase directly.
"""

import logging
import os

from supabase import Client, create_client

from app.models import FolderRecord, NoteRecord

logger = logging.getLogger(__name__)


def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


async def list_folders() -> list[FolderRecord]:
    """Return all folders (id + name) for use by the intake agent."""
    client = get_client()
    result = client.table("folders").select("id, name, parent_id").execute()
    return [FolderRecord(**row) for row in result.data]


async def create_note(
    title: str,
    content: str,
    folder_id: str | None,
    source: str = "whatsapp",
) -> NoteRecord:
    """Insert a new note and return the created record."""
    client = get_client()
    payload: dict = {
        "title": title,
        "content": content,
        "source": source,
        "is_cleaned": False,
    }
    if folder_id is not None:
        payload["folder_id"] = folder_id

    result = client.table("notes").insert(payload).execute()
    row = result.data[0]
    return NoteRecord(**row)


async def update_note_content(note_id: str, cleaned_content: str) -> None:
    """Set cleaned content and mark the note as cleaned."""
    client = get_client()
    client.table("notes").update({"content": cleaned_content, "is_cleaned": True}).eq(
        "id", note_id
    ).execute()
    logger.info("Note %s marked as cleaned.", note_id)

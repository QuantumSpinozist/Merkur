"""Supabase read/write helpers for notes and folders.

All DB access in merkur-brain goes through this module.
Routers never call Supabase directly.
"""

import logging
import os

from supabase import Client, create_client

from app.models import FolderRecord, NoteRecord, PendingTodo, TodoRecord

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
    source: str = "telegram",
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


# ---------------------------------------------------------------------------
# Todos
# ---------------------------------------------------------------------------

_TELEGRAM_TODOS_TITLE = "Miscellaneous Todos"


async def create_folder(name: str, parent_name: str | None = None) -> FolderRecord:
    """Create a folder, optionally nested under an existing parent."""
    client = get_client()
    parent_id: str | None = None

    if parent_name:
        result = (
            client.table("folders")
            .select("id")
            .ilike("name", parent_name)
            .limit(1)
            .execute()
        )
        if not result.data:
            result = (
                client.table("folders")
                .select("id")
                .ilike("name", f"%{parent_name}%")
                .limit(1)
                .execute()
            )
        if result.data:
            parent_id = result.data[0]["id"]

    created = (
        client.table("folders").insert({"name": name, "parent_id": parent_id}).execute()
    )
    row = created.data[0]
    return FolderRecord(id=row["id"], name=row["name"], parent_id=row.get("parent_id"))


async def find_note_by_title(
    title_query: str, folder_query: str | None = None
) -> NoteRecord | None:
    """Find a note by title (exact then partial), optionally scoped to a folder.

    If folder_query is given, only notes whose folder name matches are considered.
    """
    client = get_client()
    cols = "id, title, content, folder_id, source, is_cleaned"

    # When a folder is specified, fetch matching folders first
    folder_ids: list[str] | None = None
    if folder_query:
        f_exact = (
            client.table("folders").select("id").ilike("name", folder_query).execute()
        )
        if not f_exact.data:
            f_partial = (
                client.table("folders")
                .select("id")
                .ilike("name", f"%{folder_query}%")
                .execute()
            )
            folder_ids = [r["id"] for r in f_partial.data]
        else:
            folder_ids = [r["id"] for r in f_exact.data]

        if not folder_ids:
            return None  # folder not found → can't match

    def _search(title_pattern: str) -> NoteRecord | None:
        q = client.table("notes").select(cols).ilike("title", title_pattern)
        if folder_ids is not None:
            q = q.in_("folder_id", folder_ids)
        result = q.limit(1).execute()
        return NoteRecord(**result.data[0]) if result.data else None

    return _search(title_query) or _search(f"%{title_query}%")


async def get_or_create_telegram_todos_note() -> NoteRecord:
    """Return (or lazily create) the dedicated note for todos added via Telegram.

    Searches by title only — source is irrelevant here.
    """
    client = get_client()
    result = (
        client.table("notes")
        .select("id, title, content, folder_id, source, is_cleaned")
        .eq("title", _TELEGRAM_TODOS_TITLE)
        .limit(1)
        .execute()
    )
    if result.data:
        return NoteRecord(**result.data[0])

    created = (
        client.table("notes")
        .insert(
            {
                "title": _TELEGRAM_TODOS_TITLE,
                "content": "",
                "source": "telegram",
                "is_cleaned": True,
            }
        )
        .execute()
    )
    return NoteRecord(**created.data[0])


async def create_todo(
    note_id: str,
    text: str,
    due_date: str | None = None,
    recurrence: str | None = None,
) -> TodoRecord:
    """Insert a new todo row and return it."""
    client = get_client()
    payload: dict = {"note_id": note_id, "text": text}
    if due_date:
        payload["due_date"] = due_date
    if recurrence:
        payload["recurrence"] = recurrence

    result = client.table("todos").insert(payload).execute()
    row = result.data[0]
    return TodoRecord(
        id=row["id"],
        note_id=row["note_id"],
        text=row["text"],
        done=row["done"],
        done_at=row.get("done_at"),
        recurrence=row.get("recurrence"),
        due_date=row.get("due_date"),
        created_at=row["created_at"],
    )


async def append_note_content(note_id: str, text: str) -> NoteRecord:
    """Append text to an existing note, separated by a blank line."""
    client = get_client()
    result = (
        client.table("notes")
        .select("id, title, content, folder_id, source, is_cleaned")
        .eq("id", note_id)
        .single()
        .execute()
    )
    existing = result.data.get("content") or ""
    separator = "\n\n" if existing.strip() else ""
    new_content = existing + separator + text
    client.table("notes").update({"content": new_content}).eq("id", note_id).execute()
    logger.info("Appended to note %s.", note_id)
    return NoteRecord(**{**result.data, "content": new_content})


async def update_todo_fields(
    todo_id: str,
    text: str | None = None,
    due_date: str | None = None,
    recurrence: str | None = None,
) -> None:
    """Update mutable fields on an existing todo."""
    client = get_client()
    payload: dict = {}
    if text is not None:
        payload["text"] = text
    if due_date is not None:
        payload["due_date"] = due_date
    if recurrence is not None:
        payload["recurrence"] = recurrence
    if payload:
        client.table("todos").update(payload).eq("id", todo_id).execute()
        logger.info("Updated todo %s: %s", todo_id, list(payload.keys()))


async def mark_todo_done(todo_id: str) -> None:
    """Mark a todo as done and record when it was completed."""
    from datetime import datetime, timezone

    client = get_client()
    client.table("todos").update(
        {"done": True, "done_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", todo_id).execute()
    logger.info("Todo %s marked as done.", todo_id)


async def list_pending_todos() -> list[PendingTodo]:
    """Return all undone todos with their note title and folder name."""
    client = get_client()
    result = (
        client.table("todos")
        .select(
            "id, text, recurrence, due_date, "
            "notes!inner(title, folder_id, folders(name))"
        )
        .eq("done", False)
        .order("created_at", desc=False)
        .execute()
    )
    todos: list[PendingTodo] = []
    for row in result.data:
        note: dict = row["notes"]
        folder: dict = note.get("folders") or {}
        todos.append(
            PendingTodo(
                id=row["id"],
                text=row["text"],
                recurrence=row.get("recurrence"),
                due_date=row.get("due_date"),
                note_title=note["title"],
                folder_name=folder.get("name"),
            )
        )
    return todos

"""Pydantic models for merkur-brain — agents, webhook payloads, and service I/O."""

from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Intake agent
# ---------------------------------------------------------------------------


class IntakeInput(BaseModel):
    raw_message: str
    available_folders: list[dict[str, str]]  # [{"id": str, "name": str}]


class IntakeOutput(BaseModel):
    title: str  # short, inferred — max 60 chars
    content: str  # note body (may equal raw_message in MVP)
    folder_id: str | None  # matched folder id, or None = inbox


# ---------------------------------------------------------------------------
# Cleanup agent
# ---------------------------------------------------------------------------


class CleanupInput(BaseModel):
    raw_content: str
    title: str


class CleanupOutput(BaseModel):
    cleaned_content: str  # valid markdown


# ---------------------------------------------------------------------------
# Telegram webhook payloads (Bot API shape)
# ---------------------------------------------------------------------------


class TelegramUser(BaseModel):
    id: int
    first_name: str
    username: str | None = None


class TelegramChat(BaseModel):
    id: int
    type: str


class TelegramMessage(BaseModel):
    message_id: int
    from_: TelegramUser | None = None  # absent in channel posts
    chat: TelegramChat
    text: str | None = None

    model_config = {"populate_by_name": True}

    @classmethod
    def from_payload(cls, data: dict) -> "TelegramMessage":
        """Parse a message object from a Telegram Update payload."""
        from_data = data.get("from")
        return cls(
            message_id=data["message_id"],
            from_=TelegramUser(**from_data) if from_data else None,
            chat=TelegramChat(**data["chat"]),
            text=data.get("text"),
        )


class TelegramUpdate(BaseModel):
    update_id: int
    message: dict | None = None


# ---------------------------------------------------------------------------
# Service layer I/O
# ---------------------------------------------------------------------------


class NoteRecord(BaseModel):
    id: str
    title: str
    content: str | None
    folder_id: str | None
    source: str
    is_cleaned: bool


class FolderRecord(BaseModel):
    id: str
    name: str
    parent_id: str | None


# ---------------------------------------------------------------------------
# Todos
# ---------------------------------------------------------------------------


class TodoRecord(BaseModel):
    id: str
    note_id: str
    text: str
    done: bool
    done_at: str | None
    recurrence: str | None
    due_date: str | None
    created_at: str


class PendingTodo(BaseModel):
    """A todo enriched with its note and folder context, for reminder messages."""

    id: str
    text: str
    recurrence: str | None
    due_date: str | None
    note_title: str
    folder_name: str | None

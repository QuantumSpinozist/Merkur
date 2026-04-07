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


# ---------------------------------------------------------------------------
# Intent agent
# ---------------------------------------------------------------------------


class IntentInput(BaseModel):
    text: str
    available_folders: list[dict[str, str]]  # [{"id": str, "name": str}]


class IntentAction(BaseModel):
    """Structured action parsed from a free-text user instruction.

    action values:
      create_note   — save a new note
      append_note   — add content to an existing note
      query_note    — fetch and display a specific note
      query_notes   — answer a natural-language question from notes/todos
      create_todo   — add a todo
      update_todo   — edit an existing todo's text/due_date/recurrence
      list_todos    — show pending todos
      complete_todo — mark a todo done
      create_folder — create a folder
      unknown       — could not understand; reply with `reply` field
    """

    # action discriminator
    action: str
    # create_note / append_note / query_note
    note_title: str | None = None
    note_content: str | None = None  # full body for create; appended text for append
    note_folder_id: str | None = None
    note_query: str | None = None  # "Folder/Note" query for append_note / query_note
    # query_notes
    user_question: str | None = None  # verbatim question to answer from notes
    # create_todo / update_todo
    todo_text: str | None = None
    todo_note_query: str | None = None  # "Folder/Note" hint
    todo_due_date: str | None = None
    todo_recurrence: str | None = None  # daily | weekly | monthly
    # complete_todo / update_todo — 1-based index from list
    todo_number: int | None = None
    # create_folder
    folder_name: str | None = None
    folder_parent_name: str | None = None
    # unknown fallback
    reply: str | None = None


# ---------------------------------------------------------------------------
# Query agent
# ---------------------------------------------------------------------------


class QueryInput(BaseModel):
    question: str
    notes: list[dict]  # [{"title": str, "content": str, "folder_name": str | None}]


class QueryOutput(BaseModel):
    answer: str

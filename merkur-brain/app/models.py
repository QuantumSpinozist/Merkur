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
# WhatsApp webhook payloads (Meta API shape — simplified for MVP)
# ---------------------------------------------------------------------------


class WhatsAppTextMessage(BaseModel):
    body: str


class WhatsAppMessage(BaseModel):
    id: str
    from_: str  # sender phone number — aliased from "from" (reserved keyword)
    type: str
    text: WhatsAppTextMessage | None = None

    model_config = {"populate_by_name": True}

    @classmethod
    def from_payload(cls, data: dict) -> "WhatsAppMessage":
        """Parse a message object from Meta's webhook payload."""
        return cls(
            id=data["id"],
            from_=data["from"],
            type=data["type"],
            text=WhatsAppTextMessage(**data["text"]) if "text" in data else None,
        )


class WhatsAppWebhookPayload(BaseModel):
    object: str
    entry: list[dict]


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

"""Telegram webhook router — POST /webhook/telegram."""

import logging
import os

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from app.agents.cleanup_agent import run_cleanup_agent
from app.agents.intake_agent import run_intake_agent
from app.models import CleanupInput, IntakeInput, TelegramMessage, TelegramUpdate
from app.services import notes as notes_service
from app.services import telegram as tg_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook/telegram", tags=["telegram"])

HELP_TEXT = """\
🪐 *Merkur* — your personal knowledge OS

Just send me any message and I'll save it as a note.

*Commands:*
/note <text> — explicitly save a note
/help — show this message

I'll automatically pick the right folder and clean up the formatting for you.\
"""

WELCOME_TEXT = """\
👋 Welcome to Merkur!

Send me anything — a thought, a link, a reminder — and I'll save it as a note.

Type /help to see all commands.\
"""

UNKNOWN_COMMAND_TEXT = "Unknown command. Type /help to see what I can do."


@router.post("")
async def receive_update(request: Request, background_tasks: BackgroundTasks) -> dict:
    """Handle inbound Telegram updates.

    Always returns HTTP 200 — Telegram will retry on any other status code.
    """
    _verify_secret(request.headers.get("X-Telegram-Bot-Api-Secret-Token", ""))

    try:
        update = TelegramUpdate.model_validate(await request.json())
    except Exception as exc:
        logger.error("Failed to parse Telegram update: %s", exc)
        return {"ok": True}

    message = _extract_text_message(update)
    if message is None:
        logger.info("Non-text or empty Telegram update. Ignoring.")
        return {"ok": True}

    chat_id = message.chat.id
    text = message.text or ""

    # --- Command dispatch ---
    if text.startswith("/"):
        await _handle_command(text, chat_id, background_tasks)
        return {"ok": True}

    # --- Plain text → save as note ---
    await _save_note(text, chat_id, background_tasks)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Command handlers
# ---------------------------------------------------------------------------


async def _handle_command(
    text: str, chat_id: int, background_tasks: BackgroundTasks
) -> None:
    command, _, arg = text.partition(" ")
    command = command.lower().split("@")[0]  # strip bot username if present

    if command in ("/start",):
        background_tasks.add_task(
            tg_service.send_message, chat_id=chat_id, text=WELCOME_TEXT
        )

    elif command == "/help":
        background_tasks.add_task(
            tg_service.send_message, chat_id=chat_id, text=HELP_TEXT
        )

    elif command == "/note":
        if not arg.strip():
            background_tasks.add_task(
                tg_service.send_message,
                chat_id=chat_id,
                text="Usage: /note <your text>",
            )
        else:
            await _save_note(arg.strip(), chat_id, background_tasks)

    else:
        background_tasks.add_task(
            tg_service.send_message, chat_id=chat_id, text=UNKNOWN_COMMAND_TEXT
        )


async def _save_note(
    text: str, chat_id: int, background_tasks: BackgroundTasks
) -> None:
    """Run intake agent, persist note, schedule cleanup, send confirmation."""
    try:
        folders = await notes_service.list_folders()
        folder_list = [{"id": f.id, "name": f.name} for f in folders]

        intake_output = await run_intake_agent(
            IntakeInput(raw_message=text, available_folders=folder_list)
        )

        note = await notes_service.create_note(
            title=intake_output.title,
            content=intake_output.content,
            folder_id=intake_output.folder_id,
        )
    except Exception as exc:
        logger.error("Failed to create note from Telegram message: %s", exc)
        background_tasks.add_task(
            tg_service.send_message,
            chat_id=chat_id,
            text="⚠️ Something went wrong saving your note. Please try again.",
        )
        return

    background_tasks.add_task(
        _run_cleanup,
        note_id=note.id,
        raw_content=intake_output.content,
        title=note.title,
    )

    folder_name = _find_folder_name(folder_list, intake_output.folder_id)
    confirmation = f'✅ Saved to *{folder_name}*: "{note.title}"'
    background_tasks.add_task(
        tg_service.send_message, chat_id=chat_id, text=confirmation
    )


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _verify_secret(token_header: str) -> None:
    expected = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
    if not expected:
        return
    if token_header != expected:
        raise HTTPException(status_code=403, detail="Invalid secret token")


def _extract_text_message(update: TelegramUpdate) -> TelegramMessage | None:
    if update.message is None:
        return None
    try:
        msg = TelegramMessage.from_payload(update.message)
        if msg.text:
            return msg
    except Exception as exc:
        logger.error("Error extracting Telegram message: %s", exc)
    return None


def _find_folder_name(folders: list[dict[str, str]], folder_id: str | None) -> str:
    if folder_id is None:
        return "Inbox"
    for f in folders:
        if f["id"] == folder_id:
            return f["name"]
    return "Inbox"


async def _run_cleanup(note_id: str, raw_content: str, title: str) -> None:
    try:
        result = await run_cleanup_agent(
            CleanupInput(raw_content=raw_content, title=title)
        )
        await notes_service.update_note_content(note_id, result.cleaned_content)
    except Exception as exc:
        logger.error("Cleanup background task failed for note %s: %s", note_id, exc)

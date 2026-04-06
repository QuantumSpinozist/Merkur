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


@router.post("")
async def receive_update(request: Request, background_tasks: BackgroundTasks) -> dict:
    """Handle inbound Telegram updates.

    Always returns HTTP 200 — Telegram will retry on any other status code.
    """
    # --- Optional secret token verification ---
    _verify_secret(request.headers.get("X-Telegram-Bot-Api-Secret-Token", ""))

    # --- Parse update ---
    try:
        update = TelegramUpdate.model_validate(await request.json())
    except Exception as exc:
        logger.error("Failed to parse Telegram update: %s", exc)
        return {"ok": True}

    # --- Extract text message ---
    message = _extract_text_message(update)
    if message is None:
        logger.info("Non-text or empty Telegram update. Ignoring.")
        return {"ok": True}

    chat_id = message.chat.id

    # --- Intake agent: parse message → note metadata ---
    try:
        folders = await notes_service.list_folders()
        folder_list = [{"id": f.id, "name": f.name} for f in folders]

        intake_output = await run_intake_agent(
            IntakeInput(
                raw_message=message.text,  # type: ignore[arg-type]
                available_folders=folder_list,
            )
        )

        note = await notes_service.create_note(
            title=intake_output.title,
            content=intake_output.content,
            folder_id=intake_output.folder_id,
        )
    except Exception as exc:
        logger.error("Failed to create note from Telegram message: %s", exc)
        return {"ok": True}

    # --- Cleanup agent: run as background task (non-blocking) ---
    background_tasks.add_task(
        _run_cleanup,
        note_id=note.id,
        raw_content=intake_output.content,
        title=note.title,
    )

    # --- Send confirmation reply ---
    folder_name = _find_folder_name(folder_list, intake_output.folder_id)
    confirmation = f'[Merkur] Saved to {folder_name}: "{note.title}"'
    background_tasks.add_task(
        tg_service.send_message, chat_id=chat_id, text=confirmation
    )

    return {"ok": True}


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _verify_secret(token_header: str) -> None:
    """Raise HTTPException if the secret token header doesn't match."""
    expected = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
    if not expected:
        return  # No secret configured — skip check

    if token_header != expected:
        raise HTTPException(status_code=403, detail="Invalid secret token")


def _extract_text_message(update: TelegramUpdate) -> TelegramMessage | None:
    """Return the text message from the update, or None if not a text message."""
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

"""WhatsApp webhook router — GET verification + POST message handler."""

import hashlib
import hmac
import logging
import os

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response

from app.agents.cleanup_agent import run_cleanup_agent
from app.agents.intake_agent import run_intake_agent
from app.models import (
    CleanupInput,
    IntakeInput,
    WhatsAppMessage,
    WhatsAppWebhookPayload,
)
from app.services import notes as notes_service
from app.services import whatsapp as wa_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook/whatsapp", tags=["whatsapp"])


# ---------------------------------------------------------------------------
# GET — webhook verification (Meta sends hub.challenge on first setup)
# ---------------------------------------------------------------------------


@router.get("")
async def verify_webhook(request: Request) -> Response:
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    verify_token = os.environ.get("WHATSAPP_VERIFY_TOKEN", "")

    if mode == "subscribe" and token == verify_token:
        logger.info("WhatsApp webhook verified.")
        return Response(content=challenge, media_type="text/plain")

    raise HTTPException(status_code=403, detail="Verification failed")


# ---------------------------------------------------------------------------
# POST — inbound message handler
# ---------------------------------------------------------------------------


@router.post("")
async def receive_message(request: Request, background_tasks: BackgroundTasks) -> dict:
    """Handle inbound WhatsApp messages from Meta.

    Always returns HTTP 200 — even on errors — to prevent Meta from retrying.
    """
    # --- Signature verification ---
    body_bytes = await request.body()
    _verify_signature(body_bytes, request.headers.get("X-Hub-Signature-256", ""))

    # --- Parse payload ---
    try:
        payload = WhatsAppWebhookPayload.model_validate(await request.json())
    except Exception as exc:
        logger.error("Failed to parse webhook payload: %s", exc)
        return {"status": "ok"}

    # --- Extract the first text message from the payload ---
    message = _extract_text_message(payload)
    if message is None:
        # Non-text messages (images, audio, etc.) — ignore for MVP
        logger.info("Non-text or empty message received. Ignoring.")
        return {"status": "ok"}

    # --- Intake agent: parse message → note metadata ---
    try:
        folders = await notes_service.list_folders()
        folder_list = [{"id": f.id, "name": f.name} for f in folders]

        intake_output = await run_intake_agent(
            IntakeInput(raw_message=message.text.body, available_folders=folder_list)  # type: ignore[union-attr]
        )

        note = await notes_service.create_note(
            title=intake_output.title,
            content=intake_output.content,
            folder_id=intake_output.folder_id,
        )
    except Exception as exc:
        logger.error("Failed to create note from WhatsApp message: %s", exc)
        return {"status": "ok"}

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
        wa_service.send_message, to=message.from_, text=confirmation
    )

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _verify_signature(body: bytes, signature_header: str) -> None:
    """Raise HTTPException if the X-Hub-Signature-256 header is invalid."""
    app_secret = os.environ.get("WHATSAPP_APP_SECRET", "")
    if not app_secret:
        logger.warning("WHATSAPP_APP_SECRET not set — skipping signature check.")
        return

    expected = (
        "sha256=" + hmac.new(app_secret.encode(), body, hashlib.sha256).hexdigest()
    )

    if not hmac.compare_digest(expected, signature_header):
        raise HTTPException(status_code=403, detail="Invalid signature")


def _extract_text_message(payload: WhatsAppWebhookPayload) -> WhatsAppMessage | None:
    """Pull the first text message out of Meta's nested payload structure."""
    try:
        for entry in payload.entry:
            for change in entry.get("changes", []):
                messages = change.get("value", {}).get("messages", [])
                for msg_data in messages:
                    if msg_data.get("type") == "text":
                        return WhatsAppMessage.from_payload(msg_data)
    except Exception as exc:
        logger.error("Error extracting message: %s", exc)
    return None


def _find_folder_name(folders: list[dict[str, str]], folder_id: str | None) -> str:
    """Return folder name by id, or 'Inbox' if not found."""
    if folder_id is None:
        return "Inbox"
    for f in folders:
        if f["id"] == folder_id:
            return f["name"]
    return "Inbox"


async def _run_cleanup(note_id: str, raw_content: str, title: str) -> None:
    """Background task: run cleanup agent and update note in DB."""
    try:
        result = await run_cleanup_agent(
            CleanupInput(raw_content=raw_content, title=title)
        )
        await notes_service.update_note_content(note_id, result.cleaned_content)
    except Exception as exc:
        logger.error("Cleanup background task failed for note %s: %s", note_id, exc)

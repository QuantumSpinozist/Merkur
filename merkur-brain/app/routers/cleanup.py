"""POST /cleanup — run the cleanup agent on a note and persist the result."""

import logging
import os

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.agents.cleanup_agent import run_cleanup_agent
from app.models import CleanupInput
from app.services import notes as notes_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cleanup", tags=["cleanup"])


class CleanupRequest(BaseModel):
    note_id: str
    title: str
    content: str


class CleanupResponse(BaseModel):
    cleaned_content: str


def _verify_secret(request: Request) -> None:
    expected = os.environ.get("BRAIN_SECRET", "")
    if not expected:
        return
    if request.headers.get("X-Brain-Secret", "") != expected:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.post("", response_model=CleanupResponse)
async def cleanup_note(request: Request, body: CleanupRequest) -> CleanupResponse:
    """Run the cleanup agent on the provided content and persist the result."""
    _verify_secret(request)

    result = await run_cleanup_agent(
        CleanupInput(raw_content=body.content, title=body.title)
    )

    await notes_service.update_note_content(body.note_id, result.cleaned_content)
    logger.info("Cleanup applied to note %s via web UI.", body.note_id)

    return CleanupResponse(cleaned_content=result.cleaned_content)

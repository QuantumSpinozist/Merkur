"""POST /query — answer a natural-language question from the user's notes."""

import logging
import os

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.agents.query_agent import run_query_agent
from app.models import QueryInput
from app.services import notes as notes_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/query", tags=["query"])


class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    answer: str


def _verify_secret(request: Request) -> None:
    expected = os.environ.get("BRAIN_SECRET", "")
    if not expected:
        return
    if request.headers.get("X-Brain-Secret", "") != expected:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.post("", response_model=QueryResponse)
async def query_notes(request: Request, body: QueryRequest) -> QueryResponse:
    """Answer a natural-language question grounded in the user's notes."""
    _verify_secret(request)

    notes = await notes_service.list_all_notes_for_rag()
    result = await run_query_agent(QueryInput(question=body.question, notes=notes))
    logger.info("Query answered for question: %.60s…", body.question)
    return QueryResponse(answer=result.answer)

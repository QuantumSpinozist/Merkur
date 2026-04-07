"""Query agent — answers natural-language questions about the user's notes."""

import logging
import os

import anthropic

from app.models import QueryInput, QueryOutput

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-5"
MAX_TOKENS = 1024

# Content is truncated per note so the total context stays manageable
_CONTENT_LIMIT = 1200

SYSTEM_PROMPT = """\
You are a personal knowledge assistant called Merkur.
The user's notes are provided below. Answer the user's question concisely
and only using information present in these notes. If the answer is not there,
say so clearly. Do not invent facts.

{notes_context}
"""


async def run_query_agent(input_data: QueryInput) -> QueryOutput:
    """Call Claude to answer a question grounded in the user's notes."""
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    notes_context = _format_notes(input_data.notes)
    system = SYSTEM_PROMPT.format(notes_context=notes_context)

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system,
            messages=[{"role": "user", "content": input_data.question}],
        )
        logger.info(
            "Query agent token usage — input: %d, output: %d",
            response.usage.input_tokens,
            response.usage.output_tokens,
        )
        answer = response.content[0].text.strip()
        return QueryOutput(answer=answer)

    except Exception as exc:
        logger.error("Query agent failed: %s", exc)
        return QueryOutput(answer="Sorry, I couldn't process that query.")


def _format_notes(notes: list[dict]) -> str:
    if not notes:
        return "*(No notes found.)*"
    parts: list[str] = []
    for note in notes:
        folder = note.get("folder_name") or "Inbox"
        title = note.get("title") or "Untitled"
        content = note.get("content") or ""
        if len(content) > _CONTENT_LIMIT:
            content = content[:_CONTENT_LIMIT] + " …"
        parts.append(f"### {title}\n_Folder: {folder}_\n\n{content}")
    return "\n\n---\n\n".join(parts)

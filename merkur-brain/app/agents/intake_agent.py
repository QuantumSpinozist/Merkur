"""Intake agent — parses a raw WhatsApp message into a note with folder + title."""

import json
import logging
import os

import anthropic

from app.models import IntakeInput, IntakeOutput

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-5"
MAX_TOKENS = 1024

SYSTEM_PROMPT = """\
You are a personal knowledge assistant. Your job is to parse a raw message and \
produce structured metadata for a note.

Given:
- A raw WhatsApp message from the user
- A list of available folders (id + name)

Respond with valid JSON only — no markdown fences, no preamble, no explanation.

Rules:
- "title": a short, descriptive title (≤ 60 characters). Infer from the content.
- "content": the note body. In MVP this equals the raw message.
- "folder_id": the UUID of the best-matching folder, or null if no folder
  clearly fits. Never invent a folder. If uncertain, use null (Inbox).
- The user writes in German and English — handle both naturally.

Output format:
{"title": "...", "content": "...", "folder_id": "..." | null}
"""


async def run_intake_agent(input_data: IntakeInput) -> IntakeOutput:
    """Call Claude to parse a WhatsApp message into note metadata."""
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    folders_json = json.dumps(input_data.available_folders, ensure_ascii=False)
    user_message = (
        f"Available folders: {folders_json}\n\nMessage: {input_data.raw_message}"
    )

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        logger.info(
            "Intake agent token usage — input: %d, output: %d",
            response.usage.input_tokens,
            response.usage.output_tokens,
        )

        raw = response.content[0].text.strip()
        # Strip markdown code fences if Claude wraps the response
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        parsed = json.loads(raw)
        return IntakeOutput.model_validate(parsed)

    except Exception as exc:
        logger.error("Intake agent failed: %s. Falling back to defaults.", exc)
        # Graceful fallback: save with a truncated title, no folder
        title = input_data.raw_message[:60].strip()
        return IntakeOutput(
            title=title or "Untitled",
            content=input_data.raw_message,
            folder_id=None,
        )

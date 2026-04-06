"""Cleanup agent — rewrites raw note content into clean markdown."""

import logging
import os

import anthropic

from app.models import CleanupInput, CleanupOutput

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-5"
MAX_TOKENS = 4096

SYSTEM_PROMPT = """\
You are a careful editor. Your job is to reformat raw note content into clean, \
well-structured markdown.

Rules:
- Fix formatting, punctuation, and structure — do NOT change the meaning.
- Use markdown headings, bullet lists, code blocks, and bold text where appropriate.
- Preserve ALL factual content — never summarise or omit anything.
- The input may be in German, English, or both — keep the original language(s).
- Return ONLY the cleaned markdown. No JSON wrapper, no preamble, no commentary.
"""


async def run_cleanup_agent(input_data: CleanupInput) -> CleanupOutput:
    """Call Claude to reformat raw note content into clean markdown."""
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    user_message = (
        f"Note title: {input_data.title}\n\n" f"Raw content:\n{input_data.raw_content}"
    )

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        logger.info(
            "Cleanup agent token usage — input: %d, output: %d",
            response.usage.input_tokens,
            response.usage.output_tokens,
        )

        cleaned = response.content[0].text.strip()
        return CleanupOutput(cleaned_content=cleaned)

    except Exception as exc:
        logger.error("Cleanup agent failed: %s. Leaving content as-is.", exc)
        return CleanupOutput(cleaned_content=input_data.raw_content)

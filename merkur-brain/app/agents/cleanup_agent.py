"""Cleanup agent — rewrites raw note content into clean markdown."""

import logging
import os
import re

import anthropic

from app.models import CleanupInput, CleanupOutput

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-5"
MAX_TOKENS = 4096

# Images without an explicit width get this default (px).
# Slightly narrower than the default content column (672 px) so there's breathing room.
_DEFAULT_IMAGE_WIDTH = 600

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
        f"Note title: {input_data.title}\n\nRaw content:\n{input_data.raw_content}"
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
        return CleanupOutput(cleaned_content=_normalise_image_widths(cleaned))

    except Exception as exc:
        logger.error("Cleanup agent failed: %s. Leaving content as-is.", exc)
        return CleanupOutput(
            cleaned_content=_normalise_image_widths(input_data.raw_content)
        )


def _normalise_image_widths(content: str) -> str:
    """Convert bare markdown images to <img width="N"> so the width persists.

    - ![alt](url)             → <img src="url" alt="alt" width="600" />
    - <img ... width="N" ...> → left unchanged (already sized)
    - <img ... no width ...>  → width="600" injected
    """

    # 1. Tag any <img> that lacks a width attribute
    def _add_width_to_img(m: re.Match) -> str:
        tag = m.group(0)
        if "width=" in tag:
            return tag
        # Insert width before the closing /> or >
        return re.sub(r"\s*/?>$", f' width="{_DEFAULT_IMAGE_WIDTH}" />', tag)

    content = re.sub(r"<img\b[^>]*>", _add_width_to_img, content)

    # 2. Convert bare markdown image syntax that survived the AI pass
    def _md_to_img(m: re.Match) -> str:
        alt = m.group(1)
        src = m.group(2)
        alt_attr = f' alt="{alt}"' if alt else ""
        return f'<img src="{src}"{alt_attr} width="{_DEFAULT_IMAGE_WIDTH}" />'

    content = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", _md_to_img, content)

    return content

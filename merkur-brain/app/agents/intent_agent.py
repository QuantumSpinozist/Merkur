"""Intent agent — interprets a free-text user instruction and returns a typed action."""

import json
import logging
import os
from datetime import date

import anthropic

from app.models import IntentAction, IntentInput

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-5"
MAX_TOKENS = 512

SYSTEM_PROMPT = """\
You are the command interpreter for a personal knowledge assistant called Merkur.
The user has sent a free-text instruction (prefixed with "/") instead of a structured
command. Your job is to understand what they want and return a JSON action object.

Available actions:
1. create_todo   — user wants to add a todo item
2. create_note   — user wants to save a note
3. list_todos    — user wants to see their pending todos
4. complete_todo — user wants to check off / mark a todo as done
5. create_folder — user wants to create a new folder
6. unknown       — you cannot determine the intent

Output rules:
- Return valid JSON only — no markdown fences, no explanation.
- Today's date is {today}.
- The user writes in German and English — handle both.

For create_todo:
  "todo_text": the todo item text (required)
  "todo_recurrence": "daily" | "weekly" | "monthly" | null
  "todo_due_date": "YYYY-MM-DD" | null
  "todo_note_query": "FolderName/NoteName" | "NoteName" | null
    — derive from folder/note references in the instruction, using the folders list.
    — if the user says e.g. "codepractice/todo" or "in my work todos", set this field.
    — use null if they don't mention a specific note.

For create_note:
  "note_title": short title (≤ 60 chars), inferred from content (required)
  "note_content": the note body (required)
  "note_folder_id": UUID from the available folders list, or null

For create_folder:
  "folder_name": the name of the folder to create (required)
  "folder_parent_name": name of the parent folder if nesting is requested, else null

For complete_todo:
  "todo_number": the 1-based position the user refers to (e.g. "done with #3" → 3).
    If the user says "done" or "check off" without a number, use 1 as a best guess
    and set "reply" asking them to confirm. If they clearly name a number, use it.

For unknown:
  "reply": a short, helpful message explaining what you couldn't understand.

Available folders: {folders_json}

Output format examples:
{{"action": "create_todo", "todo_text": "Practice SQL", "todo_recurrence": "daily", \
"todo_due_date": null, "todo_note_query": "codepractice/todo"}}
{{"action": "create_note", "note_title": "Meeting Summary", "note_content": "...", \
"note_folder_id": null}}
{{"action": "list_todos"}}
{{"action": "complete_todo", "todo_number": 3}}
{{"action": "create_folder", "folder_name": "Books", "folder_parent_name": null}}
{{"action": "create_folder", "folder_name": "Fiction", "folder_parent_name": "Books"}}

{{"action": "unknown", "reply": "I didn't understand that. Try /help."}}
"""


async def run_intent_agent(input_data: IntentInput) -> IntentAction:
    """Call Claude to interpret a free-text instruction into a typed action."""
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    folders_json = json.dumps(input_data.available_folders, ensure_ascii=False)
    system = SYSTEM_PROMPT.format(
        today=date.today().isoformat(),
        folders_json=folders_json,
    )

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system,
            messages=[{"role": "user", "content": input_data.text}],
        )
        logger.info(
            "Intent agent token usage — input: %d, output: %d",
            response.usage.input_tokens,
            response.usage.output_tokens,
        )

        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        parsed = json.loads(raw)
        return IntentAction.model_validate(parsed)

    except Exception as exc:
        logger.error("Intent agent failed: %s", exc)
        return IntentAction(
            action="unknown",
            reply="Sorry, I couldn't interpret that. Try /help for available commands.",
        )

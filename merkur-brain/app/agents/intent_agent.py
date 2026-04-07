"""Intent agent — interprets a free-text user instruction and returns a typed action."""

import json
import logging
import os
from datetime import date

import anthropic

from app.models import IntentAction, IntentInput

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-5"
MAX_TOKENS = 768

SYSTEM_PROMPT = """\
You are the command interpreter for a personal knowledge assistant called Merkur.
The user sends free-text instructions and you return a JSON action object.

Available actions:
1. create_note   — create a brand-new note
2. append_note   — add content to an existing note
3. create_todo   — add a new todo item
4. update_todo   — change the text, due date, or recurrence of an existing todo
5. list_todos    — show all pending todos
6. complete_todo — mark a todo as done
7. create_folder — create a new folder
8. unknown       — cannot determine intent

Output rules:
- Return valid JSON only — no markdown fences, no explanation.
- Today's date is {today}.
- The user writes in German and English — handle both.

--- Action field reference ---

append_note  (user says: "add to", "ergänze", "update my X note", "schreib in")
  "note_query":   "FolderName/NoteName" | "NoteName" — target note (required)
  "note_content": the text to append (required)

create_note
  "note_title":     short title ≤ 60 chars (required)
  "note_content":   note body (required)
  "note_folder_id": UUID from folders list, or null

create_todo
  "todo_text":       todo item text (required)
  "todo_note_query": "FolderName/NoteName" | "NoteName" | null
  "todo_due_date":   "YYYY-MM-DD" | null
  "todo_recurrence": "daily" | "weekly" | "monthly" | null

update_todo  (user says: "change todo #N to", "verschiebe todo #N auf", etc.)
  "todo_number":     1-based position in the pending list (required)
  "todo_text":       new text, or null to leave unchanged
  "todo_due_date":   new due date, or null to leave unchanged
  "todo_recurrence": new recurrence, or null to leave unchanged

complete_todo
  "todo_number": 1-based position (required; guess 1 if unclear and set "reply")

create_folder
  "folder_name":       name (required)
  "folder_parent_name": parent folder name, or null

unknown
  "reply": short helpful message

Available folders: {folders_json}

--- Examples ---
{{"action": "append_note", "note_query": "Projects/Coding ideas", \
"note_content": "- New idea: build a CLI pomodoro timer in Rust"}}
{{"action": "append_note", "note_query": "Einkaufsliste", \
"note_content": "- Milch\\n- Brot"}}
{{"action": "create_note", "note_title": "Meeting notes", \
"note_content": "...", "note_folder_id": null}}
{{"action": "create_todo", "todo_text": "Practice SQL", \
"todo_recurrence": "daily", "todo_due_date": null, \
"todo_note_query": "codepractice/todo"}}
{{"action": "update_todo", "todo_number": 2, \
"todo_text": null, "todo_due_date": "2026-04-15", "todo_recurrence": null}}
{{"action": "complete_todo", "todo_number": 3}}
{{"action": "list_todos"}}
{{"action": "create_folder", "folder_name": "Books", "folder_parent_name": null}}
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

"""Telegram webhook router — POST /webhook/telegram."""

import logging
import os
import re
from datetime import date

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from app.agents.cleanup_agent import run_cleanup_agent
from app.agents.intake_agent import run_intake_agent
from app.agents.intent_agent import run_intent_agent
from app.agents.query_agent import run_query_agent
from app.models import (
    CleanupInput,
    IntakeInput,
    IntentInput,
    QueryInput,
    TelegramMessage,
    TelegramUpdate,
)
from app.services import notes as notes_service
from app.services import scheduler as scheduler_service
from app.services import settings as settings_service
from app.services import telegram as tg_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook/telegram", tags=["telegram"])

HELP_TEXT = """\
🪐 *Merkur* — your personal knowledge OS

Just send me any message and I'll save it as a note.

*Commands:*
/note <text> — save a note (optional: title:"My Title")
/show <title> — fetch and display a note by title
/ask <question> — ask a question answered from your notes
/todo <text> — add a todo
  Optional flags: due:YYYY-MM-DD repeat:daily|weekly|monthly note:"Title"
  Folder scope: note:"Folder/Title" or note:Folder/Title
  Example: /todo Submit report due:2024-04-10 note:"Work/Meeting Notes"
/todo list — list all pending todos (numbered)
/done <number> — check off todo by its number in the list
/remind HH:MM — set daily reminder time (e.g. /remind 09:00)
/remind off — disable reminders
/remind status — show current reminder setting
/help — show this message\
"""

WELCOME_TEXT = """\
👋 Welcome to Merkur!

Send me anything — a thought, a link, a reminder — and I'll save it as a note.

Type /help to see all commands.\
"""

UNKNOWN_COMMAND_TEXT = "Unknown command. Type /help to see what I can do."


@router.post("")
async def receive_update(request: Request, background_tasks: BackgroundTasks) -> dict:
    """Handle inbound Telegram updates.

    Always returns HTTP 200 — Telegram will retry on any other status code.
    """
    _verify_secret(request.headers.get("X-Telegram-Bot-Api-Secret-Token", ""))

    try:
        update = TelegramUpdate.model_validate(await request.json())
    except Exception as exc:
        logger.error("Failed to parse Telegram update: %s", exc)
        return {"ok": True}

    message = _extract_text_message(update)
    if message is None:
        logger.info("Non-text or empty Telegram update. Ignoring.")
        return {"ok": True}

    chat_id = message.chat.id
    text = message.text or ""

    # Always persist chat_id so the scheduler knows where to send reminders
    background_tasks.add_task(
        settings_service.set_setting, "reminder_chat_id", str(chat_id)
    )

    # --- Command dispatch ---
    if text.startswith("/"):
        await _handle_command(text, chat_id, background_tasks)
        return {"ok": True}

    # --- Plain text → save as note ---
    await _save_note(text, chat_id, background_tasks)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Command handlers
# ---------------------------------------------------------------------------


async def _handle_command(
    text: str, chat_id: int, background_tasks: BackgroundTasks
) -> None:
    command, _, arg = text.partition(" ")
    command = command.lower().split("@")[0]  # strip bot username if present

    if command in ("/start",):
        background_tasks.add_task(
            tg_service.send_message, chat_id=chat_id, text=WELCOME_TEXT
        )

    elif command == "/help":
        background_tasks.add_task(
            tg_service.send_message, chat_id=chat_id, text=HELP_TEXT
        )

    elif command == "/note":
        if not arg.strip():
            background_tasks.add_task(
                tg_service.send_message,
                chat_id=chat_id,
                text='Usage: /note <text> [title:"My Title"]',
            )
        else:
            content, forced_title = _parse_note_flags(arg.strip())
            await _save_note(
                content, chat_id, background_tasks, forced_title=forced_title
            )

    elif command == "/show":
        if not arg.strip():
            background_tasks.add_task(
                tg_service.send_message,
                chat_id=chat_id,
                text="Usage: /show <note title>",
            )
        else:
            await _handle_show_note(arg.strip(), chat_id, background_tasks)

    elif command == "/ask":
        if not arg.strip():
            background_tasks.add_task(
                tg_service.send_message,
                chat_id=chat_id,
                text="Usage: /ask <your question>",
            )
        else:
            await _handle_ask_notes(arg.strip(), chat_id, background_tasks)

    elif command == "/todo":
        await _handle_todo(arg.strip(), chat_id, background_tasks)

    elif command == "/remind":
        await _handle_remind(arg.strip(), chat_id, background_tasks)

    elif command == "/done":
        await _handle_done(arg.strip(), chat_id, background_tasks)

    else:
        # Free-text instruction prefixed with "/" — route to intent agent
        await _handle_intent(text[1:].strip(), chat_id, background_tasks)


async def _handle_todo(
    arg: str, chat_id: int, background_tasks: BackgroundTasks
) -> None:
    """Handle /todo command: create a todo or list pending todos."""
    if arg.lower() == "list":
        await _send_todo_list(chat_id, background_tasks)
        return

    if not arg:
        background_tasks.add_task(
            tg_service.send_message,
            chat_id=chat_id,
            text="Usage: /todo <text> [due:YYYY-MM-DD] [repeat:daily|weekly|monthly]",
        )
        return

    todo_text, due_date, recurrence, note_query = _parse_todo_flags(arg)
    if not todo_text:
        background_tasks.add_task(
            tg_service.send_message,
            chat_id=chat_id,
            text="Please provide some text for the todo.",
        )
        return

    try:
        if note_query:
            if "/" in note_query:
                folder_part, _, title_part = note_query.partition("/")
                note = await notes_service.find_note_by_title(
                    title_part.strip(), folder_query=folder_part.strip()
                )
            else:
                note = await notes_service.find_note_by_title(note_query)
            if note is None:
                background_tasks.add_task(
                    tg_service.send_message,
                    chat_id=chat_id,
                    text=(
                        f'⚠️ No note found matching "{note_query}". '
                        "Check the title and try again."
                    ),
                )
                return
        else:
            note = await notes_service.get_or_create_telegram_todos_note()

        todo = await notes_service.create_todo(
            note_id=note.id,
            text=todo_text,
            due_date=due_date,
            recurrence=recurrence,
        )
    except Exception as exc:
        logger.error("Failed to create todo: %s", exc)
        background_tasks.add_task(
            tg_service.send_message,
            chat_id=chat_id,
            text="⚠️ Something went wrong saving the todo. Please try again.",
        )
        return

    parts = [f'✅ Added to *{note.title}*: "{todo.text}"']
    if todo.due_date:
        parts.append(f"due {todo.due_date}")
    if todo.recurrence:
        parts.append(f"repeats {todo.recurrence}")
    background_tasks.add_task(
        tg_service.send_message, chat_id=chat_id, text=" — ".join(parts)
    )


async def _handle_done(
    arg: str, chat_id: int, background_tasks: BackgroundTasks
) -> None:
    """Handle /done <number> — check off the Nth pending todo."""
    if not arg.isdigit():
        background_tasks.add_task(
            tg_service.send_message,
            chat_id=chat_id,
            text="Usage: /done <number>  (use /todo list to see the numbers)",
        )
        return

    index = int(arg)
    try:
        todos = await notes_service.list_pending_todos()
    except Exception as exc:
        logger.error("Failed to fetch todos for /done: %s", exc)
        background_tasks.add_task(
            tg_service.send_message, chat_id=chat_id, text="⚠️ Could not load todos."
        )
        return

    if index < 1 or index > len(todos):
        background_tasks.add_task(
            tg_service.send_message,
            chat_id=chat_id,
            text=f"No todo #{index}. Use /todo list to see the current list.",
        )
        return

    todo = todos[index - 1]
    try:
        await notes_service.mark_todo_done(todo.id)
    except Exception as exc:
        logger.error("Failed to mark todo %s done: %s", todo.id, exc)
        background_tasks.add_task(
            tg_service.send_message,
            chat_id=chat_id,
            text="⚠️ Something went wrong. Please try again.",
        )
        return

    msg = f'✅ Done: "{todo.text}"'
    if todo.recurrence:
        msg += f"\n_Repeats {todo.recurrence} — will reset automatically._"
    background_tasks.add_task(tg_service.send_message, chat_id=chat_id, text=msg)


async def _send_todo_list(chat_id: int, background_tasks: BackgroundTasks) -> None:
    try:
        todos = await notes_service.list_pending_todos()
    except Exception as exc:
        logger.error("Failed to fetch todos: %s", exc)
        background_tasks.add_task(
            tg_service.send_message, chat_id=chat_id, text="⚠️ Could not load todos."
        )
        return

    if not todos:
        background_tasks.add_task(
            tg_service.send_message, chat_id=chat_id, text="🎉 No pending todos!"
        )
        return

    today = date.today()
    lines = [f"📋 *{len(todos)} pending todo{'s' if len(todos) != 1 else ''}:*\n"]
    current_group: str | None = None

    for i, todo in enumerate(todos, start=1):
        group = f"{todo.folder_name or 'Inbox'} / {todo.note_title}"
        if group != current_group:
            lines.append(f"*{group}*")
            current_group = group
        due = _due_label(todo.due_date, today)
        recurrence = f" _{todo.recurrence}_" if todo.recurrence else ""
        lines.append(f"  {i}. {todo.text}{due}{recurrence}")

    lines.append("\n_Reply /done <number> to check one off._")
    background_tasks.add_task(
        tg_service.send_message, chat_id=chat_id, text="\n".join(lines)
    )


async def _handle_remind(
    arg: str, chat_id: int, background_tasks: BackgroundTasks
) -> None:
    """Handle /remind command: configure or disable the daily reminder."""
    # Store the chat id for reminders
    await settings_service.set_setting("reminder_chat_id", str(chat_id))

    if arg.lower() == "off":
        await settings_service.set_setting("reminder_enabled", "false")
        scheduler_service.reschedule(None)
        background_tasks.add_task(
            tg_service.send_message,
            chat_id=chat_id,
            text="🔕 Daily reminders disabled.",
        )
        return

    if arg.lower() == "status":
        time_str = await settings_service.get_setting("reminder_time") or os.getenv(
            "REMINDER_TIME", "09:00"
        )
        enabled = (
            await settings_service.get_setting("reminder_enabled") or "true"
        ) == "true"
        status = (
            f"✅ Daily reminder at *{time_str}*" if enabled else "🔕 Reminders disabled"
        )
        background_tasks.add_task(tg_service.send_message, chat_id=chat_id, text=status)
        return

    # Expect HH:MM
    if not re.fullmatch(r"\d{1,2}:\d{2}", arg):
        background_tasks.add_task(
            tg_service.send_message,
            chat_id=chat_id,
            text="Usage: /remind HH:MM | /remind off | /remind status",
        )
        return

    await settings_service.set_setting("reminder_time", arg)
    await settings_service.set_setting("reminder_enabled", "true")
    scheduler_service.reschedule(arg)
    background_tasks.add_task(
        tg_service.send_message,
        chat_id=chat_id,
        text=f"⏰ Daily reminder set for *{arg}*.",
    )


async def _handle_intent(
    text: str, chat_id: int, background_tasks: BackgroundTasks
) -> None:
    """Route a free-text '/' instruction through the intent agent."""
    try:
        folders = await notes_service.list_folders()
        folder_list = [{"id": f.id, "name": f.name} for f in folders]
        action = await run_intent_agent(
            IntentInput(text=text, available_folders=folder_list)
        )
    except Exception as exc:
        logger.error("Intent agent error: %s", exc)
        background_tasks.add_task(
            tg_service.send_message,
            chat_id=chat_id,
            text="⚠️ Something went wrong interpreting that. Try /help.",
        )
        return

    if action.action == "query_note":
        if not action.note_query:
            background_tasks.add_task(
                tg_service.send_message,
                chat_id=chat_id,
                text="Which note? Please name it more specifically.",
            )
            return
        await _handle_show_note(action.note_query, chat_id, background_tasks)

    elif action.action == "query_notes":
        question = action.user_question or text
        await _handle_ask_notes(question, chat_id, background_tasks)

    elif action.action == "create_todo":
        if not action.todo_text:
            background_tasks.add_task(
                tg_service.send_message,
                chat_id=chat_id,
                text=(
                    "I understood you want a todo but couldn't extract the text. "
                    "Please be more specific."
                ),
            )
            return
        try:
            if action.todo_note_query:
                if "/" in action.todo_note_query:
                    folder_part, _, title_part = action.todo_note_query.partition("/")
                    note = await notes_service.find_note_by_title(
                        title_part.strip(), folder_query=folder_part.strip()
                    )
                else:
                    note = await notes_service.find_note_by_title(
                        action.todo_note_query
                    )
                if note is None:
                    background_tasks.add_task(
                        tg_service.send_message,
                        chat_id=chat_id,
                        text=(
                            f'⚠️ No note found matching "{action.todo_note_query}". '
                            "Check the title and try again."
                        ),
                    )
                    return
            else:
                note = await notes_service.get_or_create_telegram_todos_note()

            todo = await notes_service.create_todo(
                note_id=note.id,
                text=action.todo_text,
                due_date=action.todo_due_date,
                recurrence=action.todo_recurrence,
            )
        except Exception as exc:
            logger.error("Intent: failed to create todo: %s", exc)
            background_tasks.add_task(
                tg_service.send_message,
                chat_id=chat_id,
                text="⚠️ Something went wrong saving the todo.",
            )
            return

        parts = [f'✅ Added to *{note.title}*: "{todo.text}"']
        if todo.due_date:
            parts.append(f"due {todo.due_date}")
        if todo.recurrence:
            parts.append(f"repeats {todo.recurrence}")
        background_tasks.add_task(
            tg_service.send_message, chat_id=chat_id, text=" — ".join(parts)
        )

    elif action.action == "append_note":
        if not action.note_query or not action.note_content:
            background_tasks.add_task(
                tg_service.send_message,
                chat_id=chat_id,
                text=(
                    "I understood you want to add to a note but couldn't "
                    "identify which note or what to add. Please be more specific."
                ),
            )
            return
        try:
            if "/" in action.note_query:
                folder_part, _, title_part = action.note_query.partition("/")
                note = await notes_service.find_note_by_title(
                    title_part.strip(), folder_query=folder_part.strip()
                )
            else:
                note = await notes_service.find_note_by_title(action.note_query)
            if note is None:
                background_tasks.add_task(
                    tg_service.send_message,
                    chat_id=chat_id,
                    text=(
                        f'⚠️ No note found matching "{action.note_query}". '
                        "Check the title and try again."
                    ),
                )
                return
            note = await notes_service.append_note_content(note.id, action.note_content)
        except Exception as exc:
            logger.error("Intent: failed to append to note: %s", exc)
            background_tasks.add_task(
                tg_service.send_message,
                chat_id=chat_id,
                text="⚠️ Something went wrong updating the note.",
            )
            return
        background_tasks.add_task(
            tg_service.send_message,
            chat_id=chat_id,
            text=f"📝 Added to *{note.title}*.",
        )

    elif action.action == "create_note":
        await _save_note(
            action.note_content or text,
            chat_id,
            background_tasks,
            forced_title=action.note_title,
        )

    elif action.action == "update_todo":
        number = action.todo_number
        if not number:
            background_tasks.add_task(
                tg_service.send_message,
                chat_id=chat_id,
                text="Which todo? Use /todo list for numbers, then specify the change.",
            )
            return
        try:
            todos = await notes_service.list_pending_todos()
        except Exception as exc:
            logger.error("Intent: failed to fetch todos for update: %s", exc)
            background_tasks.add_task(
                tg_service.send_message,
                chat_id=chat_id,
                text="⚠️ Could not load todos.",
            )
            return
        if number < 1 or number > len(todos):
            background_tasks.add_task(
                tg_service.send_message,
                chat_id=chat_id,
                text=f"No todo #{number}. Use /todo list to see the current list.",
            )
            return
        todo = todos[number - 1]
        try:
            await notes_service.update_todo_fields(
                todo_id=todo.id,
                text=action.todo_text,
                due_date=action.todo_due_date,
                recurrence=action.todo_recurrence,
            )
        except Exception as exc:
            logger.error("Intent: failed to update todo: %s", exc)
            background_tasks.add_task(
                tg_service.send_message,
                chat_id=chat_id,
                text="⚠️ Something went wrong updating the todo.",
            )
            return
        updated_text = action.todo_text or todo.text
        background_tasks.add_task(
            tg_service.send_message,
            chat_id=chat_id,
            text=f'✏️ Updated todo #{number}: "{updated_text}"',
        )

    elif action.action == "list_todos":
        await _send_todo_list(chat_id, background_tasks)

    elif action.action == "create_folder":
        if not action.folder_name:
            background_tasks.add_task(
                tg_service.send_message,
                chat_id=chat_id,
                text=(
                    "I understood you want a folder but couldn't get the name. "
                    "Please be more specific."
                ),
            )
            return
        try:
            folder = await notes_service.create_folder(
                name=action.folder_name,
                parent_name=action.folder_parent_name,
            )
        except Exception as exc:
            logger.error("Intent: failed to create folder: %s", exc)
            background_tasks.add_task(
                tg_service.send_message,
                chat_id=chat_id,
                text="⚠️ Something went wrong creating the folder.",
            )
            return

        if folder.parent_id:
            msg = f"📁 Created sub-folder *{folder.name}*."
        else:
            msg = f"📁 Created folder *{folder.name}*."
        background_tasks.add_task(tg_service.send_message, chat_id=chat_id, text=msg)

    elif action.action == "complete_todo":
        number = action.todo_number
        if not number:
            background_tasks.add_task(
                tg_service.send_message,
                chat_id=chat_id,
                text="Which todo? Use /todo list for numbers, then /done <number>.",
            )
            return
        await _handle_done(str(number), chat_id, background_tasks)

    else:
        reply = action.reply or "I didn't understand that. Try /help."
        background_tasks.add_task(tg_service.send_message, chat_id=chat_id, text=reply)


async def _handle_show_note(
    query: str, chat_id: int, background_tasks: BackgroundTasks
) -> None:
    """Fetch a note by title and send its content to the user."""
    if "/" in query:
        folder_part, _, title_part = query.partition("/")
        note = await notes_service.find_note_by_title(
            title_part.strip(), folder_query=folder_part.strip()
        )
    else:
        note = await notes_service.find_note_by_title(query)

    if note is None:
        background_tasks.add_task(
            tg_service.send_message,
            chat_id=chat_id,
            text=f'⚠️ No note found matching "{query}".',
        )
        return

    content = note.content or "_(empty note)_"
    # Telegram messages are capped at 4096 chars; truncate gracefully
    header = f"📄 *{note.title}*\n\n"
    limit = 4000 - len(header)
    if len(content) > limit:
        content = content[:limit] + "\n\n_… (truncated)_"
    background_tasks.add_task(
        tg_service.send_message, chat_id=chat_id, text=header + content
    )


async def _handle_ask_notes(
    question: str, chat_id: int, background_tasks: BackgroundTasks
) -> None:
    """Answer a natural-language question from the user's notes."""
    try:
        notes = await notes_service.list_all_notes_for_rag()
        result = await run_query_agent(QueryInput(question=question, notes=notes))
    except Exception as exc:
        logger.error("Query agent error in Telegram handler: %s", exc)
        background_tasks.add_task(
            tg_service.send_message,
            chat_id=chat_id,
            text="⚠️ Something went wrong answering that. Please try again.",
        )
        return
    background_tasks.add_task(
        tg_service.send_message, chat_id=chat_id, text=result.answer
    )


async def _save_note(
    text: str,
    chat_id: int,
    background_tasks: BackgroundTasks,
    forced_title: str | None = None,
) -> None:
    """Run intake agent, persist note, schedule cleanup, send confirmation."""
    try:
        folders = await notes_service.list_folders()
        folder_list = [{"id": f.id, "name": f.name} for f in folders]

        intake_output = await run_intake_agent(
            IntakeInput(raw_message=text, available_folders=folder_list)
        )

        note = await notes_service.create_note(
            title=forced_title or intake_output.title,
            content=intake_output.content,
            folder_id=intake_output.folder_id,
        )
    except Exception as exc:
        logger.error("Failed to create note from Telegram message: %s", exc)
        background_tasks.add_task(
            tg_service.send_message,
            chat_id=chat_id,
            text="⚠️ Something went wrong saving your note. Please try again.",
        )
        return

    background_tasks.add_task(
        _run_cleanup,
        note_id=note.id,
        raw_content=intake_output.content,
        title=note.title,
    )

    folder_name = _find_folder_name(folder_list, intake_output.folder_id)
    confirmation = f'✅ Saved to *{folder_name}*: "{note.title}"'
    background_tasks.add_task(
        tg_service.send_message, chat_id=chat_id, text=confirmation
    )


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _verify_secret(token_header: str) -> None:
    expected = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
    if not expected:
        return
    if token_header != expected:
        raise HTTPException(status_code=403, detail="Invalid secret token")


def _extract_text_message(update: TelegramUpdate) -> TelegramMessage | None:
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


def _parse_note_flags(text: str) -> tuple[str, str | None]:
    """Extract optional title: flag from note text. Returns (content, title).

    Supports: title:"My Title" or title:SingleWord
    """
    for pattern in (r'\btitle:"([^"]+)"', r"\btitle:(\S+)"):
        m = re.search(pattern, text)
        if m:
            title = m.group(1).strip()
            content = (text[: m.start()] + text[m.end() :]).strip()
            return content or text.strip(), title or None
    return text.strip(), None


def _parse_todo_flags(
    text: str,
) -> tuple[str, str | None, str | None, str | None]:
    """Extract flags. Returns (clean_text, due_date, recurrence, note_query).

    Supported flags:
      due:YYYY-MM-DD
      repeat:daily|weekly|monthly
      note:"Note Title" or note:SingleWord
    """
    due_match = re.search(r"\bdue:(\S+)", text)
    repeat_match = re.search(r"\brepeat:(\S+)", text)
    note_match = re.search(r'\bnote:"([^"]+)"', text) or re.search(
        r"\bnote:(\S+)", text
    )

    due_date = due_match.group(1) if due_match else None
    recurrence = repeat_match.group(1).lower() if repeat_match else None
    if recurrence not in ("daily", "weekly", "monthly"):
        recurrence = None
    note_query = note_match.group(1).strip() if note_match else None

    # Remove matched flag spans from the text (highest index first to preserve offsets)
    spans = sorted(
        [m.span() for m in [due_match, repeat_match, note_match] if m],
        reverse=True,
    )
    clean = text
    for start, end in spans:
        clean = clean[:start] + clean[end:]
    return clean.strip(), due_date, recurrence, note_query


def _due_label(due_date: str | None, today: date) -> str:
    if not due_date:
        return ""
    try:
        d = date.fromisoformat(due_date)
    except ValueError:
        return ""
    delta = (d - today).days
    if delta < 0:
        return " _(overdue!)_"
    if delta == 0:
        return " _(due today)_"
    if delta == 1:
        return " _(due tomorrow)_"
    return f" _(due {d.strftime('%b %-d')})_"


async def _run_cleanup(note_id: str, raw_content: str, title: str) -> None:
    try:
        result = await run_cleanup_agent(
            CleanupInput(raw_content=raw_content, title=title)
        )
        await notes_service.update_note_content(note_id, result.cleaned_content)
    except Exception as exc:
        logger.error("Cleanup background task failed for note %s: %s", note_id, exc)

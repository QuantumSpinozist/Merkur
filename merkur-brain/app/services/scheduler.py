"""APScheduler-based daily reminder job for pending todos."""

import logging
import os
from datetime import date

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.models import PendingTodo

logger = logging.getLogger(__name__)

_scheduler = AsyncIOScheduler()
_JOB_ID = "daily_reminder"


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------


async def start() -> None:
    """Load reminder config from settings/env and start the scheduler."""
    from app.services import settings as settings_svc

    time_str = await settings_svc.get_setting("reminder_time") or os.getenv(
        "REMINDER_TIME", "09:00"
    )
    enabled_str = await settings_svc.get_setting("reminder_enabled") or "true"

    if enabled_str == "true" and time_str:
        _apply_job(time_str)

    _scheduler.start()
    logger.info("Scheduler started (reminder=%s, enabled=%s).", time_str, enabled_str)


async def stop() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)


def reschedule(time_str: str | None) -> None:
    """Reschedule the reminder job. Pass None to remove it."""
    if _scheduler.get_job(_JOB_ID):
        _scheduler.remove_job(_JOB_ID)
    if time_str:
        _apply_job(time_str)
        logger.info("Reminder rescheduled for %s.", time_str)
    else:
        logger.info("Reminder disabled.")


def _apply_job(time_str: str) -> None:
    hour, _, minute = time_str.partition(":")
    _scheduler.add_job(
        send_daily_reminder,
        CronTrigger(hour=int(hour), minute=int(minute or "0")),
        id=_JOB_ID,
        replace_existing=True,
    )


# ---------------------------------------------------------------------------
# Reminder logic
# ---------------------------------------------------------------------------


async def send_daily_reminder() -> None:
    from app.services import notes as notes_svc
    from app.services import settings as settings_svc
    from app.services import telegram as tg_svc

    chat_id_str = await settings_svc.get_setting("reminder_chat_id") or os.getenv(
        "REMINDER_CHAT_ID", ""
    )
    if not chat_id_str:
        logger.warning("Reminder: no chat_id configured — skipping.")
        return

    todos = await notes_svc.list_pending_todos()
    if not todos:
        logger.info("Reminder: no pending todos — skipping.")
        return

    text = _format_reminder(todos)
    await tg_svc.send_message(chat_id=int(chat_id_str), text=text)
    logger.info("Daily reminder sent (%d todos).", len(todos))


def _format_reminder(todos: list[PendingTodo]) -> str:
    today = date.today()

    # Group by folder → note
    groups: dict[str, dict[str, list[PendingTodo]]] = {}
    for todo in todos:
        folder = todo.folder_name or "Inbox"
        note = todo.note_title
        groups.setdefault(folder, {}).setdefault(note, []).append(todo)

    lines = ["🔔 *Daily reminder* — your pending todos:\n"]
    for folder_name in sorted(groups):
        for note_title, note_todos in sorted(groups[folder_name].items()):
            lines.append(f"*{folder_name} / {note_title}*")
            for todo in note_todos:
                suffix = _due_suffix(todo.due_date, today)
                recurrence = f" _{todo.recurrence}_" if todo.recurrence else ""
                lines.append(f"  ☐ {todo.text}{suffix}{recurrence}")
            lines.append("")

    total = len(todos)
    lines.append(f"_{total} todo{'s' if total != 1 else ''} pending._")
    return "\n".join(lines)


def _due_suffix(due_date: str | None, today: date) -> str:
    if not due_date:
        return ""
    d = date.fromisoformat(due_date)
    delta = (d - today).days
    if delta < 0:
        return " _(overdue!)_"
    if delta == 0:
        return " _(due today)_"
    if delta == 1:
        return " _(due tomorrow)_"
    return f" _(due {d.strftime('%b %-d')})_"

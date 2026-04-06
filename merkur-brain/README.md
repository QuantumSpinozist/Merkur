# merkur-brain

FastAPI backend for Merkur — Telegram webhook receiver, AI agents, and scheduled reminders.

## What it does

- Receives Telegram messages via webhook and routes them to the right handler
- **Intake agent**: parses raw messages → infers title + folder → creates a note in Supabase
- **Cleanup agent**: rewrites raw note content into clean markdown (runs async, non-blocking)
- **Intent agent**: interprets free-text `/` instructions via LLM → dispatches to the right action
- Manages todos: create, list, check off, recurrence tracking
- Sends configurable daily reminders for pending todos via Telegram

## Telegram commands

| Command | Description |
|---|---|
| `/note <text> [title:"..."]` | Save a note; optional `title:` flag overrides the AI-inferred title |
| `/todo <text> [due:YYYY-MM-DD] [repeat:daily\|weekly\|monthly] [note:Folder/Title]` | Add a todo |
| `/done <number>` | Check off todo by its position in the pending list |
| `/remind HH:MM \| off \| status` | Set, disable, or check the daily reminder time |
| `/ <free text>` | Natural language instruction — interpreted by the intent agent |
| `/help` | Show available commands |

## Stack

- **FastAPI** + Uvicorn
- **supabase-py** — shared Supabase database
- **anthropic** Python SDK — all AI calls live in `agents/`
- **APScheduler** — daily reminder cron job
- **httpx** — outbound Telegram API calls

## Running locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in all keys
uvicorn app.main:app --reload --port 8000
```

### Environment variables

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=   # optional but recommended
BRAIN_ENV=development
```

### Registering the Telegram webhook

```bash
# Use ngrok for local testing
ngrok http 8000
curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://<ngrok-id>.ngrok.io/webhook/telegram&secret_token={SECRET}"

# Production
curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://merkur-brain.railway.app/webhook/telegram&secret_token={SECRET}"
```

## Project structure

```
app/
├── main.py                  # FastAPI entry point + lifespan (scheduler, bot commands)
├── routers/
│   └── telegram.py          # POST /webhook/telegram — command routing
├── agents/
│   ├── intake_agent.py      # Raw message → note title + folder_id
│   ├── cleanup_agent.py     # Raw content → clean markdown
│   └── intent_agent.py      # Free-text instruction → typed action
├── services/
│   ├── notes.py             # All Supabase read/write (notes, folders, todos)
│   ├── settings.py          # Key-value settings table helpers
│   ├── scheduler.py         # APScheduler daily reminder job
│   └── telegram.py          # Outbound Telegram message sender
└── models.py                # All Pydantic models
```

## Tests

```bash
pytest tests/unit/           # fast, all mocked — run in pre-commit
pytest tests/integration/    # requires live Supabase + APIs — CI only
```

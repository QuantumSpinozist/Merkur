# merkur-brain

FastAPI backend for Merkur — Telegram webhook receiver, AI agents, scheduled reminders, and a small HTTP API consumed by `merkur-web`.

## What it does

- Receives Telegram (and WhatsApp) messages via webhook and routes them to the right handler
- **Intake agent**: parses raw messages → infers title + folder → creates a note in Supabase
- **Cleanup agent**: rewrites raw note content into clean markdown (runs async, non-blocking); normalises image widths post-AI
- **Intent agent**: interprets free-text `/` instructions via LLM → dispatches to the right action
- **Query agent**: RAG-style question answering grounded in all user notes (up to 100, most recently updated)
- Manages todos: create, list, check off, recurrence tracking
- Sends configurable daily reminders for pending todos via Telegram
- Handles photo messages: downloads from Telegram CDN, uploads to Supabase Storage, embeds in note content
- Exposes `POST /cleanup` and `POST /query` HTTP endpoints consumed by `merkur-web`

## Telegram commands

| Command | Description |
|---|---|
| `/note <text> [title:"..."]` | Save a note; optional `title:` flag overrides the AI-inferred title |
| `/show <title>` | Fetch and display a note by title |
| `/ask <question>` | Answer a question from your notes using RAG |
| `/todo <text> [due:YYYY-MM-DD] [repeat:daily\|weekly\|monthly] [note:Folder/Title]` | Add a todo |
| `/done <number>` | Check off todo by its position in the pending list |
| `/remind HH:MM \| off \| status` | Set, disable, or check the daily reminder time |
| `/ <free text>` | Natural language instruction — interpreted by the intent agent |
| `/help` | Show available commands |

Sending a **photo** (with or without a caption) always saves a note with the image embedded. A `/note` caption on a photo is also supported.

## HTTP API (consumed by merkur-web)

| Method | Path | Description |
|---|---|---|
| `POST` | `/cleanup` | Run cleanup agent on a note and persist the result |
| `POST` | `/query` | Answer a natural-language question from all notes |
| `GET` | `/health` | Liveness check |

Both endpoints require `X-Brain-Secret` header when `BRAIN_SECRET` env var is set.

## Stack

- **FastAPI** + Uvicorn
- **supabase-py** — shared Supabase database + Storage
- **anthropic** Python SDK — all AI calls live in `agents/`
- **APScheduler** — daily reminder cron job
- **httpx** — outbound Telegram and WhatsApp API calls

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
BRAIN_SECRET=              # shared with merkur-web to authenticate /cleanup and /query
BRAIN_ENV=development      # or production
REMINDER_TIME=09:00        # default daily reminder time (HH:MM)

# WhatsApp (optional)
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
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
│   ├── telegram.py          # POST /webhook/telegram — full command + photo routing
│   ├── whatsapp.py          # GET/POST /webhook/whatsapp — basic text notes
│   ├── cleanup.py           # POST /cleanup — called by merkur-web
│   └── query.py             # POST /query — called by merkur-web
├── agents/
│   ├── intake_agent.py      # Raw message → note title + folder_id
│   ├── cleanup_agent.py     # Raw content → clean markdown + image normalisation
│   ├── intent_agent.py      # Free-text instruction → typed IntentAction
│   └── query_agent.py       # RAG question answering over all notes
├── services/
│   ├── notes.py             # All Supabase read/write (notes, folders, todos)
│   ├── settings.py          # Key-value settings table helpers
│   ├── scheduler.py         # APScheduler daily reminder job
│   ├── storage.py           # Supabase Storage upload (Telegram photos)
│   ├── telegram.py          # Outbound Telegram messages + file download
│   └── whatsapp.py          # Outbound WhatsApp messages
└── models.py                # All Pydantic models
```

## Tests

```bash
pytest tests/unit/           # fast, all mocked — run in pre-commit
pytest tests/integration/    # requires live Supabase + APIs — CI only
```

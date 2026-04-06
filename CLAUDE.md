# CLAUDE.md — Merkur

This file is the source of truth for Claude when working on this codebase. Read it fully before making any changes.

---

## Project overview

**Merkur** is a personal knowledge OS: a markdown note-taking app with folder organisation, an AI cleanup/sorting layer, and a Telegram bot as the ambient capture interface. Built for a single user (the owner), self-hosted, designed to be cheap to run.

The name comes from the German word "merken" (to notice, to remember) — fitting for a tool whose job is to remember things for you.

**Core philosophy:**
- Capture first, organise later — raw input should be frictionless
- AI does the cleaning and sorting, not the user
- Telegram is the primary mobile input surface; the web app is for reading and editing
- Every feature should work without the AI layer (graceful degradation)

---

## Monorepo structure

Merkur is split into two services that share one Supabase database. They are decoupled — they never call each other directly.

```
merkur/
├── merkur-web/              # Next.js frontend + note CRUD (TypeScript)
├── merkur-brain/            # FastAPI backend: Telegram webhook + AI agents (Python)
├── supabase/
│   └── migrations/          # Shared SQL migrations (run once, owned by no single service)
├── .pre-commit-config.yaml  # Pre-commit hook definitions (all hooks)
├── pyproject.toml           # Ruff + mypy config (applies to merkur-brain)
├── .commitlintrc.json       # Conventional commit message rules
└── CLAUDE.md                # This file (root, applies to both services)
```

**Rule: never add a direct HTTP dependency between the two services.** They communicate exclusively through the database. `merkur-web` writes a note → `merkur-brain` reads it. Not the other way around via API call.

---

## Current build phase

**Phase: MVP**

Only build what is listed under MVP scope. Do not implement extension features unless explicitly asked. Do not add abstractions for features that don't exist yet — but do structure the code so extensions are natural to add later (see Architecture principles).

### MVP scope
- [ ] Note editor (TipTap, markdown) — `merkur-web`
- [ ] Folder system (create, rename, delete, nest one level deep) — `merkur-web`
- [ ] Note CRUD (create, read, update, delete, move between folders) — `merkur-web`
- [ ] Basic auth (single user, magic link via Supabase) — `merkur-web`
- [ ] Telegram webhook receiver (inbound messages only) — `merkur-brain`
- [ ] Intake agent: parse Telegram message → create note with folder + title — `merkur-brain`
- [ ] Cleanup agent: reformat raw note content into clean markdown — `merkur-brain`

### Planned extensions (do not build yet)
- **Todos & habits:** todo lists, recurring habits, cross-off via Telegram, reminders — `merkur-brain`
- **Proactive reminders:** agent-initiated Telegram messages on a schedule — `merkur-brain`
- **Todo queries:** ask agent "what are my todos for today?" — `merkur-brain`
- **Calendar integration:** Google Calendar read/write — `merkur-brain`
- **Mobile app:** React Native or PWA enhancements — `merkur-web`
- **Semantic search:** pgvector-powered "find related notes" — `merkur-brain`
- **Multi-user / sharing**

---

## Tech stack

### merkur-web (TypeScript)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | |
| Editor | TipTap | MIT, no paid tier needed |
| Auth | Supabase Auth | Magic link, single user |
| Database client | `@supabase/ssr` | Server components + API routes only |
| Styling | Tailwind CSS | |
| Hosting | Vercel | Free tier |

### merkur-brain (Python)

| Layer | Choice | Notes |
|---|---|---|
| Framework | FastAPI | Async, clean, minimal |
| Database client | `supabase-py` | Talks to same Supabase project |
| AI | `anthropic` Python SDK | All AI calls live here |
| Telegram | Telegram Bot API | Handled entirely in this service |
| Server | Uvicorn | Via Railway or Fly.io (~$5/mo) |
| Task queue | `asyncio` background tasks | Sufficient for MVP; swap for Celery later if needed |

### Shared infrastructure

| Layer | Choice | Notes |
|---|---|---|
| Database | Supabase (Postgres) | Free tier for MVP |
| File storage | Supabase Storage | For attachments |

**Future additions (not yet in stack):**
- `pgvector` Supabase extension — semantic search, owned by `merkur-brain`
- Google Calendar API — owned by `merkur-brain`
- `APScheduler` — for reminders cron in `merkur-brain`

---

## Repository structure

### merkur-web

```
merkur-web/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (app)/
│   │   ├── layout.tsx              # Sidebar + auth guard
│   │   ├── page.tsx                # Redirect to first folder
│   │   ├── notes/
│   │   │   └── [noteId]/
│   │   │       └── page.tsx        # Note editor view
│   │   └── folders/
│   │       └── [folderId]/
│   │           └── page.tsx        # Folder note list
│   └── api/
│       ├── notes/
│       │   └── route.ts            # CRUD endpoints
│       └── folders/
│           └── route.ts            # CRUD endpoints
├── components/
│   ├── editor/
│   │   └── NoteEditor.tsx          # TipTap editor component
│   ├── sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── FolderTree.tsx
│   │   └── NoteList.tsx
│   └── ui/                         # Shared UI primitives
├── __tests__/
│   ├── unit/                       # Run in pre-commit (pure logic, no I/O)
│   │   ├── schemas.test.ts         # Zod schema validation
│   │   └── utils.test.ts           # Pure utility functions
│   └── integration/                # CI only
│       └── api.test.ts             # API route tests with mocked Supabase
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client
│   │   └── server.ts               # Server Supabase client
│   └── types.ts                    # Shared TypeScript types (keep in sync with DB)
├── .env.local
└── package.json
```

**Rules for merkur-web:**
- No AI calls. No Anthropic SDK. No Telegram calls. Ever.
- All Supabase calls from server components or API routes only — never from client components.
- `lib/types.ts` must stay in sync with the database schema.

### merkur-brain

```
merkur-brain/
├── app/
│   ├── main.py                     # FastAPI app entry point
│   ├── routers/
│   │   └── telegram.py             # POST /webhook/telegram
│   ├── agents/
│   │   ├── intake_agent.py         # Parse Telegram message → note metadata
│   │   └── cleanup_agent.py        # Reformat raw content → clean markdown
│   ├── services/
│   │   ├── telegram.py             # Outbound Telegram message sender
│   │   └── notes.py                # Supabase note/folder read+write helpers
│   └── models.py                   # Pydantic models (request/response shapes)
├── tests/
│   ├── unit/                       # Run in pre-commit (mocked, fast)
│   │   ├── test_intake_agent.py
│   │   ├── test_cleanup_agent.py
│   │   ├── test_telegram_webhook.py
│   │   └── test_models.py
│   └── integration/                # CI only — requires live Supabase + APIs
│       └── test_webhook_flow.py
├── .env
├── requirements.txt
└── Dockerfile
```

**Rules for merkur-brain:**
- No UI. No Next.js. No frontend concerns.
- All AI calls live in `agents/`. No `anthropic` SDK calls anywhere else.
- All DB access goes through `services/notes.py`. Routers never call Supabase directly.
- All agent inputs and outputs are validated Pydantic models.

---

## Database schema

Migrations live in `/supabase/migrations/`. Both services share this schema.

```sql
-- Folders
create table folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references folders(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Notes
create table notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled',
  content text,                          -- raw markdown
  folder_id uuid references folders(id) on delete set null,
  source text check (source in ('web', 'telegram')) default 'web',
  is_cleaned boolean default false,      -- whether cleanup agent has run
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Future tables (do not create yet, schema reserved for reference):
-- todos (id, note_id, text, done, due_date, recurrence, created_at)
-- reminders (id, note_id, todo_id, scheduled_at, sent_at, channel)
-- embeddings (id, note_id, embedding vector(1536), created_at)
```

**Migration convention:** one file per change, named `001_initial.sql`, `002_add_source_to_notes.sql`, etc. Never edit existing migration files.

---

## AI agents (merkur-brain)

All agents follow the same pattern: a function that takes a Pydantic model and returns a Pydantic model. No agent returns raw strings or dicts.

### Intake agent (`agents/intake_agent.py`)

Called when a Telegram message arrives. Parses the raw message and maps it to a folder.

**Input model:**
```python
class IntakeInput(BaseModel):
    raw_message: str
    available_folders: list[dict]  # [{"id": str, "name": str}]
```

**Output model:**
```python
class IntakeOutput(BaseModel):
    title: str             # short, inferred — max 60 chars
    content: str           # note body (may equal raw_message in MVP)
    folder_id: str | None  # matched folder id, or None = inbox
```

**System prompt principles:**
- Return only valid JSON, no preamble or markdown fences
- If no folder matches confidently, return `folder_id: null` — do not invent folders
- Keep titles short (≤60 chars)
- The user writes in German and English — handle both

### Cleanup agent (`agents/cleanup_agent.py`)

Called after a note is created (async, non-blocking). Rewrites raw content into clean markdown and updates the note in Supabase.

**Input model:**
```python
class CleanupInput(BaseModel):
    raw_content: str
    title: str
```

**Output model:**
```python
class CleanupOutput(BaseModel):
    cleaned_content: str   # valid markdown
```

**System prompt principles:**
- Fix formatting, punctuation, structure — do not change meaning
- Use markdown headings, lists, code blocks where appropriate
- Preserve all factual content — never summarise or omit
- Return only the cleaned markdown, no JSON wrapper, no preamble

### Both agents

- Use `claude-sonnet-4-5` model
- `max_tokens=1024` for intake, `max_tokens=4096` for cleanup
- Always wrap in `try/except` — on failure, save the note as-is and log the error
- Log token usage in development (`response.usage`)
- Parse AI JSON responses with Pydantic — never bare `json.loads()` without validation

---

## Telegram integration (merkur-brain)

### Webhook registration
No challenge handshake needed. Register the webhook once via the Bot API:
```
https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook?url=https://merkur-brain.railway.app/webhook/telegram&secret_token={TELEGRAM_WEBHOOK_SECRET}
```

### Message handling (`POST /webhook/telegram`)
1. Verify `X-Telegram-Bot-Api-Secret-Token` header if `TELEGRAM_WEBHOOK_SECRET` is set
2. Extract message text and `chat.id` from the Telegram Update payload
3. Ignore non-text messages (photos, stickers, etc.) for MVP — log and return `200 OK`
4. Call intake agent → write note to Supabase via `services/notes.py`
5. Fire cleanup agent as a FastAPI `BackgroundTask` — non-blocking
6. Send confirmation reply via `services/telegram.py`

**Always return HTTP 200**, even on errors — otherwise Telegram will retry aggressively.

**Confirmation message format:**
```
[Merkur] Saved to [Folder Name]: "[Note Title]"
```
If folder is inbox/null: `[Merkur] Saved to Inbox: "[Note Title]"`

### Outbound messages (`services/telegram.py`)
Thin wrapper around `POST /sendMessage`. Accepts `chat_id: int, text: str`. Used only for confirmations in MVP.

---

## Environment variables

### merkur-web (`.env.local`)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-side only, never expose to client

# App
NEXT_PUBLIC_APP_URL=              # e.g. https://merkur.vercel.app
```

### merkur-brain (`.env`)

```bash
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=        # brain always uses service role

# Anthropic
ANTHROPIC_API_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=               # from @BotFather
TELEGRAM_WEBHOOK_SECRET=          # any string you choose (optional but recommended)

# App
BRAIN_ENV=development             # or production
```

Never commit either env file. `ANTHROPIC_API_KEY` never appears in `merkur-web` at all.

---

## Architecture principles

1. **Two services, one database.** `merkur-web` and `merkur-brain` are decoupled. They share state only through Supabase. Neither calls the other over HTTP.

2. **Python for logic, TypeScript for UI.** All AI, Telegram, scheduling, and data processing lives in `merkur-brain`. All rendering, editing, and user interaction lives in `merkur-web`. When in doubt about where a feature belongs: if it involves AI or a third-party integration, it's `merkur-brain`; if it involves displaying or editing, it's `merkur-web`.

3. **Agent interface is stable.** Agents take Pydantic models and return Pydantic models. When new agents are added (todo agent, reminder agent), they follow the same pattern in `agents/`. No agent has side effects — side effects (writing to DB, sending Telegram messages) happen in the router or service layer that calls the agent.

4. **Notes are the core primitive.** Todos, habits, and calendar events will all attach to notes via foreign keys. Do not design features that bypass the notes table.

5. **Telegram handler is a router, not a monolith.** As features grow, the webhook handler should classify the message type first (`note`, `todo_completion`, `query`, etc.), then delegate to the right handler. Keep this pattern from day one even though MVP only has one message type.

6. **AI is always optional.** Every user action must work without AI. AI runs asynchronously and enhances — it never blocks a response.

7. **Folder depth is one level for MVP.** The schema supports unlimited nesting (`parent_id`), but the UI only renders one level deep. Do not add recursive rendering until explicitly requested.

---

## Code style

### merkur-web (TypeScript)
- Strict mode on
- Prefer `async/await` over `.then()` chains
- Use Zod for validating API request bodies
- No `any` types — use `unknown` and narrow explicitly
- Prefer named exports (except Next.js page/layout files)
- Error messages should be human-readable strings, not codes

### merkur-brain (Python)
- Python 3.11+
- Use Pydantic v2 for all data models and validation
- Type-annotate all function signatures
- `async def` for all route handlers and agent calls
- No bare `except:` — always catch specific exceptions or `Exception` with logging
- Use `python-dotenv` for env loading in development
- Error messages should be human-readable strings, not codes

---

## Pre-commit hooks

Pre-commit hooks run automatically on every `git commit`. They catch issues before they reach the repo. The config lives at the monorepo root in `.pre-commit-config.yaml`.

### Setup (run once after cloning)
```bash
pip install pre-commit
pre-commit install
pre-commit install --hook-type commit-msg   # for commitlint
```

### Hooks overview

| Hook | Scope | What it does |
|---|---|---|
| `ruff` | Python | Lints + auto-fixes imports, style, common errors |
| `ruff-format` | Python | Formats code (replaces Black) |
| `mypy` | Python | Static type checking |
| `pytest` | Python | Runs `merkur-brain` test suite |
| `eslint` | TypeScript | Lints TS/TSX files |
| `prettier` | TypeScript / JSON / MD | Formats all non-Python files |
| `tsc` | TypeScript | Type-checks `merkur-web` without emitting |
| `jest` | TypeScript | Runs `merkur-web` test suite |
| `detect-secrets` | Both | Blocks accidental secrets/API key commits |
| `commitlint` | Both | Enforces conventional commit message format |
| `check-added-large-files` | Both | Blocks files >500KB |
| `check-merge-conflict` | Both | Blocks unresolved merge conflict markers |
| `end-of-file-fixer` | Both | Ensures files end with a newline |
| `trailing-whitespace` | Both | Strips trailing whitespace |

### Test scope in pre-commit

Pre-commit runs a **fast subset** of tests only — the full suite runs in CI. The rule: if a test requires a live network call, a real Supabase connection, or the Telegram API, it is **not** a pre-commit test.

**merkur-brain (pytest):** only tests in `tests/unit/` run. These test agent parsing logic, Pydantic model validation, Telegram webhook handling, and message classification. All external calls (Anthropic API, Supabase) are mocked with `pytest-mock`.

**merkur-web (jest):** only tests in `__tests__/unit/` run. These test utility functions, Zod schemas, and any pure logic. No tests that mount React components with real data or call API routes.

Integration and end-to-end tests (`tests/integration/`, `cypress/`) run in CI only, never in pre-commit.

### Conventional commits

All commit messages must follow the format: `type(scope): description`

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`
**Scopes:** `web`, `brain`, `db`, `infra` (optional but encouraged)

Examples:
```
feat(brain): add intake agent for telegram messages
fix(web): correct folder delete not refreshing sidebar
chore(db): add 002 migration for is_cleaned column
docs: update running locally section in CLAUDE.md
```

### Skipping hooks (use sparingly)
```bash
git commit --no-verify -m "wip: ..."   # skips all hooks
SKIP=mypy git commit -m "..."          # skips a specific hook
SKIP=pytest git commit -m "..."        # skips tests only
```

### Testing conventions

**merkur-brain:**
- Use `pytest` with `pytest-asyncio` for async tests
- Mock all external calls with `pytest-mock` — never hit real APIs in unit tests
- Name test files `test_<module>.py`, test functions `test_<behaviour>`
- One assertion per test where possible — keep tests focused

**merkur-web:**
- Use `jest` with `ts-jest`
- Unit tests cover Zod schemas and pure utility functions only
- No `jsdom`, no component rendering in pre-commit tests — keep them dependency-free and instant

### Ruff configuration
Ruff is configured in `pyproject.toml` at the monorepo root. Key rules enabled beyond defaults: `I` (isort), `UP` (pyupgrade), `B` (flake8-bugbear), `SIM` (flake8-simplify).

### Mypy configuration
Also in `pyproject.toml`. Strict mode is on. If you add a new dependency without type stubs, add it to `[[tool.mypy.overrides]]` with `ignore_missing_imports = true`.

---

## Running locally

### merkur-web
```bash
cd merkur-web
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev                  # runs on http://localhost:3000
```

### merkur-brain
```bash
cd merkur-brain
python -m venv .venv
source .venv/bin/activate    # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env         # fill in all keys
uvicorn app.main:app --reload --port 8000
```

### Telegram webhook (local testing)
Use ngrok to expose `merkur-brain` locally, then register the webhook:
```bash
ngrok http 8000
# Register webhook with Telegram:
# curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://<ngrok-id>.ngrok.io/webhook/telegram&secret_token={SECRET}"
#
# Production webhook URL:
# https://merkur-brain.railway.app/webhook/telegram
```

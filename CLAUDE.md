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

**Rule: never add a direct HTTP dependency between the two services.** They communicate through the database *and* through a small versioned HTTP API (`merkur-brain` exposes `/cleanup` and `/query` consumed by `merkur-web`). `merkur-web` never writes to Supabase on behalf of `merkur-brain`, and `merkur-brain` never calls `merkur-web`.

---

## Current build phase

**Phase: active development (post-MVP)**

The MVP is complete. New features are added incrementally. Do not implement items from the "Planned extensions" list unless explicitly asked.

### Completed features
- [x] Note editor (TipTap, markdown, auto-save, adjustable content width) — `merkur-web`
- [x] Folder system (create, rename, delete, one level deep) — `merkur-web`
- [x] Note CRUD (create, read, update, delete, move between folders) — `merkur-web`
- [x] Basic auth (single user, magic link via Supabase) — `merkur-web`
- [x] Image support: upload (toolbar/paste/drag-drop), client-side resize, drag-to-resize in editor, persistent width — `merkur-web`
- [x] AI query bar in sidebar (`/api/query` → brain) — `merkur-web`
- [x] Telegram webhook receiver — `merkur-brain`
- [x] Intake agent: parse Telegram message → create note with folder + title — `merkur-brain`
- [x] Cleanup agent: reformat raw note content into clean markdown — `merkur-brain`
- [x] Intent agent: free-text `/` instructions → typed action dispatch — `merkur-brain`
- [x] Query agent: RAG-style question answering from all notes — `merkur-brain`
- [x] Telegram photo messages: download → Supabase Storage → embed in note — `merkur-brain`
- [x] Todos: create, list, check off, recurrence, due dates — `merkur-web` + `merkur-brain`
- [x] Aggregated todos view — `merkur-web`
- [x] Daily reminders via Telegram (APScheduler, configurable time) — `merkur-brain`
- [x] Telegram commands: `/note`, `/show`, `/ask`, `/todo`, `/done`, `/remind`, `/help` — `merkur-brain`
- [x] WhatsApp webhook (basic text note capture) — `merkur-brain`

### Next feature: orbit landing page
See **Orbit landing page** section below for full spec.

### Planned extensions (do not build yet)
- **Calendar integration:** Google Calendar read/write — `merkur-brain`
- **Semantic search:** pgvector-powered "find related notes" — `merkur-brain`
- **Multi-user / sharing**
- **Mobile app:** React Native or PWA enhancements

---

## Tech stack

### merkur-web (TypeScript)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | |
| Editor | TipTap | MIT, no paid tier needed |
| Auth | Supabase Auth | Magic link, single user |
| Database client | `@supabase/ssr` | Server components + API routes only |
| File storage | Supabase Storage | `note-images` bucket, public |
| Styling | Tailwind CSS | |
| Hosting | Vercel | Free tier |

### merkur-brain (Python)

| Layer | Choice | Notes |
|---|---|---|
| Framework | FastAPI | Async, clean, minimal |
| Database client | `supabase-py` | Talks to same Supabase project |
| AI | `anthropic` Python SDK | All AI calls live here |
| Telegram | Telegram Bot API | Handled entirely in this service |
| WhatsApp | Meta Cloud API | Basic text capture only |
| Server | Uvicorn | Via Railway or Fly.io (~$5/mo) |
| Task queue | `asyncio` background tasks | Sufficient; swap for Celery if needed |
| Scheduler | APScheduler | Daily reminder job |

### Shared infrastructure

| Layer | Choice | Notes |
|---|---|---|
| Database | Supabase (Postgres) | Free tier |
| File storage | Supabase Storage | `note-images` bucket |

**Future additions (not yet in stack):**
- `pgvector` Supabase extension — semantic search, owned by `merkur-brain`
- Google Calendar API — owned by `merkur-brain`

---

## Repository structure

### merkur-web

```
merkur-web/
├── app/
│   ├── (auth)/login/page.tsx            # Magic link login page
│   ├── (app)/
│   │   ├── layout.tsx                   # Sidebar + auth guard
│   │   ├── page.tsx                     # Orbit landing page (OrbitCanvas)
│   │   ├── notes/[noteId]/page.tsx      # Note editor view
│   │   ├── folders/[folderId]/page.tsx  # Folder note list
│   │   └── todos/page.tsx               # Aggregated todos view
│   └── api/
│       ├── notes/route.ts               # Note CRUD (GET, POST, PATCH, DELETE)
│       ├── folders/route.ts             # Folder CRUD
│       ├── todos/route.ts               # Todo CRUD (recurrence resets on GET)
│       ├── reorder/route.ts             # Note position reorder
│       ├── upload/route.ts              # Image upload → Supabase Storage
│       ├── cleanup/route.ts             # Proxy to brain POST /cleanup
│       └── query/route.ts              # Proxy to brain POST /query
├── components/
│   ├── orbit/
│   │   └── OrbitCanvas.tsx             # Canvas 2D orbit landing page (see spec below)
│   ├── editor/
│   │   ├── NoteEditor.tsx              # TipTap editor: auto-save, image upload/paste/drop, AI cleanup
│   │   └── ResizableImage.tsx          # Custom TipTap extension: drag-to-resize with persistent width
│   ├── sidebar/
│   │   ├── Sidebar.tsx                 # Root sidebar shell + AskBar
│   │   ├── FolderTree.tsx              # Folder + note navigation tree
│   │   ├── NoteList.tsx                # Note list within a folder
│   │   ├── TodosNavLink.tsx            # Link + pending count badge
│   │   └── AskBar.tsx                  # Natural-language query bar
│   └── todos/                          # TodoList (per-note), TodosView (aggregated)
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Browser Supabase client
│   │   └── server.ts                   # Server Supabase client
│   ├── types.ts                        # Shared TypeScript types (keep in sync with DB)
│   └── schemas.ts                      # Zod schemas for API validation
├── __tests__/
│   ├── unit/                           # Run in pre-commit (pure logic, no I/O)
│   └── integration/                    # CI only — mocked Supabase
└── package.json
```

**Rules for merkur-web:**
- No AI calls. No Anthropic SDK. No Telegram calls. Ever.
- All Supabase calls from server components or API routes only — never from client components.
- `lib/types.ts` must stay in sync with the database schema.
- Image uploads use the service role key (bypasses RLS) — auth guard is enforced at the route level.

### merkur-brain

```
merkur-brain/
├── app/
│   ├── main.py                     # FastAPI entry point + lifespan (scheduler, bot commands)
│   ├── routers/
│   │   ├── telegram.py             # POST /webhook/telegram — full command + photo routing
│   │   ├── whatsapp.py             # GET/POST /webhook/whatsapp — basic text capture
│   │   ├── cleanup.py              # POST /cleanup — called by merkur-web
│   │   └── query.py                # POST /query — called by merkur-web
│   ├── agents/
│   │   ├── intake_agent.py         # Raw message → note title + folder_id
│   │   ├── cleanup_agent.py        # Raw content → clean markdown + image normalisation
│   │   ├── intent_agent.py         # Free-text instruction → typed IntentAction
│   │   └── query_agent.py          # RAG question answering over all notes
│   ├── services/
│   │   ├── notes.py                # All Supabase read/write (notes, folders, todos)
│   │   ├── settings.py             # Key-value settings table helpers
│   │   ├── scheduler.py            # APScheduler daily reminder job
│   │   ├── storage.py              # Supabase Storage upload (Telegram photos)
│   │   ├── telegram.py             # Outbound Telegram messages + file download
│   │   └── whatsapp.py             # Outbound WhatsApp messages
│   └── models.py                   # All Pydantic models
├── tests/
│   ├── unit/                       # Run in pre-commit (mocked, fast)
│   └── integration/                # CI only — requires live Supabase + APIs
├── .env
├── requirements.txt
└── Dockerfile
```

**Rules for merkur-brain:**
- No UI. No Next.js. No frontend concerns.
- All AI calls live in `agents/`. No `anthropic` SDK calls anywhere else.
- All DB access goes through `services/notes.py`. Routers never call Supabase directly.
- All agent inputs and outputs are validated Pydantic models.
- Storage uploads go through `services/storage.py`.

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
  content text,                          -- markdown (may contain <img> HTML for images)
  folder_id uuid references folders(id) on delete set null,
  source text check (source in ('web', 'telegram')) default 'web',
  is_cleaned boolean default false,      -- whether cleanup agent has run
  position integer,                      -- display order within folder
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Todos
create table todos (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references notes(id) on delete cascade,
  text text not null,
  done boolean default false,
  done_at timestamptz,
  due_date date,
  recurrence text check (recurrence in ('daily', 'weekly', 'monthly')),
  created_at timestamptz default now()
);

-- Settings (key-value store for bot configuration)
create table settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Supabase Storage bucket: note-images (public)
-- Created via migration 009_storage_bucket.sql
```

**Migration convention:** one file per change, named `001_initial.sql`, `002_add_source_to_notes.sql`, etc. Never edit existing migration files.

---

## Orbit landing page

**Component:** `components/orbit/OrbitCanvas.tsx`
**Route:** `app/(app)/page.tsx` (the default view after login)
**Scope:** `merkur-web` only — no backend changes required.

### What it does

Replaces the plain redirect-to-first-folder default page with an animated canvas showing notes orbiting a central Merkur logo mark. It is purely a navigation aid and visual identity moment — clicking any note dot navigates to that note.

### Rendering

Use **Canvas 2D** (`<canvas>` + `requestAnimationFrame`), not SVG or DOM elements. Canvas draws everything in a single pass per frame with no DOM mutations — smooth at 20 dots, still smooth at 200. Do not reach for a physics library; plain trigonometry is sufficient.

### Layout

- Canvas fills the full available area (`width: 100%, height: 100%` of the app content area, excluding the sidebar)
- Centre point is `(canvas.width / 2, canvas.height / 2)`
- One orbit ring, drawn as a thin ellipse (slightly flattened: `rx = R, ry = R * 0.38`) to give perspective depth — matching the logo aesthetic
- The ring itself animates: a short arc highlight (~60°) rotates around the ellipse at ~0.3 rad/s, giving the impression of a moving ring without moving the notes

### Centre mark

Draw the Merkur logo mark at the centre:
- Filled circle (planet dot), radius ~10px
- The orbit ellipse path itself serves as the logo ring — no need for a separate logo element
- No vertical stem (the landing page variant of the logo)

### Note dots

- Fetch: `SELECT id, title, folder_id FROM notes ORDER BY updated_at DESC LIMIT {MAX_DOTS}` — lean query, title and folder only
- `MAX_DOTS` is a constant at the top of the file, defaulting to `20`. Make it easy to change.
- Each dot: filled circle, radius 5px, same colour as the primary text variable
- Label: note title rendered below the dot, 11px, truncated to ~20 chars with ellipsis, centred on the dot's x position
- Dots are placed on the orbit ellipse. Notes in the same folder are clustered: assign each folder a base angle, then spread its notes ±25° around that base angle. Stagger radii slightly (±12px) within a cluster so labels don't overlap.
- All dots orbit slowly counterclockwise at ~0.008 rad/s (roughly one full revolution every 13 minutes). Each dot has a small individual speed jitter (±20%) so the orbit feels organic rather than mechanical.

### Folder connection lines

- Notes sharing a folder are connected by thin straight lines (0.5px, 15% opacity of the primary colour)
- Lines are drawn before dots so they sit underneath
- Only draw lines between dots in the same folder — do not connect across folders

### Interaction

- **Hover:** cursor changes to `pointer` when within 14px of a dot centre. The dot radius grows to 8px and the label becomes fully opaque (dots default to 80% opacity).
- **Click:** `router.push('/notes/${note.id}')` — navigate to the note editor
- **Drag (optional, implement after core works):** on `mousedown` within 14px of a dot, enter drag mode. The dot follows the cursor. On `mouseup`, re-integrate the dot onto the nearest point on the orbit ellipse and resume orbiting from that angle. Smooth the re-entry with a lerp over ~30 frames rather than snapping.

### Data loading

- Fetch notes client-side on mount using the Supabase browser client
- Show the animated centre mark and empty orbit ring immediately — do not wait for data
- Dots animate in one by one as data loads (fade in over 20 frames each)
- On fetch error: show the orbit ring and a small muted "no notes yet" label at the centre

### Props / configuration

```ts
interface OrbitCanvasProps {
  maxDots?: number        // default: 20
}
```

The component reads notes itself via the Supabase browser client — it does not receive notes as a prop, keeping the parent page clean.

### What not to do

- Do not use `useEffect` to update individual DOM elements per frame — all drawing goes through the canvas context
- Do not import a physics engine or animation library — `requestAnimationFrame` + trigonometry only
- Do not render labels as HTML elements positioned over the canvas — draw them on the canvas with `ctx.fillText`
- Do not block render on data — the animation loop starts immediately

---

## AI agents (merkur-brain)

All agents follow the same pattern: a function that takes a Pydantic model and returns a Pydantic model. No agent returns raw strings or dicts. No agent has side effects — side effects (DB writes, Telegram messages) happen in the router or service layer.

### Intake agent (`agents/intake_agent.py`)

Called when a Telegram message arrives. Parses the raw message and maps it to a folder.

- **Input:** `IntakeInput(raw_message, available_folders)`
- **Output:** `IntakeOutput(title, content, folder_id)`
- Returns valid JSON only; `folder_id: null` if no confident folder match
- `max_tokens=1024`

### Cleanup agent (`agents/cleanup_agent.py`)

Called after a note is created (async, non-blocking). Rewrites raw content into clean markdown. Also called synchronously via `POST /cleanup` from `merkur-web`.

- **Input:** `CleanupInput(raw_content, title)`
- **Output:** `CleanupOutput(cleaned_content)`
- Post-processes output to normalise image widths: bare `![](url)` and unsized `<img>` tags → `<img width="600" />`
- `max_tokens=4096`

### Intent agent (`agents/intent_agent.py`)

Interprets free-text instructions sent as `/some text` in Telegram. Returns a typed action for the router to dispatch.

- **Input:** `IntentInput(text, available_folders)`
- **Output:** `IntentAction(action, ...fields)` where `action` is one of: `create_note`, `append_note`, `query_note`, `query_notes`, `create_todo`, `update_todo`, `list_todos`, `complete_todo`, `create_folder`, `unknown`
- `max_tokens=512`

### Query agent (`agents/query_agent.py`)

RAG-style question answering. Receives all notes as context, returns a grounded answer.

- **Input:** `QueryInput(question, notes)` — up to 100 notes, content truncated to 1200 chars each
- **Output:** `QueryOutput(answer)`
- Called from both the Telegram `/ask` command and `POST /query` endpoint
- `max_tokens=1024`

### All agents

- Use `claude-sonnet-4-5` model
- Always wrap in `try/except` — on failure, degrade gracefully and log the error
- Log token usage (`response.usage`)

---

## Telegram integration (merkur-brain)

### Webhook registration

```bash
curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://merkur-brain.railway.app/webhook/telegram&secret_token={SECRET}"
```

### Message handling (`POST /webhook/telegram`)

1. Verify `X-Telegram-Bot-Api-Secret-Token` header
2. Extract message (text or photo) — other types are ignored
3. If photo: download from Telegram CDN → upload to Supabase Storage → get public URL
4. Persist `chat_id` to settings table (for scheduler)
5. Dispatch:
   - Commands starting with `/` → `_handle_command()`
   - Everything else → `_save_note()` (intake agent → create note)

**Always return HTTP 200** — otherwise Telegram retries aggressively.

### Telegram commands

| Command | Handler | Notes |
|---|---|---|
| `/note <text>` | `_save_note()` | `title:` flag overrides AI title; photo attachment supported |
| `/show <title>` | `_handle_show_note()` | Exact then partial title match; truncated to 4000 chars |
| `/ask <question>` | `_handle_ask_notes()` | Query agent → RAG answer |
| `/todo <text>` | `_handle_todo()` | Supports `due:`, `repeat:`, `note:` flags |
| `/todo list` | `_send_todo_list()` | Numbered list grouped by note |
| `/done <N>` | `_handle_done()` | Checks off Nth pending todo |
| `/remind HH:MM\|off\|status` | `_handle_remind()` | Sets APScheduler time |
| `/help`, `/start` | — | Static text responses |
| `/ <free text>` | `_handle_intent()` | Intent agent dispatch |

### Photo messages

Photos (with or without caption) are handled at the top of `receive_update`:
- `message.photo_file_id` → `tg_service.get_file_path()` → `tg_service.download_file()` → `storage_service.upload_image()` → public URL
- The URL is threaded as `image_url` through the entire command dispatch chain
- Embedded as `<img src="..." width="600" />` in note content

### Outbound messages (`services/telegram.py`)

Thin wrapper around `POST /sendMessage` (Markdown parse mode). Also contains `get_file_path()` and `download_file()` for photo handling.

---

## Brain HTTP API (consumed by merkur-web)

Both endpoints require `X-Brain-Secret: {BRAIN_SECRET}` when `BRAIN_SECRET` env var is set.

| Method | Path | Request body | Response |
|---|---|---|---|
| `POST` | `/cleanup` | `{note_id, title, content}` | `{cleaned_content}` |
| `POST` | `/query` | `{question}` | `{answer}` |
| `GET` | `/health` | — | `{status: "ok"}` |

---

## Environment variables

### merkur-web (`.env.local`)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-side only — used for Storage uploads

# App
NEXT_PUBLIC_APP_URL=              # e.g. https://merkur.vercel.app

# merkur-brain (required for Clean up and Ask features)
BRAIN_URL=                        # e.g. https://merkur-brain.railway.app
BRAIN_SECRET=                     # must match BRAIN_SECRET in merkur-brain
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

# Brain API (shared secret with merkur-web)
BRAIN_SECRET=                     # gates /cleanup and /query endpoints

# Scheduler
REMINDER_TIME=09:00               # default daily reminder time (HH:MM)

# App
BRAIN_ENV=development             # or production

# WhatsApp (optional)
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
```

Never commit either env file. `ANTHROPIC_API_KEY` never appears in `merkur-web` at all.

---

## Architecture principles

1. **Two services, one database.** `merkur-web` and `merkur-brain` are decoupled. They share state through Supabase. `merkur-web` may call `merkur-brain`'s HTTP API (`/cleanup`, `/query`), but never the other way around.

2. **Python for logic, TypeScript for UI.** All AI, Telegram, scheduling, and data processing lives in `merkur-brain`. All rendering, editing, and user interaction lives in `merkur-web`. When in doubt: if it involves AI or a third-party integration, it's `merkur-brain`; if it involves displaying or editing, it's `merkur-web`.

3. **Agent interface is stable.** Agents take Pydantic models and return Pydantic models. No agent has side effects — DB writes and Telegram messages happen in the router or service layer. When new agents are added, they follow the same pattern.

4. **Notes are the core primitive.** Todos attach to notes via foreign key. Images are stored externally (Supabase Storage) and referenced by URL in note content. Do not design features that bypass the notes table.

5. **Telegram handler is a router, not a monolith.** The webhook handler classifies the message type first, then delegates to a focused handler. Each command and intent action has its own function.

6. **AI is always optional.** Every user action must work without AI. AI runs asynchronously and enhances — it never blocks a response. The cleanup agent runs as a `BackgroundTask`; the intake agent is the only synchronous AI call on the hot path.

7. **Folder depth is one level.** The schema supports unlimited nesting (`parent_id`), but the UI renders only one level deep. Do not add recursive rendering until explicitly requested.

8. **Images are HTML, not markdown.** Images with a width set are serialised as `<img src="..." width="N" />` in note content so the width survives save/reload cycles. The TipTap `ResizableImage` extension reads `width` from the HTML attribute on load and writes it back on save via `getMarkdownWithWidths()`.

9. **Canvas for animated UI.** The orbit landing page uses Canvas 2D, not SVG or positioned DOM elements. All per-frame drawing goes through the canvas context. Do not introduce animation libraries for this component — `requestAnimationFrame` + trigonometry is sufficient.

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

Pre-commit hooks run automatically on every `git commit`. The config lives at the monorepo root in `.pre-commit-config.yaml`.

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
| `pytest` | Python | Runs `merkur-brain/tests/unit/` |
| `eslint` | TypeScript | Lints TS/TSX files |
| `prettier` | TypeScript / JSON / MD | Formats all non-Python files |
| `tsc` | TypeScript | Type-checks `merkur-web` without emitting |
| `jest` | TypeScript | Runs `merkur-web/__tests__/unit/` |
| `detect-secrets` | Both | Blocks accidental secrets/API key commits |
| `commitlint` | Both | Enforces conventional commit message format |
| `check-added-large-files` | Both | Blocks files >500KB |
| `check-merge-conflict` | Both | Blocks unresolved merge conflict markers |
| `end-of-file-fixer` | Both | Ensures files end with a newline |
| `trailing-whitespace` | Both | Strips trailing whitespace |

### Test scope in pre-commit

Pre-commit runs a fast subset of tests only — the full suite runs in CI.

**merkur-brain (pytest):** only `tests/unit/` — agent parsing logic, Pydantic model validation, webhook handling. All external calls (Anthropic, Supabase, Telegram) are mocked with `pytest-mock`.

**merkur-web (jest):** only `__tests__/unit/` — utility functions and Zod schemas. No component rendering, no API calls.

### Conventional commits

Format: `type(scope): description`

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`
**Scopes:** `web`, `brain`, `db`, `infra`

### Skipping hooks (use sparingly)
```bash
git commit --no-verify -m "wip: ..."
SKIP=mypy git commit -m "..."
SKIP=pytest git commit -m "..."
```

---

## Running locally

### merkur-web
```bash
cd merkur-web
npm install
cp .env.example .env.local   # fill in Supabase + brain keys
npm run dev                  # runs on http://localhost:3000
```

### merkur-brain
```bash
cd merkur-brain
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env         # fill in all keys
uvicorn app.main:app --reload --port 8000
```

### Telegram webhook (local testing)
```bash
ngrok http 8000
curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://<ngrok-id>.ngrok.io/webhook/telegram&secret_token={SECRET}"
```

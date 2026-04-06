<div align="center">
  <img src="docs/readme-logo.svg" alt="Merkur" width="420" />
  <br/>
  <br/>
  <p><em>Personal knowledge OS — capture via Telegram, read and edit on the web.</em></p>
</div>

---

## What is Merkur?

Merkur is a self-hosted, single-user note-taking system built around one idea: **capture first, organise later**.

Send a message to the Telegram bot → an AI agent assigns it a title and folder → a second agent cleans up the formatting → the note appears in the web app, ready to read and edit.

The name comes from the German word *merken* — to notice, to remember.

## Architecture

```
Telegram Bot
     │
     ▼
merkur-brain  ──────────────────────────────┐
(FastAPI · Python)                          │
  intake agent  → title + folder            │
  cleanup agent → clean markdown            │  Supabase (Postgres)
                                            │
merkur-web  ────────────────────────────────┘
(Next.js · TypeScript)
  note editor (TipTap)
  folder tree
  magic link auth
```

The two services are fully decoupled — they share only the database. Neither calls the other over HTTP.

## Stack

| | |
|---|---|
| **Web** | Next.js 14 App Router, TipTap, Tailwind CSS, Supabase Auth |
| **Brain** | FastAPI, Anthropic Claude, Telegram Bot API, Supabase |
| **Database** | Supabase (Postgres) |
| **Hosting** | Vercel (web) · Fly.io (brain) |

## Getting started

### Prerequisites
- [Supabase](https://supabase.com) project
- [Anthropic](https://console.anthropic.com) API key
- Telegram bot token from [@BotFather](https://t.me/BotFather)

### 1. Database

Run the migrations in order in your Supabase SQL editor:

```
supabase/migrations/001_initial.sql
supabase/migrations/002_rls.sql
supabase/migrations/003_triggers_and_indexes.sql
supabase/migrations/004_source_telegram.sql
```

### 2. merkur-web

```bash
cd merkur-web
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev                  # http://localhost:3000
```

### 3. merkur-brain

```bash
cd merkur-brain
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env         # fill in all keys
uvicorn app.main:app --reload --port 8000
```

### 4. Register the Telegram webhook

```bash
curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://your-server/webhook/telegram&secret_token={SECRET}"
```

## Project structure

```
merkur/
├── merkur-web/          # Next.js frontend
├── merkur-brain/        # FastAPI backend + AI agents
└── supabase/migrations/ # Shared database migrations
```

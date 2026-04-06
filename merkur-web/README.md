# merkur-web

Next.js frontend for Merkur — markdown note editor with folder organisation and todo management.

## What it does

- Folder sidebar with nested folders (one level deep for MVP)
- Note editor powered by TipTap (markdown, auto-save)
- Todo lists embedded below each note — add, check off, set due dates and recurrence
- Aggregated todos view across all notes, grouped by folder
- Single-user auth via Supabase magic link

## Stack

- **Next.js 14** (App Router)
- **TipTap** — rich text / markdown editor
- **Supabase** — auth + database (`@supabase/ssr`)
- **Tailwind CSS**
- **Zod** — API request validation
- Deployed on **Vercel**

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev                  # http://localhost:3000
```

### Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # server-side only
NEXT_PUBLIC_APP_URL=
```

## Project structure

```
app/
├── (auth)/login/            # Magic link login page
├── (app)/
│   ├── layout.tsx           # Sidebar + auth guard
│   ├── page.tsx             # Redirect to first folder
│   ├── notes/[noteId]/      # Note editor view
│   ├── folders/[folderId]/  # Folder note list
│   └── todos/               # Aggregated todos view
└── api/
    ├── notes/               # Note CRUD
    ├── folders/             # Folder CRUD
    └── todos/               # Todo CRUD (recurrence resets on GET)
components/
├── editor/NoteEditor.tsx    # TipTap editor with auto-save
├── sidebar/                 # Sidebar, FolderTree, NoteList, TodosNavLink
└── todos/                   # TodoList (per-note), TodosView (aggregated)
lib/
├── supabase/                # Browser + server Supabase clients
├── types.ts                 # Shared TypeScript types (in sync with DB schema)
└── schemas.ts               # Zod schemas for API validation
```

## Tests

```bash
npm test                     # unit tests only (pre-commit safe)
npm run test:integration     # API route tests with mocked Supabase (CI only)
```

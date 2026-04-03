# Merkur Web — MVP Design Spec

**Date:** 2026-04-03
**Scope:** `merkur-web` only (MVP phase 1). `merkur-brain` is out of scope but the monorepo structure and database schema are set up to accommodate it.

---

## 1. Overview

Merkur is a personal knowledge OS: markdown note-taking with folder organisation, with a WhatsApp capture layer coming later. This spec covers the web app MVP:

- Magic link authentication (single user, Supabase Auth)
- Folder system (one level deep: folders and sub-folders)
- Note CRUD with a TipTap markdown editor
- Warm/editorial aesthetic (Tailwind `stone` palette, `@tailwindcss/typography`)

**Data layer:** RSC + REST API routes (Approach A). Server components fetch data; API routes handle all mutations; `router.refresh()` re-renders the server tree after each mutation. No client-side Supabase calls.

---

## 2. Monorepo & foundation

### Directory layout

```
merkur/
├── merkur-web/              # Next.js 14 App Router (this spec)
├── merkur-brain/            # Python FastAPI (scaffold placeholder only for now)
├── supabase/
│   └── migrations/
│       ├── 001_initial.sql  # folders + notes tables
│       └── 002_rls.sql      # Row Level Security policies
├── .pre-commit-config.yaml
├── pyproject.toml           # ruff + mypy config
├── .commitlintrc.json
└── CLAUDE.md
```

### Database migrations

**`001_initial.sql`** — creates `folders` and `notes` exactly as specified in CLAUDE.md.

**`002_rls.sql`** — enables RLS on both tables. Policies:
- The `authenticated` role can SELECT, INSERT, UPDATE, DELETE on both tables (single-user app; no per-row ownership needed).
- The `anon` role has no access.

This is required because Supabase exposes the DB via a public URL; without RLS the anon key would allow unauthenticated reads.

### `merkur-brain/` placeholder

An empty directory with a `README.md` noting it will hold the FastAPI service. No code yet.

---

## 3. Auth & routing

### Auth flow

- **Magic link only.** No password, no registration form.
- Login page: centered card with an email input. On submit → `supabase.auth.signInWithOtp({ email })`. On success → display "Check your email."
- Supabase handles the redirect back to the app after the user clicks the link.

### Route structure

```
app/
├── (auth)/
│   └── login/
│       └── page.tsx          # Magic link form
├── (app)/
│   ├── layout.tsx            # Auth guard + sidebar shell
│   ├── page.tsx              # Redirects to first folder or empty state
│   ├── folders/
│   │   └── [folderId]/
│   │       └── page.tsx      # Note list for folder
│   └── notes/
│       └── [noteId]/
│           └── page.tsx      # TipTap editor
└── api/
    ├── folders/
    │   └── route.ts
    └── notes/
        └── route.ts
```

### Auth guard

`(app)/layout.tsx` is a server component. It calls the server Supabase client, checks the session, and redirects to `/login` if unauthenticated. All protected pages are children of this layout.

### Supabase clients

- `lib/supabase/server.ts` — `createServerClient` from `@supabase/ssr`, reads cookies. Used in server components and API routes.
- `lib/supabase/client.ts` — `createBrowserClient` from `@supabase/ssr`. Used only for client-side auth state management (session refresh, auth state listeners). Client components call API routes via plain `fetch()`, never Supabase directly.

---

## 4. Components

### `components/sidebar/Sidebar.tsx` (server component)

- Fetches all folders server-side (passed as props to `FolderTree`)
- Fixed left column, warm neutral background (`bg-stone-100`)
- Renders: app name/logo, "New Folder" button, `<FolderTree />`

### `components/sidebar/FolderTree.tsx` (client component)

- Receives folder list as props from `Sidebar`
- Renders folders; sub-folders expand/collapse on click
- One level of nesting only (MVP rule)
- Inline rename on double-click; delete via icon button
- All mutations: POST/PATCH/DELETE to `/api/folders` → `router.refresh()`
- Active folder highlighted

### `components/sidebar/NoteList.tsx` (server component, inside folder page)

- Rendered inside `/folders/[folderId]/page.tsx`
- Lists notes sorted by `updated_at` DESC
- Each note is a `<Link>` to `/notes/[noteId]`
- "New Note" button at top: POST to `/api/notes` → navigate to new note id

### `components/editor/NoteEditor.tsx` (client component)

- TipTap with `StarterKit` (headings, bold, italic, lists, blockquote, code block)
- Editable `<h1>` above the editor body for the note title
- Auto-save: debounced 500ms PATCH to `/api/notes` after each change
- Displays last-saved timestamp in footer
- Folder move: dropdown selector (fetches folder list from `/api/folders`) → PATCH note with new `folder_id`

### `components/ui/` (shared primitives)

- `Button.tsx`, `Input.tsx`, `EmptyState.tsx` — plain Tailwind components, no external UI library

---

## 5. API routes

All routes:
- Use `lib/supabase/server.ts`
- Validate request bodies with Zod
- Return `{ error: string }` + appropriate HTTP status on failure
- Return `401` for unauthenticated requests

### `app/api/folders/route.ts`

| Method | Body / Params | Action |
|--------|--------------|--------|
| GET | — | Return all folders (id, name, parent_id, created_at) |
| POST | `{ name: string, parent_id?: string \| null }` | Create folder |
| PATCH | `{ id: string, name: string }` | Rename folder |
| DELETE | `{ id: string }` | Delete folder (DB cascades to notes) |

### `app/api/notes/route.ts`

| Method | Body / Params | Action |
|--------|--------------|--------|
| GET | `?folderId=<uuid>` | Return notes for folder |
| POST | `{ title?: string, folder_id?: string \| null }` | Create note |
| PATCH | `{ id: string, title?: string, content?: string, folder_id?: string \| null }` | Update note |
| DELETE | `{ id: string }` | Delete note |

### `lib/types.ts`

```typescript
export type Folder = {
  id: string
  name: string
  parent_id: string | null
  created_at: string
  updated_at: string
}

export type Note = {
  id: string
  title: string
  content: string | null
  folder_id: string | null
  source: 'web' | 'whatsapp'
  is_cleaned: boolean
  created_at: string
  updated_at: string
}
```

---

## 6. Styling

- **Palette:** Tailwind `stone` (warm greys) for UI chrome; `amber` for accents (active states, hover)
- **Typography:** `@tailwindcss/typography` (`prose`) applied inside the TipTap editor wrapper for warm readable body text
- **Font:** System serif stack for editor content (`font-serif`); system sans for UI chrome
- **Layout:** Fixed sidebar (260px), fluid content area

---

## 7. Testing & tooling

### `package.json` scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "lint": "eslint .",
  "format": "prettier --write .",
  "typecheck": "tsc --noEmit",
  "test": "jest",
  "test:unit": "jest --testPathPattern=__tests__/unit",
  "test:integration": "jest --testPathPattern=__tests__/integration"
}
```

### Unit tests (`__tests__/unit/`) — run in pre-commit

- `schemas.test.ts` — Zod schema validation for folder/note request bodies (valid inputs pass, invalid inputs produce correct error messages)
- `utils.test.ts` — pure utility functions (e.g. `truncateTitle(title: string, max: number): string`)

### Integration tests (`__tests__/integration/`) — CI only

- `api.test.ts` — API route tests with mocked Supabase client

### Pre-commit hooks (`.pre-commit-config.yaml`)

| Hook | Scope |
|------|-------|
| eslint | TypeScript |
| prettier | TS/TSX/JSON/MD |
| tsc --noEmit | TypeScript |
| jest (unit only) | TypeScript |
| detect-secrets | Both |
| commitlint | Both |
| check-added-large-files | Both |
| check-merge-conflict | Both |
| end-of-file-fixer | Both |
| trailing-whitespace | Both |

### Env files

- `.env.example` committed (placeholder values)
- `.env.local` gitignored
- Required keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`

---

## 8. Out of scope (MVP)

- `merkur-brain` implementation (WhatsApp, AI agents)
- Semantic search
- Multi-user / sharing
- Mobile app / PWA
- Todos, habits, reminders
- Calendar integration
- Optimistic UI / SWR caching (can be added if UX feels slow)
- Email restriction on magic link auth

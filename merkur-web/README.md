# merkur-web

Next.js frontend for Merkur — markdown note editor with folder organisation, image support, todo management, and an AI query bar.

## What it does

- Folder sidebar with nested folders (one level deep)
- Note editor powered by TipTap (markdown, auto-save, adjustable content width)
- Image support: upload via toolbar, paste, or drag-and-drop; client-side resize before upload; drag handle to resize images inline
- Todo lists embedded below each note — add, check off, set due dates and recurrence
- Aggregated todos view across all notes, grouped by folder
- AI cleanup button: sends note to `merkur-brain` and replaces content with clean markdown
- AI query bar in sidebar: ask a natural-language question answered from all your notes
- Single-user auth via Supabase magic link

## Stack

- **Next.js 14** (App Router)
- **TipTap** — rich text / markdown editor with custom `ResizableImage` extension
- **Supabase** — auth + database + Storage (`@supabase/ssr`)
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
SUPABASE_SERVICE_ROLE_KEY=     # server-side only — used for Storage uploads
NEXT_PUBLIC_APP_URL=

# merkur-brain proxy (required for Clean up and Ask features)
BRAIN_URL=                     # e.g. https://merkur-brain.railway.app
BRAIN_SECRET=                  # must match BRAIN_SECRET in merkur-brain
```

## Project structure

```
app/
├── (auth)/login/            # Magic link login page
├── (app)/
│   ├── layout.tsx           # Sidebar + auth guard
│   ├── page.tsx             # Redirect to first note or folder
│   ├── notes/[noteId]/      # Note editor view
│   ├── folders/[folderId]/  # Folder note list
│   └── todos/               # Aggregated todos view
└── api/
    ├── notes/               # Note CRUD (GET, POST, PATCH, DELETE)
    ├── folders/             # Folder CRUD
    ├── todos/               # Todo CRUD (recurrence resets on GET)
    ├── reorder/             # Note position reorder
    ├── upload/              # Image upload → Supabase Storage (returns public URL)
    ├── cleanup/             # Proxy to merkur-brain POST /cleanup
    └── query/               # Proxy to merkur-brain POST /query
components/
├── editor/
│   ├── NoteEditor.tsx       # TipTap editor: auto-save, image upload, resize, AI cleanup
│   └── ResizableImage.tsx   # Custom TipTap extension: drag-to-resize images with persistent width
├── sidebar/
│   ├── Sidebar.tsx          # Root sidebar with AskBar
│   ├── FolderTree.tsx       # Folder + note navigation tree
│   ├── NoteList.tsx         # Note list within a folder
│   ├── TodosNavLink.tsx     # Link to aggregated todos view
│   └── AskBar.tsx           # Natural-language query bar (calls /api/query)
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

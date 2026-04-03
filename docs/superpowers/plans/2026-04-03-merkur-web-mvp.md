# Merkur Web MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `merkur-web` Next.js app with folder management, note CRUD, a TipTap markdown editor, and Supabase magic link auth — plus the shared monorepo scaffold and database migrations.

**Architecture:** RSC + REST API routes. Server components fetch data from Supabase and pass it as props. Client components call API routes via `fetch()`. `router.refresh()` re-renders the server tree after mutations. No Supabase calls from client components — ever.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Tailwind CSS + `@tailwindcss/typography`, TipTap + StarterKit, `@supabase/ssr`, Zod, Jest + ts-jest

---

## File Map

### Monorepo root (all new)
| File | Purpose |
|------|---------|
| `.pre-commit-config.yaml` | All pre-commit hooks |
| `pyproject.toml` | Ruff + mypy config (Python, for future merkur-brain) |
| `.commitlintrc.json` | Conventional commit rules |
| `merkur-brain/README.md` | Placeholder for future Python service |
| `supabase/migrations/001_initial.sql` | folders + notes tables |
| `supabase/migrations/002_rls.sql` | Row Level Security policies |

### merkur-web (all new)
| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root HTML shell |
| `app/globals.css` | Tailwind directives |
| `app/(auth)/login/page.tsx` | Magic link email form |
| `app/auth/callback/route.ts` | Exchanges Supabase auth code for session |
| `app/(app)/layout.tsx` | Auth guard + sidebar wrapper |
| `app/(app)/page.tsx` | Redirects to first folder or empty state |
| `app/(app)/folders/[folderId]/page.tsx` | Note list for a folder |
| `app/(app)/notes/[noteId]/page.tsx` | Note editor shell (server) |
| `app/api/folders/route.ts` | Folder CRUD (GET/POST/PATCH/DELETE) |
| `app/api/notes/route.ts` | Note CRUD (GET/POST/PATCH/DELETE) |
| `middleware.ts` | Supabase session refresh on every request |
| `lib/types.ts` | `Folder` + `Note` TypeScript types |
| `lib/schemas.ts` | Zod schemas for API request validation |
| `lib/utils.ts` | `truncateTitle` pure utility |
| `lib/supabase/server.ts` | Server-side Supabase client |
| `lib/supabase/client.ts` | Browser Supabase client (auth state only) |
| `components/ui/Button.tsx` | Amber-accent button primitive |
| `components/ui/Input.tsx` | Labelled text input primitive |
| `components/ui/EmptyState.tsx` | Centered empty state message |
| `components/sidebar/Sidebar.tsx` | Server component — fetches folders, renders chrome |
| `components/sidebar/FolderTree.tsx` | Client component — folder CRUD + expand/collapse |
| `components/sidebar/NoteList.tsx` | Client component — note list + New Note button |
| `components/editor/NoteEditor.tsx` | Client component — TipTap editor with auto-save |
| `__tests__/unit/schemas.test.ts` | Zod schema unit tests (run in pre-commit) |
| `__tests__/unit/utils.test.ts` | Pure utility unit tests (run in pre-commit) |
| `__tests__/integration/api.test.ts` | API route integration stubs (CI only) |
| `jest.config.ts` | Jest configuration |
| `.env.example` | Placeholder env vars (committed) |
| `.prettierrc` | Prettier config |

---

## Task 1: Supabase project setup

**Files:** none (manual steps in Supabase dashboard)

- [ ] **Step 1: Create Supabase project**

  Go to [supabase.com](https://supabase.com) → New project. Choose a region close to you. Note the project URL and keys (available under Settings → API).

- [ ] **Step 2: Note the three values you'll need**

  ```
  NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
  SUPABASE_SERVICE_ROLE_KEY=<service role key>
  ```

  Keep these — they go into `.env.local` in Task 8.

- [ ] **Step 3: Disable email confirmation (for magic link flow)**

  In Supabase Dashboard → Authentication → Providers → Email: turn off "Confirm email". Magic links work without it, and it avoids a double-confirmation step.

---

## Task 2: Monorepo root scaffold

**Files:**
- Create: `.pre-commit-config.yaml`
- Create: `pyproject.toml`
- Create: `.commitlintrc.json`
- Create: `merkur-brain/README.md`

- [ ] **Step 1: Create `.commitlintrc.json`**

  ```json
  {
    "extends": ["@commitlint/config-conventional"],
    "rules": {
      "scope-enum": [1, "always", ["web", "brain", "db", "infra"]]
    }
  }
  ```

  Scopes are warned (level 1) not errored — they're optional but encouraged.

- [ ] **Step 2: Create `pyproject.toml`**

  ```toml
  [tool.ruff]
  line-length = 88
  src = ["merkur-brain"]

  [tool.ruff.lint]
  select = ["E", "F", "I", "UP", "B", "SIM"]

  [tool.mypy]
  python_version = "3.11"
  strict = true
  files = ["merkur-brain"]

  [[tool.mypy.overrides]]
  module = "supabase.*"
  ignore_missing_imports = true

  [[tool.mypy.overrides]]
  module = "dotenv.*"
  ignore_missing_imports = true
  ```

- [ ] **Step 3: Create `merkur-brain/README.md`**

  ```markdown
  # merkur-brain

  FastAPI service — WhatsApp webhook receiver and AI agents.

  Not yet implemented. See CLAUDE.md for the planned architecture.
  ```

- [ ] **Step 4: Commit**

  ```bash
  cd /path/to/Merkur
  git init
  git add .commitlintrc.json pyproject.toml merkur-brain/README.md
  git commit -m "chore(infra): add monorepo root config files"
  ```

---

## Task 3: Database migrations

**Files:**
- Create: `supabase/migrations/001_initial.sql`
- Create: `supabase/migrations/002_rls.sql`

- [ ] **Step 1: Create `supabase/migrations/001_initial.sql`**

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
    content text,
    folder_id uuid references folders(id) on delete set null,
    source text check (source in ('web', 'whatsapp')) default 'web',
    is_cleaned boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  ```

- [ ] **Step 2: Create `supabase/migrations/002_rls.sql`**

  ```sql
  -- Enable RLS
  alter table folders enable row level security;
  alter table notes enable row level security;

  -- Authenticated users can do everything (single-user app, no per-row ownership)
  create policy "authenticated users can manage folders"
    on folders for all
    to authenticated
    using (true)
    with check (true);

  create policy "authenticated users can manage notes"
    on notes for all
    to authenticated
    using (true)
    with check (true);
  ```

- [ ] **Step 3: Run migrations in Supabase**

  In the Supabase Dashboard → SQL Editor:
  1. Paste and run `001_initial.sql`
  2. Paste and run `002_rls.sql`

  Verify: go to Table Editor — you should see `folders` and `notes` tables.

- [ ] **Step 4: Commit**

  ```bash
  git add supabase/
  git commit -m "chore(db): add 001 initial schema and 002 rls migrations"
  ```

---

## Task 4: merkur-web scaffold and dependencies

**Files:** all of `merkur-web/` (scaffolded by `create-next-app`, then modified)

- [ ] **Step 1: Scaffold with create-next-app**

  ```bash
  cd /path/to/Merkur
  npx create-next-app@14 merkur-web \
    --typescript \
    --tailwind \
    --eslint \
    --app \
    --no-src-dir \
    --import-alias "@/*" \
    --no-git
  ```

  When prompted about using Turbopack for `next dev` — choose **No** (keep stable webpack for Now).

- [ ] **Step 2: Install additional dependencies**

  ```bash
  cd merkur-web
  npm install @supabase/ssr @supabase/supabase-js zod \
    @tiptap/react @tiptap/starter-kit \
    @tailwindcss/typography
  npm install --save-dev jest ts-jest @types/jest jest-environment-node
  ```

- [ ] **Step 3: Delete create-next-app boilerplate**

  ```bash
  rm -rf app/page.tsx app/favicon.ico public/
  # Keep app/globals.css and app/layout.tsx — we'll replace their content
  ```

- [ ] **Step 4: Create `jest.config.ts`**

  ```typescript
  import type { Config } from 'jest'

  const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/$1',
    },
    testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  }

  export default config
  ```

- [ ] **Step 5: Create `.prettierrc`**

  ```json
  {
    "semi": false,
    "singleQuote": true,
    "tabWidth": 2,
    "trailingComma": "es5",
    "printWidth": 100
  }
  ```

  Add prettier scripts to `package.json` (open it and add to `"scripts"`):
  ```json
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "typecheck": "tsc --noEmit",
  "test:unit": "jest --testPathPattern=__tests__/unit",
  "test:integration": "jest --testPathPattern=__tests__/integration"
  ```

- [ ] **Step 6: Update `tailwind.config.ts`**

  Replace the generated file with:

  ```typescript
  import type { Config } from 'tailwindcss'
  import typography from '@tailwindcss/typography'

  const config: Config = {
    content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
    theme: {
      extend: {
        fontFamily: {
          serif: ['Georgia', '"Times New Roman"', 'serif'],
        },
      },
    },
    plugins: [typography],
  }

  export default config
  ```

- [ ] **Step 7: Replace `app/globals.css`**

  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```

- [ ] **Step 8: Commit**

  ```bash
  cd ..
  git add merkur-web/
  git commit -m "chore(web): scaffold next.js 14 app with dependencies"
  ```

---

## Task 5: TypeScript types and .env.example

**Files:**
- Create: `merkur-web/lib/types.ts`
- Create: `merkur-web/.env.example`

- [ ] **Step 1: Create `lib/types.ts`**

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

- [ ] **Step 2: Create `merkur-web/.env.example`**

  ```bash
  # Supabase
  NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

  # App
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add merkur-web/lib/types.ts merkur-web/.env.example
  git commit -m "feat(web): add typescript types and env example"
  ```

---

## Task 6: Zod schemas (TDD)

**Files:**
- Create: `merkur-web/__tests__/unit/schemas.test.ts`
- Create: `merkur-web/lib/schemas.ts`

- [ ] **Step 1: Write the failing tests**

  Create `merkur-web/__tests__/unit/schemas.test.ts`:

  ```typescript
  import {
    createFolderSchema,
    updateFolderSchema,
    deleteFolderSchema,
    createNoteSchema,
    updateNoteSchema,
    deleteNoteSchema,
  } from '../../lib/schemas'

  const VALID_UUID = '00000000-0000-0000-0000-000000000000'

  describe('createFolderSchema', () => {
    it('accepts a valid name', () => {
      expect(createFolderSchema.safeParse({ name: 'Work' }).success).toBe(true)
    })
    it('accepts a name with optional parent_id', () => {
      expect(
        createFolderSchema.safeParse({ name: 'Sub', parent_id: VALID_UUID }).success
      ).toBe(true)
    })
    it('rejects an empty name', () => {
      const result = createFolderSchema.safeParse({ name: '' })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Name is required')
    })
    it('rejects a name over 100 characters', () => {
      const result = createFolderSchema.safeParse({ name: 'a'.repeat(101) })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Name must be 100 characters or fewer')
    })
  })

  describe('updateFolderSchema', () => {
    it('accepts valid id and name', () => {
      expect(updateFolderSchema.safeParse({ id: VALID_UUID, name: 'Renamed' }).success).toBe(true)
    })
    it('rejects invalid uuid for id', () => {
      const result = updateFolderSchema.safeParse({ id: 'not-a-uuid', name: 'Renamed' })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Invalid folder ID')
    })
    it('rejects empty name', () => {
      const result = updateFolderSchema.safeParse({ id: VALID_UUID, name: '' })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Name is required')
    })
  })

  describe('deleteFolderSchema', () => {
    it('accepts valid id', () => {
      expect(deleteFolderSchema.safeParse({ id: VALID_UUID }).success).toBe(true)
    })
    it('rejects invalid uuid', () => {
      const result = deleteFolderSchema.safeParse({ id: 'bad' })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Invalid folder ID')
    })
  })

  describe('createNoteSchema', () => {
    it('accepts empty body', () => {
      expect(createNoteSchema.safeParse({}).success).toBe(true)
    })
    it('accepts title and folder_id', () => {
      expect(
        createNoteSchema.safeParse({ title: 'Hello', folder_id: VALID_UUID }).success
      ).toBe(true)
    })
    it('rejects title over 60 characters', () => {
      const result = createNoteSchema.safeParse({ title: 'a'.repeat(61) })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Title must be 60 characters or fewer')
    })
  })

  describe('updateNoteSchema', () => {
    it('accepts id with optional fields', () => {
      expect(
        updateNoteSchema.safeParse({ id: VALID_UUID, title: 'Hello' }).success
      ).toBe(true)
    })
    it('rejects invalid uuid', () => {
      const result = updateNoteSchema.safeParse({ id: 'bad' })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Invalid note ID')
    })
    it('rejects title over 60 characters', () => {
      const result = updateNoteSchema.safeParse({ id: VALID_UUID, title: 'a'.repeat(61) })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Title must be 60 characters or fewer')
    })
  })

  describe('deleteNoteSchema', () => {
    it('accepts valid id', () => {
      expect(deleteNoteSchema.safeParse({ id: VALID_UUID }).success).toBe(true)
    })
    it('rejects invalid uuid', () => {
      const result = deleteNoteSchema.safeParse({ id: 'bad' })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Invalid note ID')
    })
  })
  ```

- [ ] **Step 2: Run tests — expect FAIL**

  ```bash
  cd merkur-web
  npm run test:unit -- --verbose
  ```

  Expected: `Cannot find module '../../lib/schemas'`

- [ ] **Step 3: Create `lib/schemas.ts`**

  ```typescript
  import { z } from 'zod'

  export const createFolderSchema = z.object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be 100 characters or fewer'),
    parent_id: z.string().uuid().nullable().optional(),
  })

  export const updateFolderSchema = z.object({
    id: z.string().uuid('Invalid folder ID'),
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be 100 characters or fewer'),
  })

  export const deleteFolderSchema = z.object({
    id: z.string().uuid('Invalid folder ID'),
  })

  export const createNoteSchema = z.object({
    title: z.string().min(1).max(60, 'Title must be 60 characters or fewer').optional(),
    folder_id: z.string().uuid().nullable().optional(),
  })

  export const updateNoteSchema = z.object({
    id: z.string().uuid('Invalid note ID'),
    title: z
      .string()
      .min(1, 'Title is required')
      .max(60, 'Title must be 60 characters or fewer')
      .optional(),
    content: z.string().optional(),
    folder_id: z.string().uuid().nullable().optional(),
  })

  export const deleteNoteSchema = z.object({
    id: z.string().uuid('Invalid note ID'),
  })
  ```

- [ ] **Step 4: Run tests — expect PASS**

  ```bash
  npm run test:unit -- --verbose
  ```

  Expected: all 14 tests pass.

- [ ] **Step 5: Commit**

  ```bash
  cd ..
  git add merkur-web/lib/schemas.ts merkur-web/__tests__/unit/schemas.test.ts
  git commit -m "feat(web): add zod schemas with unit tests"
  ```

---

## Task 7: Utility functions (TDD)

**Files:**
- Create: `merkur-web/__tests__/unit/utils.test.ts`
- Create: `merkur-web/lib/utils.ts`

- [ ] **Step 1: Write the failing tests**

  Create `merkur-web/__tests__/unit/utils.test.ts`:

  ```typescript
  import { truncateTitle } from '../../lib/utils'

  describe('truncateTitle', () => {
    it('returns title unchanged when under the limit', () => {
      expect(truncateTitle('Hello world', 60)).toBe('Hello world')
    })
    it('returns title unchanged when exactly at the limit', () => {
      expect(truncateTitle('a'.repeat(60), 60)).toBe('a'.repeat(60))
    })
    it('truncates and appends ellipsis when over the limit', () => {
      expect(truncateTitle('a'.repeat(70), 60)).toBe('a'.repeat(57) + '...')
    })
    it('handles empty string', () => {
      expect(truncateTitle('', 60)).toBe('')
    })
  })
  ```

- [ ] **Step 2: Run tests — expect FAIL**

  ```bash
  cd merkur-web
  npm run test:unit -- --verbose
  ```

  Expected: `Cannot find module '../../lib/utils'`

- [ ] **Step 3: Create `lib/utils.ts`**

  ```typescript
  export function truncateTitle(title: string, max: number): string {
    if (title.length <= max) return title
    return title.slice(0, max - 3) + '...'
  }
  ```

- [ ] **Step 4: Run tests — expect PASS**

  ```bash
  npm run test:unit -- --verbose
  ```

  Expected: all 4 utils tests pass, all 14 schema tests still pass.

- [ ] **Step 5: Commit**

  ```bash
  cd ..
  git add merkur-web/lib/utils.ts merkur-web/__tests__/unit/utils.test.ts
  git commit -m "feat(web): add truncateTitle utility with unit tests"
  ```

---

## Task 8: Supabase clients, middleware, and auth callback

**Files:**
- Create: `merkur-web/lib/supabase/server.ts`
- Create: `merkur-web/lib/supabase/client.ts`
- Create: `merkur-web/middleware.ts`
- Create: `merkur-web/app/auth/callback/route.ts`
- Create: `merkur-web/.env.local` (not committed)

- [ ] **Step 1: Create `.env.local` with real keys**

  ```bash
  cd merkur-web
  cp .env.example .env.local
  ```

  Open `.env.local` and fill in the values from Task 1 Step 2.

- [ ] **Step 2: Create `lib/supabase/server.ts`**

  ```typescript
  import { createServerClient } from '@supabase/ssr'
  import { cookies } from 'next/headers'

  export function createClient() {
    const cookieStore = cookies()
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Called from a Server Component — safe to ignore.
              // Middleware keeps the session fresh.
            }
          },
        },
      }
    )
  }
  ```

- [ ] **Step 3: Create `lib/supabase/client.ts`**

  ```typescript
  import { createBrowserClient } from '@supabase/ssr'

  export function createClient() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  ```

- [ ] **Step 4: Create `middleware.ts`** (at `merkur-web/middleware.ts`)

  This refreshes the Supabase session on every request so server components always see a current session.

  ```typescript
  import { createServerClient } from '@supabase/ssr'
  import { NextResponse, type NextRequest } from 'next/server'

  export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    await supabase.auth.getUser()

    return supabaseResponse
  }

  export const config = {
    matcher: [
      '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
  }
  ```

- [ ] **Step 5: Create `app/auth/callback/route.ts`**

  Supabase redirects here after the user clicks the magic link. It exchanges the auth code for a session and redirects to the app.

  ```typescript
  import { createServerClient } from '@supabase/ssr'
  import { cookies } from 'next/headers'
  import { NextResponse } from 'next/server'

  export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')

    if (code) {
      const cookieStore = cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            },
          },
        }
      )
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        return NextResponse.redirect(`${origin}/`)
      }
    }

    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }
  ```

- [ ] **Step 6: Configure Supabase redirect URL**

  In Supabase Dashboard → Authentication → URL Configuration:
  - Set **Site URL** to `http://localhost:3000`
  - Add `http://localhost:3000/auth/callback` to **Redirect URLs**

- [ ] **Step 7: Commit (do not commit `.env.local`)**

  ```bash
  cd ..
  git add merkur-web/lib/supabase/ merkur-web/middleware.ts merkur-web/app/auth/
  git commit -m "feat(web): add supabase clients, middleware, and auth callback"
  ```

---

## Task 9: UI primitives

**Files:**
- Create: `merkur-web/components/ui/Button.tsx`
- Create: `merkur-web/components/ui/Input.tsx`
- Create: `merkur-web/components/ui/EmptyState.tsx`

- [ ] **Step 1: Create `components/ui/Button.tsx`**

  ```typescript
  import type { ButtonHTMLAttributes } from 'react'

  type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: 'sm' | 'md'
  }

  export default function Button({ children, size = 'md', className = '', ...props }: Props) {
    const sizeClasses = size === 'sm' ? 'px-3 py-1 text-sm' : 'px-4 py-2 text-sm'
    return (
      <button
        className={`${sizeClasses} bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors ${className}`}
        {...props}
      >
        {children}
      </button>
    )
  }
  ```

- [ ] **Step 2: Create `components/ui/Input.tsx`**

  ```typescript
  import type { InputHTMLAttributes } from 'react'

  type Props = InputHTMLAttributes<HTMLInputElement> & {
    label?: string
  }

  export default function Input({ label, id, className = '', ...props }: Props) {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-stone-700">
            {label}
          </label>
        )}
        <input
          id={id}
          className={`px-3 py-2 border border-stone-300 rounded text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 ${className}`}
          {...props}
        />
      </div>
    )
  }
  ```

- [ ] **Step 3: Create `components/ui/EmptyState.tsx`**

  ```typescript
  type Props = {
    title: string
    description?: string
  }

  export default function EmptyState({ title, description }: Props) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-lg font-medium text-stone-500">{title}</p>
        {description && <p className="text-sm text-stone-400 mt-1">{description}</p>}
      </div>
    )
  }
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add merkur-web/components/ui/
  git commit -m "feat(web): add button, input, and empty state ui primitives"
  ```

---

## Task 10: Folders API route

**Files:**
- Create: `merkur-web/app/api/folders/route.ts`

- [ ] **Step 1: Create `app/api/folders/route.ts`**

  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { createClient } from '@/lib/supabase/server'
  import {
    createFolderSchema,
    updateFolderSchema,
    deleteFolderSchema,
  } from '@/lib/schemas'
  import type { Folder } from '@/lib/types'

  export async function GET() {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('folders')
      .select('id, name, parent_id, created_at, updated_at')
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data as Folder[])
  }

  export async function POST(request: NextRequest) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = createFolderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('folders')
      .insert({ name: parsed.data.name, parent_id: parsed.data.parent_id ?? null })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data as Folder, { status: 201 })
  }

  export async function PATCH(request: NextRequest) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = updateFolderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('folders')
      .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
      .eq('id', parsed.data.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data as Folder)
  }

  export async function DELETE(request: NextRequest) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = deleteFolderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { error } = await supabase.from('folders').delete().eq('id', parsed.data.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add merkur-web/app/api/folders/
  git commit -m "feat(web): add folders api route (GET/POST/PATCH/DELETE)"
  ```

---

## Task 11: Notes API route

**Files:**
- Create: `merkur-web/app/api/notes/route.ts`

- [ ] **Step 1: Create `app/api/notes/route.ts`**

  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { createClient } from '@/lib/supabase/server'
  import { createNoteSchema, updateNoteSchema, deleteNoteSchema } from '@/lib/schemas'
  import type { Note } from '@/lib/types'

  export async function GET(request: NextRequest) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folderId')

    let query = supabase
      .from('notes')
      .select('id, title, content, folder_id, source, is_cleaned, created_at, updated_at')
      .order('updated_at', { ascending: false })

    query = folderId ? query.eq('folder_id', folderId) : query.is('folder_id', null)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data as Note[])
  }

  export async function POST(request: NextRequest) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = createNoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('notes')
      .insert({
        title: parsed.data.title ?? 'Untitled',
        folder_id: parsed.data.folder_id ?? null,
        source: 'web',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data as Note, { status: 201 })
  }

  export async function PATCH(request: NextRequest) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = updateNoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title
    if (parsed.data.content !== undefined) updateData.content = parsed.data.content
    if ('folder_id' in parsed.data) updateData.folder_id = parsed.data.folder_id

    const { data, error } = await supabase
      .from('notes')
      .update(updateData)
      .eq('id', parsed.data.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data as Note)
  }

  export async function DELETE(request: NextRequest) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = deleteNoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { error } = await supabase.from('notes').delete().eq('id', parsed.data.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }
  ```

- [ ] **Step 2: Create integration test stub**

  Create `merkur-web/__tests__/integration/api.test.ts`:

  ```typescript
  // Integration tests require a live Supabase connection.
  // Run with: npm run test:integration
  // These are NOT run in pre-commit.

  describe('Folders API', () => {
    it.todo('POST /api/folders creates a folder and returns 201')
    it.todo('GET /api/folders returns all folders')
    it.todo('PATCH /api/folders renames a folder')
    it.todo('DELETE /api/folders deletes a folder')
  })

  describe('Notes API', () => {
    it.todo('POST /api/notes creates a note and returns 201')
    it.todo('GET /api/notes?folderId returns notes for a folder')
    it.todo('PATCH /api/notes updates note title and content')
    it.todo('DELETE /api/notes deletes a note')
  })
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add merkur-web/app/api/notes/ merkur-web/__tests__/integration/
  git commit -m "feat(web): add notes api route and integration test stubs"
  ```

---

## Task 12: Sidebar and FolderTree

**Files:**
- Create: `merkur-web/components/sidebar/Sidebar.tsx`
- Create: `merkur-web/components/sidebar/FolderTree.tsx`

- [ ] **Step 1: Create `components/sidebar/Sidebar.tsx`**

  ```typescript
  import { createClient } from '@/lib/supabase/server'
  import FolderTree from './FolderTree'
  import type { Folder } from '@/lib/types'

  export default async function Sidebar() {
    const supabase = createClient()
    const { data: folders } = await supabase
      .from('folders')
      .select('id, name, parent_id, created_at, updated_at')
      .order('name', { ascending: true })

    return (
      <aside className="w-64 h-full bg-stone-100 border-r border-stone-200 flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-stone-200">
          <h1 className="text-base font-serif font-semibold text-stone-800">Merkur</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <FolderTree folders={(folders ?? []) as Folder[]} />
        </div>
      </aside>
    )
  }
  ```

- [ ] **Step 2: Create `components/sidebar/FolderTree.tsx`**

  ```typescript
  'use client'

  import { useState, useRef } from 'react'
  import { useRouter, usePathname } from 'next/navigation'
  import Link from 'next/link'
  import type { Folder } from '@/lib/types'

  type Props = {
    folders: Folder[]
  }

  export default function FolderTree({ folders }: Props) {
    const router = useRouter()
    const pathname = usePathname()
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [renaming, setRenaming] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const renameInputRef = useRef<HTMLInputElement>(null)

    const topLevel = folders.filter((f) => f.parent_id === null)
    const childrenOf = (parentId: string) => folders.filter((f) => f.parent_id === parentId)

    function toggleExpand(id: string) {
      setExpanded((prev) => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
    }

    function startRename(folder: Folder) {
      setRenaming(folder.id)
      setRenameValue(folder.name)
      setTimeout(() => renameInputRef.current?.select(), 0)
    }

    async function commitRename(id: string) {
      if (!renameValue.trim()) {
        setRenaming(null)
        return
      }
      await fetch('/api/folders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: renameValue.trim() }),
      })
      setRenaming(null)
      router.refresh()
    }

    async function deleteFolder(id: string) {
      if (!confirm('Delete this folder and all its notes?')) return
      await fetch('/api/folders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      router.refresh()
      router.push('/')
    }

    async function createFolder() {
      const name = prompt('Folder name:')
      if (!name?.trim()) return
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const folder = (await res.json()) as Folder
      router.refresh()
      router.push(`/folders/${folder.id}`)
    }

    async function createSubFolder(parentId: string) {
      const name = prompt('Sub-folder name:')
      if (!name?.trim()) return
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), parent_id: parentId }),
      })
      const folder = (await res.json()) as Folder
      setExpanded((prev) => new Set(prev).add(parentId))
      router.refresh()
      router.push(`/folders/${folder.id}`)
    }

    function renderFolder(folder: Folder, depth = 0) {
      const children = childrenOf(folder.id)
      const isExpanded = expanded.has(folder.id)
      const isActive = pathname === `/folders/${folder.id}`

      return (
        <div key={folder.id}>
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded group ${
              isActive
                ? 'bg-amber-100 text-amber-900'
                : 'hover:bg-stone-200 text-stone-600'
            }`}
            style={{ paddingLeft: `${(depth + 1) * 10}px` }}
          >
            {children.length > 0 ? (
              <button
                onClick={() => toggleExpand(folder.id)}
                className="text-stone-400 hover:text-stone-600 w-4 shrink-0 text-xs"
              >
                {isExpanded ? '▾' : '▸'}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}

            {renaming === folder.id ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => void commitRename(folder.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commitRename(folder.id)
                  if (e.key === 'Escape') setRenaming(null)
                }}
                className="flex-1 bg-white border border-stone-300 rounded px-1 text-sm"
                autoFocus
              />
            ) : (
              <Link
                href={`/folders/${folder.id}`}
                className="flex-1 text-sm truncate"
                onDoubleClick={() => startRename(folder)}
              >
                {folder.name}
              </Link>
            )}

            <div className="hidden group-hover:flex items-center gap-0.5">
              {depth === 0 && (
                <button
                  onClick={() => void createSubFolder(folder.id)}
                  className="text-stone-400 hover:text-stone-600 text-xs px-1"
                  title="Add sub-folder"
                >
                  +
                </button>
              )}
              <button
                onClick={() => void deleteFolder(folder.id)}
                className="text-stone-400 hover:text-red-500 text-xs px-1"
                title="Delete folder"
              >
                ✕
              </button>
            </div>
          </div>

          {isExpanded && children.map((child) => renderFolder(child, depth + 1))}
        </div>
      )
    }

    return (
      <div>
        <div className="flex items-center justify-between px-2 py-1 mb-1">
          <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">
            Folders
          </span>
          <button
            onClick={() => void createFolder()}
            className="text-stone-400 hover:text-stone-700 text-base leading-none"
            title="New folder"
          >
            +
          </button>
        </div>
        {topLevel.map((folder) => renderFolder(folder))}
        {topLevel.length === 0 && (
          <p className="text-xs text-stone-400 px-2 py-1">No folders yet.</p>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add merkur-web/components/sidebar/Sidebar.tsx merkur-web/components/sidebar/FolderTree.tsx
  git commit -m "feat(web): add sidebar and folder tree with crud"
  ```

---

## Task 13: Root app layout and auth guard

**Files:**
- Create: `merkur-web/app/layout.tsx` (replace generated)
- Create: `merkur-web/app/(app)/layout.tsx`

- [ ] **Step 1: Replace `app/layout.tsx`**

  ```typescript
  import type { Metadata } from 'next'
  import './globals.css'

  export const metadata: Metadata = {
    title: 'Merkur',
    description: 'Your knowledge, remembered.',
  }

  export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
      <html lang="en">
        <body className="bg-stone-50 text-stone-900 antialiased">{children}</body>
      </html>
    )
  }
  ```

- [ ] **Step 2: Create `app/(app)/layout.tsx`**

  Sidebar now exists (Task 12), so this import resolves cleanly.

  ```typescript
  import { redirect } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import Sidebar from '@/components/sidebar/Sidebar'

  export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    )
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add merkur-web/app/layout.tsx merkur-web/app/'(app)'/layout.tsx
  git commit -m "feat(web): add root layout and auth guard"
  ```

---

## Task 14: Login page

**Files:**
- Create: `merkur-web/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create `app/(auth)/login/page.tsx`**

  ```typescript
  'use client'

  import { useState } from 'react'
  import { createClient } from '@/lib/supabase/client'
  import Button from '@/components/ui/Button'
  import Input from '@/components/ui/Input'

  export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault()
      setLoading(true)
      setError(null)

      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      setSubmitted(true)
      setLoading(false)
    }

    if (submitted) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-8 max-w-sm w-full text-center">
            <h1 className="text-2xl font-serif font-semibold text-stone-800 mb-2">
              Check your email
            </h1>
            <p className="text-stone-500 text-sm">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-8 max-w-sm w-full">
          <h1 className="text-2xl font-serif font-semibold text-stone-800 mb-1">Merkur</h1>
          <p className="text-stone-400 text-sm mb-6">Your knowledge, remembered.</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              id="email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send magic link'}
            </Button>
          </form>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add merkur-web/app/'(auth)'/
  git commit -m "feat(web): add magic link login page"
  ```

---

## Task 15: Folder page and NoteList

**Files:**
- Create: `merkur-web/components/sidebar/NoteList.tsx`
- Create: `merkur-web/app/(app)/folders/[folderId]/page.tsx`

- [ ] **Step 1: Create `components/sidebar/NoteList.tsx`**

  ```typescript
  'use client'

  import Link from 'next/link'
  import { useRouter } from 'next/navigation'
  import type { Folder, Note } from '@/lib/types'
  import { truncateTitle } from '@/lib/utils'
  import Button from '@/components/ui/Button'

  type Props = {
    folder: Folder
    notes: Note[]
  }

  export default function NoteList({ folder, notes }: Props) {
    const router = useRouter()

    async function createNote() {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folder.id }),
      })
      const note = (await res.json()) as Note
      router.push(`/notes/${note.id}`)
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm text-stone-400">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
          </span>
          <Button size="sm" onClick={() => void createNote()}>
            New note
          </Button>
        </div>

        {notes.length === 0 ? (
          <p className="text-stone-400 text-sm">No notes in this folder yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((note) => (
              <li key={note.id}>
                <Link
                  href={`/notes/${note.id}`}
                  className="block p-3 bg-white rounded-lg border border-stone-200 hover:border-amber-300 hover:bg-amber-50 transition-colors"
                >
                  <p className="font-medium text-stone-800 text-sm">
                    {truncateTitle(note.title, 60)}
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {new Date(note.updated_at).toLocaleDateString('de-DE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: Create `app/(app)/folders/[folderId]/page.tsx`**

  ```typescript
  import { notFound } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import NoteList from '@/components/sidebar/NoteList'
  import type { Folder, Note } from '@/lib/types'

  type Props = {
    params: { folderId: string }
  }

  export default async function FolderPage({ params }: Props) {
    const supabase = createClient()

    const [{ data: folder }, { data: notes }] = await Promise.all([
      supabase
        .from('folders')
        .select('id, name, parent_id, created_at, updated_at')
        .eq('id', params.folderId)
        .single(),
      supabase
        .from('notes')
        .select('id, title, content, folder_id, source, is_cleaned, created_at, updated_at')
        .eq('folder_id', params.folderId)
        .order('updated_at', { ascending: false }),
    ])

    if (!folder) notFound()

    return (
      <div className="max-w-2xl mx-auto p-8">
        <h2 className="text-2xl font-serif font-semibold text-stone-800 mb-6">
          {folder.name}
        </h2>
        <NoteList folder={folder as Folder} notes={(notes ?? []) as Note[]} />
      </div>
    )
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add merkur-web/components/sidebar/NoteList.tsx merkur-web/app/'(app)'/folders/
  git commit -m "feat(web): add folder page and note list"
  ```

---

## Task 16: Root redirect page

**Files:**
- Create: `merkur-web/app/(app)/page.tsx`

- [ ] **Step 1: Create `app/(app)/page.tsx`**

  ```typescript
  import { redirect } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import EmptyState from '@/components/ui/EmptyState'

  export default async function HomePage() {
    const supabase = createClient()

    const { data: folders } = await supabase
      .from('folders')
      .select('id')
      .is('parent_id', null)
      .order('name', { ascending: true })
      .limit(1)

    if (folders && folders.length > 0) {
      redirect(`/folders/${folders[0].id}`)
    }

    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          title="No folders yet"
          description="Create a folder in the sidebar to get started."
        />
      </div>
    )
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add merkur-web/app/'(app)'/page.tsx
  git commit -m "feat(web): add root redirect to first folder"
  ```

---

## Task 17: NoteEditor (TipTap)

**Files:**
- Create: `merkur-web/components/editor/NoteEditor.tsx`
- Create: `merkur-web/app/(app)/notes/[noteId]/page.tsx`

- [ ] **Step 1: Create `components/editor/NoteEditor.tsx`**

  ```typescript
  'use client'

  import { useState, useCallback, useRef } from 'react'
  import { useRouter } from 'next/navigation'
  import { useEditor, EditorContent } from '@tiptap/react'
  import StarterKit from '@tiptap/starter-kit'
  import type { Folder, Note } from '@/lib/types'

  type Props = {
    note: Note
    folders: Folder[]
  }

  export default function NoteEditor({ note, folders }: Props) {
    const router = useRouter()
    const [title, setTitle] = useState(note.title)
    const [folderId, setFolderId] = useState<string | null>(note.folder_id)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const save = useCallback(
      async (updates: { title?: string; content?: string; folder_id?: string | null }) => {
        await fetch('/api/notes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: note.id, ...updates }),
        })
        setLastSaved(new Date())
      },
      [note.id]
    )

    const debouncedSave = useCallback(
      (updates: { title?: string; content?: string }) => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => void save(updates), 500)
      },
      [save]
    )

    const editor = useEditor({
      extensions: [StarterKit],
      content: note.content ?? '',
      onUpdate({ editor }) {
        debouncedSave({ content: editor.getHTML() })
      },
    })

    function handleTitleChange(value: string) {
      setTitle(value)
      debouncedSave({ title: value })
    }

    async function handleFolderChange(value: string) {
      const newFolderId = value === '' ? null : value
      setFolderId(newFolderId)
      await save({ folder_id: newFolderId })
      router.refresh()
    }

    async function deleteNote() {
      if (!confirm('Delete this note?')) return
      await fetch('/api/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: note.id }),
      })
      router.push(folderId ? `/folders/${folderId}` : '/')
      router.refresh()
    }

    return (
      <div className="max-w-2xl mx-auto p-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 text-sm text-stone-400">
          <select
            value={folderId ?? ''}
            onChange={(e) => void handleFolderChange(e.target.value)}
            className="bg-transparent border-none outline-none cursor-pointer hover:text-stone-600 text-sm"
          >
            <option value="">Inbox (no folder)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-4">
            {lastSaved && (
              <span>
                Saved{' '}
                {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => void deleteNote()}
              className="hover:text-red-500 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="w-full text-3xl font-serif font-semibold text-stone-800 bg-transparent border-none outline-none mb-6 placeholder:text-stone-300"
          placeholder="Untitled"
        />

        {/* Editor */}
        <div className="prose prose-stone max-w-none font-serif">
          <EditorContent editor={editor} />
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Create `app/(app)/notes/[noteId]/page.tsx`**

  ```typescript
  import { notFound } from 'next/navigation'
  import { createClient } from '@/lib/supabase/server'
  import NoteEditor from '@/components/editor/NoteEditor'
  import type { Folder, Note } from '@/lib/types'

  type Props = {
    params: { noteId: string }
  }

  export default async function NotePage({ params }: Props) {
    const supabase = createClient()

    const [{ data: note }, { data: folders }] = await Promise.all([
      supabase.from('notes').select('*').eq('id', params.noteId).single(),
      supabase
        .from('folders')
        .select('id, name, parent_id, created_at, updated_at')
        .order('name', { ascending: true }),
    ])

    if (!note) notFound()

    return (
      <NoteEditor note={note as Note} folders={(folders ?? []) as Folder[]} />
    )
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add merkur-web/components/editor/ merkur-web/app/'(app)'/notes/
  git commit -m "feat(web): add tiptap note editor with auto-save"
  ```

---

## Task 18: Pre-commit hooks

**Files:**
- Create: `.pre-commit-config.yaml` (monorepo root)

- [ ] **Step 1: Install pre-commit**

  ```bash
  pip install pre-commit
  ```

- [ ] **Step 2: Create `.pre-commit-config.yaml`**

  ```yaml
  repos:
    # General file hygiene
    - repo: https://github.com/pre-commit/pre-commit-hooks
      rev: v4.6.0
      hooks:
        - id: check-added-large-files
          args: ['--maxkb=500']
        - id: check-merge-conflict
        - id: end-of-file-fixer
        - id: trailing-whitespace

    # Secret detection
    - repo: https://github.com/Yelp/detect-secrets
      rev: v1.5.0
      hooks:
        - id: detect-secrets
          args: ['--baseline', '.secrets.baseline']

    # Python — ruff (lint + format) for merkur-brain
    - repo: https://github.com/astral-sh/ruff-pre-commit
      rev: v0.4.4
      hooks:
        - id: ruff
          args: [--fix]
          files: ^merkur-brain/
        - id: ruff-format
          files: ^merkur-brain/

    # TypeScript — eslint, prettier, tsc, jest (merkur-web)
    - repo: local
      hooks:
        - id: eslint
          name: eslint
          entry: bash -c 'cd merkur-web && npm run lint'
          language: system
          files: ^merkur-web/.*\.(ts|tsx)$
          pass_filenames: false

        - id: prettier-check
          name: prettier
          entry: bash -c 'cd merkur-web && npm run format:check'
          language: system
          files: ^merkur-web/.*\.(ts|tsx|json|md)$
          pass_filenames: false

        - id: typecheck
          name: tsc typecheck
          entry: bash -c 'cd merkur-web && npm run typecheck'
          language: system
          files: ^merkur-web/.*\.(ts|tsx)$
          pass_filenames: false

        - id: jest-unit
          name: jest unit tests
          entry: bash -c 'cd merkur-web && npm run test:unit'
          language: system
          files: ^merkur-web/.*\.(ts|tsx)$
          pass_filenames: false

    # Commit message linting
    - repo: https://github.com/alessandrojcm/commitlint-pre-commit-hook
      rev: v9.18.0
      hooks:
        - id: commitlint
          stages: [commit-msg]
          additional_dependencies: ['@commitlint/config-conventional']
  ```

- [ ] **Step 3: Create detect-secrets baseline**

  ```bash
  cd /path/to/Merkur
  detect-secrets scan > .secrets.baseline
  ```

- [ ] **Step 4: Install hooks**

  ```bash
  pre-commit install
  pre-commit install --hook-type commit-msg
  ```

- [ ] **Step 5: Run hooks against all files to verify**

  ```bash
  pre-commit run --all-files
  ```

  Expected: all hooks pass (eslint, prettier, tsc, jest unit tests). Fix any issues before proceeding.

- [ ] **Step 6: Commit**

  ```bash
  git add .pre-commit-config.yaml .secrets.baseline
  git commit -m "chore(infra): add pre-commit hooks"
  ```

---

## Task 19: Smoke test (manual)

- [ ] **Step 1: Start the dev server**

  ```bash
  cd merkur-web
  npm run dev
  ```

  Open `http://localhost:3000`. You should be redirected to `/login`.

- [ ] **Step 2: Test auth flow**

  Enter your email on the login page. Click "Send magic link." Check your inbox — click the link. You should be redirected to the app. If there are no folders yet, the empty state message appears.

- [ ] **Step 3: Test folder CRUD**

  - Click "+" in the sidebar → enter a folder name → folder appears and you're redirected to it.
  - Double-click the folder name → rename it → press Enter.
  - Click "+" on a folder → create a sub-folder.
  - Hover over a folder → click ✕ → confirm deletion.

- [ ] **Step 4: Test note CRUD**

  - Open a folder → click "New note" → redirected to empty note editor.
  - Type a title and some content — wait 500ms — "Saved HH:MM" appears.
  - Navigate back to the folder — the note appears in the list.
  - Open the note → use the folder dropdown to move it to another folder.
  - Open the note → click Delete → confirm.

- [ ] **Step 5: Test typecheck and unit tests pass**

  ```bash
  npm run typecheck
  npm run test:unit
  ```

  Both should complete with no errors.

---

## Done

MVP `merkur-web` is complete. Next step: implement `merkur-brain` (FastAPI + WhatsApp webhook + intake/cleanup agents).

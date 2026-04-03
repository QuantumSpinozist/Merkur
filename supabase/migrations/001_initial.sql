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

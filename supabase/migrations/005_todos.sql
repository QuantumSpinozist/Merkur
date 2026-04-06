create table todos (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references notes(id) on delete cascade not null,
  text text not null,
  done boolean not null default false,
  done_at timestamptz,
  recurrence text check (recurrence in ('daily', 'weekly', 'monthly')),
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index todos_note_id_idx on todos(note_id);
create index todos_done_recurrence_idx on todos(done, recurrence) where recurrence is not null;

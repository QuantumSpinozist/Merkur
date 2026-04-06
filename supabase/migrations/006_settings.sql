-- Key-value store for runtime configuration (reminder time, chat id, etc.)
create table settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

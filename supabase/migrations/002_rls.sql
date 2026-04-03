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

-- Enable RLS on todos so authenticated users can manage them via the web app
alter table todos enable row level security;

create policy "authenticated users can manage todos"
  on todos for all
  to authenticated
  using (true)
  with check (true);

-- Enable RLS on settings (brain uses service role which bypasses RLS anyway)
alter table settings enable row level security;

create policy "authenticated users can read settings"
  on settings for select
  to authenticated
  using (true);

-- Auto-update updated_at on row changes
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger folders_updated_at
  before update on folders
  for each row execute function set_updated_at();

create trigger notes_updated_at
  before update on notes
  for each row execute function set_updated_at();

-- Index for the common query: "all notes in folder X"
create index notes_folder_id_idx on notes(folder_id);

-- Note: merkur-brain uses the service_role key which bypasses RLS entirely.
-- These policies cover merkur-web (authenticated Supabase Auth sessions).
-- Do not change merkur-brain to use the anon key without revisiting 002_rls.sql.

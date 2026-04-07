-- Add position column for manual ordering of folders and notes
alter table folders add column position integer not null default 0;
alter table notes add column position integer not null default 0;

-- Initialise folder positions per parent group (alphabetical)
update folders f
set position = sub.rn
from (
  select id,
    row_number() over (partition by parent_id order by name) - 1 as rn
  from folders
) sub
where f.id = sub.id;

-- Initialise note positions per folder (newest first, matching current default sort)
update notes n
set position = sub.rn
from (
  select id,
    row_number() over (partition by folder_id order by updated_at desc) - 1 as rn
  from notes
) sub
where n.id = sub.id;

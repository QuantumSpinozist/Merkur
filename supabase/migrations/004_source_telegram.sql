-- Switch source check constraint from whatsapp to telegram
alter table notes drop constraint notes_source_check;
alter table notes add constraint notes_source_check
  check (source in ('web', 'telegram'));

-- Create a public storage bucket for note images.
-- Safe to re-run: uses ON CONFLICT / DROP IF EXISTS.

insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload images" on storage.objects;
drop policy if exists "Public read for note images" on storage.objects;
drop policy if exists "Authenticated users can delete images" on storage.objects;

-- Allow authenticated users to upload
create policy "Authenticated users can upload images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'note-images');

-- Public read (images are embedded in notes via public URL)
create policy "Public read for note images"
  on storage.objects for select
  to public
  using (bucket_id = 'note-images');

-- Owner can delete their own uploads
create policy "Authenticated users can delete images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'note-images');

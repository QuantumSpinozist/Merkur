-- Create a public storage bucket for note images.
-- Run once in the Supabase SQL editor.

insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', true)
on conflict (id) do nothing;

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

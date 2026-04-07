import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NoteList from '@/components/sidebar/NoteList'
import type { Folder, Note } from '@/lib/types'

type Props = {
  params: { folderId: string }
}

export default async function FolderPage({ params }: Props) {
  const supabase = createClient()

  const [{ data: folder }, { data: notes }] = await Promise.all([
    supabase
      .from('folders')
      .select('id, name, parent_id, created_at, updated_at')
      .eq('id', params.folderId)
      .single(),
    supabase
      .from('notes')
      .select('id, title, content, folder_id, source, is_cleaned, created_at, updated_at')
      .eq('folder_id', params.folderId)
      .order('position', { ascending: true }),
  ])

  if (!folder) notFound()

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h2 className="text-2xl font-serif font-semibold text-stone-800 mb-6">{folder.name}</h2>
      <NoteList folder={folder as Folder} notes={(notes ?? []) as Note[]} />
    </div>
  )
}

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NoteEditor from '@/components/editor/NoteEditor'
import type { Folder, Note } from '@/lib/types'

type Props = {
  params: { noteId: string }
}

export default async function NotePage({ params }: Props) {
  const supabase = createClient()

  const [{ data: note }, { data: folders }] = await Promise.all([
    supabase.from('notes').select('*').eq('id', params.noteId).single(),
    supabase
      .from('folders')
      .select('id, name, parent_id, created_at, updated_at')
      .order('name', { ascending: true }),
  ])

  if (!note) notFound()

  return <NoteEditor note={note as Note} folders={(folders ?? []) as Folder[]} />
}

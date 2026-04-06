import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NoteEditor from '@/components/editor/NoteEditor'
import type { Folder, Note, Todo } from '@/lib/types'

type Props = {
  params: { noteId: string }
}

export default async function NotePage({ params }: Props) {
  const supabase = createClient()

  const [{ data: note }, { data: folders }, { data: todos }] = await Promise.all([
    supabase.from('notes').select('*').eq('id', params.noteId).single(),
    supabase
      .from('folders')
      .select('id, name, parent_id, created_at, updated_at')
      .order('name', { ascending: true }),
    supabase
      .from('todos')
      .select('id, note_id, text, done, done_at, recurrence, due_date, created_at, updated_at')
      .eq('note_id', params.noteId)
      .order('created_at', { ascending: true }),
  ])

  if (!note) notFound()

  return (
    <NoteEditor
      note={note as Note}
      folders={(folders ?? []) as Folder[]}
      initialTodos={(todos ?? []) as Todo[]}
    />
  )
}

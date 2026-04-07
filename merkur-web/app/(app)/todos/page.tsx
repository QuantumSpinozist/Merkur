import { createClient } from '@/lib/supabase/server'
import TodosView from '@/components/todos/TodosView'
import { resetExpiredRecurring } from '@/lib/resetRecurring'
import type { TodoWithNote } from '@/lib/types'

export default async function TodosPage() {
  const supabase = createClient()

  await resetExpiredRecurring(supabase)

  // Fetch all todos joined with note title and folder name
  const { data: todos } = await supabase
    .from('todos')
    .select(
      `
      id, note_id, text, done, done_at, recurrence, due_date, created_at, updated_at,
      notes!inner (
        title,
        folder_id,
        folders ( name )
      )
    `
    )
    .order('created_at', { ascending: true })

  type RawTodo = {
    id: string
    note_id: string
    text: string
    done: boolean
    done_at: string | null
    recurrence: string | null
    due_date: string | null
    created_at: string
    updated_at: string
    notes: {
      title: string
      folder_id: string | null
      folders: { name: string } | null
    }
  }

  const normalised: TodoWithNote[] = ((todos ?? []) as unknown as RawTodo[]).map((t) => ({
    id: t.id,
    note_id: t.note_id,
    text: t.text,
    done: t.done,
    done_at: t.done_at,
    recurrence: t.recurrence as TodoWithNote['recurrence'],
    due_date: t.due_date,
    created_at: t.created_at,
    updated_at: t.updated_at,
    note_title: t.notes.title,
    folder_id: t.notes.folder_id,
    folder_name: t.notes.folders?.name ?? null,
  }))

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-serif font-semibold text-stone-800 dark:text-stone-100 mb-6">
        Todos
      </h1>
      <TodosView initialTodos={normalised} />
    </div>
  )
}

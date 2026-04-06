export type Folder = {
  id: string
  name: string
  parent_id: string | null
  created_at: string
  updated_at: string
}

export type Note = {
  id: string
  title: string
  content: string | null
  folder_id: string | null
  source: 'web' | 'telegram'
  is_cleaned: boolean
  created_at: string
  updated_at: string
}

export type TodoRecurrence = 'daily' | 'weekly' | 'monthly'

export type Todo = {
  id: string
  note_id: string
  text: string
  done: boolean
  done_at: string | null
  recurrence: TodoRecurrence | null
  due_date: string | null
  created_at: string
  updated_at: string
}

export type TodoWithNote = Todo & {
  note_title: string
  note_id: string
  folder_id: string | null
  folder_name: string | null
}

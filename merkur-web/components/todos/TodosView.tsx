'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Todo, TodoRecurrence, TodoWithNote } from '@/lib/types'

type Props = {
  initialTodos: TodoWithNote[]
}

type Group = {
  folderName: string | null
  noteId: string
  noteTitle: string
  todos: TodoWithNote[]
}

function groupTodos(todos: TodoWithNote[]): Group[] {
  const map = new Map<string, Group>()

  for (const todo of todos) {
    const existing = map.get(todo.note_id)
    if (existing) {
      existing.todos.push(todo)
    } else {
      map.set(todo.note_id, {
        folderName: todo.folder_name,
        noteId: todo.note_id,
        noteTitle: todo.note_title,
        todos: [todo],
      })
    }
  }

  // Sort groups: folders alphabetically (null/"Inbox" last), then note title
  return Array.from(map.values()).sort((a, b) => {
    const fa = a.folderName ?? '\uffff'
    const fb = b.folderName ?? '\uffff'
    if (fa !== fb) return fa.localeCompare(fb)
    return a.noteTitle.localeCompare(b.noteTitle)
  })
}

export default function TodosView({ initialTodos }: Props) {
  const [todos, setTodos] = useState<TodoWithNote[]>(initialTodos)

  async function toggleDone(todo: TodoWithNote) {
    const res = await fetch('/api/todos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: todo.id, done: !todo.done }),
    })
    if (!res.ok) return

    const updated = (await res.json()) as Todo
    setTodos((prev) =>
      prev.map((t) =>
        t.id === updated.id ? { ...t, done: updated.done, done_at: updated.done_at } : t
      )
    )
  }

  async function deleteTodo(id: string) {
    const res = await fetch('/api/todos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) return
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }

  const groups = groupTodos(todos)

  if (groups.length === 0) {
    return (
      <p className="text-stone-400 text-sm mt-4">No todos yet. Open a note and add todos there.</p>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.noteId}>
          <div className="mb-1">
            {group.folderName && (
              <span className="text-xs text-stone-400 uppercase tracking-wide font-medium">
                {group.folderName} /{' '}
              </span>
            )}
            <Link
              href={`/notes/${group.noteId}`}
              className="text-sm font-medium text-stone-700 hover:text-amber-700"
            >
              {group.noteTitle}
            </Link>
          </div>
          <ul className="space-y-1 pl-1">
            {group.todos
              .filter((t) => !t.done)
              .map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  onToggle={() => void toggleDone(todo)}
                  onDelete={() => void deleteTodo(todo.id)}
                />
              ))}
            {group.todos
              .filter((t) => t.done)
              .map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  onToggle={() => void toggleDone(todo)}
                  onDelete={() => void deleteTodo(todo.id)}
                />
              ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

type RowProps = {
  todo: TodoWithNote
  onToggle: () => void
  onDelete: () => void
}

function TodoRow({ todo, onToggle, onDelete }: RowProps) {
  const isOverdue =
    todo.due_date && !todo.done && new Date(todo.due_date) < new Date(new Date().toDateString())

  return (
    <li className="group flex items-center gap-2 py-0.5 rounded hover:bg-stone-50 px-1">
      <input
        type="checkbox"
        checked={todo.done}
        onChange={onToggle}
        className="shrink-0 accent-amber-500 cursor-pointer"
      />
      <span
        className={`flex-1 text-sm ${todo.done ? 'line-through text-stone-400' : 'text-stone-700'}`}
      >
        {todo.text}
      </span>
      {todo.due_date && (
        <span className={`text-xs shrink-0 ${isOverdue ? 'text-red-500' : 'text-stone-400'}`}>
          {todo.due_date}
        </span>
      )}
      {todo.recurrence && (
        <span className="text-xs text-amber-600 shrink-0">{todo.recurrence as TodoRecurrence}</span>
      )}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-400 text-xs shrink-0"
        title="Delete todo"
      >
        ✕
      </button>
    </li>
  )
}

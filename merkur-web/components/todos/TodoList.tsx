'use client'

import { useState } from 'react'
import type { Todo, TodoRecurrence } from '@/lib/types'

type Props = {
  noteId: string
  initialTodos: Todo[]
}

export default function TodoList({ noteId, initialTodos }: Props) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos)
  const [newText, setNewText] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newRecurrence, setNewRecurrence] = useState<TodoRecurrence | ''>('')
  const [showAddForm, setShowAddForm] = useState(false)

  async function addTodo() {
    const text = newText.trim()
    if (!text) return

    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note_id: noteId,
        text,
        due_date: newDueDate || null,
        recurrence: newRecurrence || null,
      }),
    })
    if (!res.ok) return

    const created = (await res.json()) as Todo
    setTodos((prev) => [...prev, created])
    setNewText('')
    setNewDueDate('')
    setNewRecurrence('')
    setShowAddForm(false)
  }

  async function toggleDone(todo: Todo) {
    const res = await fetch('/api/todos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: todo.id, done: !todo.done }),
    })
    if (!res.ok) return

    const updated = (await res.json()) as Todo
    setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
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

  async function updateRecurrence(todo: Todo, recurrence: TodoRecurrence | '') {
    const res = await fetch('/api/todos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: todo.id, recurrence: recurrence || null }),
    })
    if (!res.ok) return
    const updated = (await res.json()) as Todo
    setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  async function updateDueDate(todo: Todo, due_date: string) {
    const res = await fetch('/api/todos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: todo.id, due_date: due_date || null }),
    })
    if (!res.ok) return
    const updated = (await res.json()) as Todo
    setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  const pending = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done)

  return (
    <div className="mt-8 border-t border-stone-200 dark:border-stone-700 pt-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wide">
          Todos
        </span>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 text-base leading-none"
          title="Add todo"
        >
          +
        </button>
      </div>

      {showAddForm && (
        <div className="mb-3 p-3 bg-stone-50 dark:bg-stone-800/50 rounded border border-stone-200 dark:border-stone-700 space-y-2">
          <input
            autoFocus
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addTodo()
              if (e.key === 'Escape') setShowAddForm(false)
            }}
            placeholder="What needs to be done?"
            className="w-full text-sm bg-white dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500 border border-stone-300 dark:border-stone-600 rounded px-2 py-1 outline-none focus:border-amber-400"
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="text-xs bg-white dark:bg-stone-800 dark:text-stone-300 border border-stone-300 dark:border-stone-600 rounded px-2 py-1 outline-none focus:border-amber-400 text-stone-500"
            />
            <select
              value={newRecurrence}
              onChange={(e) => setNewRecurrence(e.target.value as TodoRecurrence | '')}
              className="text-xs bg-white dark:bg-stone-800 dark:text-stone-300 border border-stone-300 dark:border-stone-600 rounded px-2 py-1 outline-none focus:border-amber-400 text-stone-500"
            >
              <option value="">no repeat</option>
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
            </select>
            <button
              onClick={() => void addTodo()}
              disabled={!newText.trim()}
              className="ml-auto text-xs bg-amber-400 hover:bg-amber-500 disabled:opacity-40 text-white rounded px-3 py-1"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {todos.length === 0 && !showAddForm && (
        <p className="text-xs text-stone-400 dark:text-stone-500 py-1">
          No todos yet. Click + to add one.
        </p>
      )}

      <ul className="space-y-1">
        {pending.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={() => void toggleDone(todo)}
            onDelete={() => void deleteTodo(todo.id)}
            onRecurrenceChange={(r) => void updateRecurrence(todo, r)}
            onDueDateChange={(d) => void updateDueDate(todo, d)}
          />
        ))}
        {done.length > 0 && (
          <>
            <li className="pt-2 pb-1">
              <span className="text-xs text-stone-400">Done ({done.length})</span>
            </li>
            {done.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={() => void toggleDone(todo)}
                onDelete={() => void deleteTodo(todo.id)}
                onRecurrenceChange={(r) => void updateRecurrence(todo, r)}
                onDueDateChange={(d) => void updateDueDate(todo, d)}
              />
            ))}
          </>
        )}
      </ul>
    </div>
  )
}

type ItemProps = {
  todo: Todo
  onToggle: () => void
  onDelete: () => void
  onRecurrenceChange: (r: TodoRecurrence | '') => void
  onDueDateChange: (d: string) => void
}

function TodoItem({ todo, onToggle, onDelete, onRecurrenceChange, onDueDateChange }: ItemProps) {
  const isOverdue =
    todo.due_date && !todo.done && new Date(todo.due_date) < new Date(new Date().toDateString())

  return (
    <li className="group flex items-start gap-2 py-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800/50 px-1">
      <input
        type="checkbox"
        checked={todo.done}
        onChange={onToggle}
        className="mt-0.5 shrink-0 accent-amber-500 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm ${todo.done ? 'line-through text-stone-400' : 'text-stone-700 dark:text-stone-200'}`}
        >
          {todo.text}
        </span>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {todo.due_date && (
            <input
              type="date"
              defaultValue={todo.due_date}
              onBlur={(e) => onDueDateChange(e.target.value)}
              className={`text-xs border-0 bg-transparent outline-none cursor-pointer ${
                isOverdue ? 'text-red-500' : 'text-stone-400'
              }`}
            />
          )}
          {!todo.due_date && (
            <input
              type="date"
              placeholder="due date"
              onBlur={(e) => {
                if (e.target.value) onDueDateChange(e.target.value)
              }}
              className="text-xs border-0 bg-transparent outline-none cursor-pointer text-stone-300 opacity-0 group-hover:opacity-100 w-24"
            />
          )}
          {todo.recurrence && (
            <select
              defaultValue={todo.recurrence}
              onChange={(e) => onRecurrenceChange(e.target.value as TodoRecurrence | '')}
              className="text-xs border-0 bg-transparent outline-none cursor-pointer text-amber-600"
            >
              <option value="">no repeat</option>
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
            </select>
          )}
          {!todo.recurrence && (
            <select
              defaultValue=""
              onChange={(e) => onRecurrenceChange(e.target.value as TodoRecurrence | '')}
              className="text-xs border-0 bg-transparent outline-none cursor-pointer text-stone-300 opacity-0 group-hover:opacity-100"
            >
              <option value="">no repeat</option>
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
            </select>
          )}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-400 text-xs shrink-0 mt-0.5"
        title="Delete todo"
      >
        ✕
      </button>
    </li>
  )
}

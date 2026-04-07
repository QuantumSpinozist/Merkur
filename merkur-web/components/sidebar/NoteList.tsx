'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Folder, Note } from '@/lib/types'
import { truncateTitle } from '@/lib/utils'
import Button from '@/components/ui/Button'

type Props = {
  folder: Folder
  notes: Note[]
}

async function persistOrder(ids: string[]) {
  await fetch('/api/reorder', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'note', ordered_ids: ids }),
  })
}

export default function NoteList({ folder, notes: initialNotes }: Props) {
  const router = useRouter()
  const [notes, setNotes] = useState<Note[]>(initialNotes)

  const dragId = useRef<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  async function createNote() {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folder.id }),
    })
    const note = (await res.json()) as Note
    router.push(`/notes/${note.id}`)
  }

  function reorderNotes(draggedId: string, targetId: string) {
    const from = notes.findIndex((n) => n.id === draggedId)
    const to = notes.findIndex((n) => n.id === targetId)
    if (from === -1 || to === -1 || from === to) return

    const reordered = [...notes]
    const [item] = reordered.splice(from, 1)
    reordered.splice(to, 0, item)

    setNotes(reordered)
    void persistOrder(reordered.map((n) => n.id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-stone-400">
          {notes.length} note{notes.length !== 1 ? 's' : ''}
        </span>
        <Button size="sm" onClick={() => void createNote()}>
          New note
        </Button>
      </div>

      {notes.length === 0 ? (
        <p className="text-stone-400 text-sm">No notes in this folder yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li
              key={note.id}
              draggable
              onDragStart={(e) => {
                dragId.current = note.id
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => {
                dragId.current = null
                setDropTarget(null)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragId.current && dragId.current !== note.id) {
                  setDropTarget(note.id)
                }
              }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => {
                e.preventDefault()
                if (dragId.current && dragId.current !== note.id) {
                  reorderNotes(dragId.current, note.id)
                }
                setDropTarget(null)
              }}
              className={[
                'cursor-grab active:cursor-grabbing rounded-lg transition-shadow',
                dropTarget === note.id ? 'ring-2 ring-amber-400' : '',
              ].join(' ')}
            >
              <Link
                href={`/notes/${note.id}`}
                draggable={false}
                className="block p-3 bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700 hover:border-amber-300 dark:hover:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors"
              >
                <p className="font-medium text-stone-800 dark:text-stone-100 text-sm">
                  {truncateTitle(note.title, 60)}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {new Date(note.updated_at).toLocaleDateString('de-DE', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

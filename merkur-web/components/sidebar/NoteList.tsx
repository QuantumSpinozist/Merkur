'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Folder, Note } from '@/lib/types'
import { truncateTitle } from '@/lib/utils'
import Button from '@/components/ui/Button'

type Props = {
  folder: Folder
  notes: Note[]
}

export default function NoteList({ folder, notes }: Props) {
  const router = useRouter()

  async function createNote() {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folder.id }),
    })
    const note = (await res.json()) as Note
    router.push(`/notes/${note.id}`)
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
            <li key={note.id}>
              <Link
                href={`/notes/${note.id}`}
                className="block p-3 bg-white rounded-lg border border-stone-200 hover:border-amber-300 hover:bg-amber-50 transition-colors"
              >
                <p className="font-medium text-stone-800 text-sm">
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

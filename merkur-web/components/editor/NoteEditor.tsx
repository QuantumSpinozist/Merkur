'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { Folder, Note } from '@/lib/types'

type Props = {
  note: Note
  folders: Folder[]
}

export default function NoteEditor({ note, folders }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(note.title)
  const [folderId, setFolderId] = useState<string | null>(note.folder_id)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(
    async (updates: { title?: string; content?: string; folder_id?: string | null }) => {
      await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: note.id, ...updates }),
      })
      setLastSaved(new Date())
    },
    [note.id]
  )

  const debouncedSave = useCallback(
    (updates: { title?: string; content?: string }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => void save(updates), 500)
    },
    [save]
  )

  const editor = useEditor({
    extensions: [StarterKit],
    content: note.content ?? '',
    onUpdate({ editor }) {
      debouncedSave({ content: editor.getHTML() })
    },
  })

  function handleTitleChange(value: string) {
    setTitle(value)
    debouncedSave({ title: value })
  }

  async function handleFolderChange(value: string) {
    const newFolderId = value === '' ? null : value
    setFolderId(newFolderId)
    await save({ folder_id: newFolderId })
    router.refresh()
  }

  async function deleteNote() {
    if (!confirm('Delete this note?')) return
    await fetch('/api/notes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: note.id }),
    })
    router.push(folderId ? `/folders/${folderId}` : '/')
    router.refresh()
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 text-sm text-stone-400">
        <select
          value={folderId ?? ''}
          onChange={(e) => void handleFolderChange(e.target.value)}
          className="bg-transparent border-none outline-none cursor-pointer hover:text-stone-600 text-sm"
        >
          <option value="">Inbox (no folder)</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-4">
          {lastSaved && (
            <span>
              Saved{' '}
              {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => void deleteNote()}
            className="hover:text-red-500 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        className="w-full text-3xl font-serif font-semibold text-stone-800 bg-transparent border-none outline-none mb-6 placeholder:text-stone-300"
        placeholder="Untitled"
      />

      {/* Editor */}
      <div className="prose prose-stone max-w-none font-serif">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

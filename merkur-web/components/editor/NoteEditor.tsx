'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import { Markdown } from 'tiptap-markdown'
import TodoList from '@/components/todos/TodoList'
import type { Folder, Note, Todo } from '@/lib/types'

type Props = {
  note: Note
  folders: Folder[]
  initialTodos: Todo[]
}

const MIN_CONTENT_WIDTH = 320
const MAX_CONTENT_WIDTH = 1400
const DEFAULT_CONTENT_WIDTH = 672 // equivalent to max-w-2xl

export default function NoteEditor({ note, folders, initialTodos }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(note.title)
  const [folderId, setFolderId] = useState<string | null>(note.folder_id)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveAbortRef = useRef<AbortController | null>(null)

  // Content width drag — lazy init reads localStorage so value survives navigation
  const [contentWidth, setContentWidth] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_CONTENT_WIDTH
    const saved = localStorage.getItem('note-content-width')
    return saved ? parseInt(saved) : DEFAULT_CONTENT_WIDTH
  })
  const [isResizing, setIsResizing] = useState(false)
  const resizeDragging = useRef(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)

  useEffect(() => {
    localStorage.setItem('note-content-width', String(contentWidth))
  }, [contentWidth])

  const startResizeDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      resizeDragging.current = true
      setIsResizing(true)
      resizeStartX.current = e.clientX
      resizeStartWidth.current = contentWidth
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [contentWidth]
  )

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizeDragging.current) return
      // Content is centered, so dragging right by N pixels widens by 2×N
      const delta = (e.clientX - resizeStartX.current) * 2
      setContentWidth(
        Math.max(MIN_CONTENT_WIDTH, Math.min(MAX_CONTENT_WIDTH, resizeStartWidth.current + delta))
      )
    }
    function onUp() {
      if (!resizeDragging.current) return
      resizeDragging.current = false
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // Note saving
  const save = useCallback(
    async (updates: { title?: string; content?: string; folder_id?: string | null }) => {
      saveAbortRef.current?.abort()
      const controller = new AbortController()
      saveAbortRef.current = controller

      try {
        const res = await fetch('/api/notes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: note.id, ...updates }),
          signal: controller.signal,
        })
        if (res.ok) setLastSaved(new Date())
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
      }
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
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Markdown.configure({ transformPastedText: true }),
    ],
    content: note.content ?? '',
    immediatelyRender: false,
    onUpdate({ editor }) {
      const md = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown
      debouncedSave({ content: md.getMarkdown() })
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
    <div className="flex justify-center min-h-full py-8">
      <div
        className="relative w-full px-8"
        style={{
          maxWidth: contentWidth,
          transition: isResizing ? 'none' : 'max-width 0ms',
        }}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 text-sm text-stone-400 dark:text-stone-500">
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
                Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
          className="w-full text-3xl font-serif font-semibold text-stone-800 dark:text-stone-100 bg-transparent border-none outline-none mb-6 placeholder:text-stone-300 dark:placeholder:text-stone-600"
          placeholder="Untitled"
        />

        {/* Editor */}
        <div className="prose prose-stone dark:prose-invert max-w-none font-serif">
          <EditorContent editor={editor} />
        </div>

        <TodoList noteId={note.id} initialTodos={initialTodos} />

        {/* Right-edge drag handle */}
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-amber-400 dark:hover:bg-amber-600 transition-colors"
          onMouseDown={startResizeDrag}
          title="Drag to resize"
        />
      </div>
    </div>
  )
}

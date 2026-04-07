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
import { ResizableImage } from './ResizableImage'
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
  const [cleaning, setCleaning] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
      ResizableImage.configure({ inline: false, allowBase64: false }),
      Markdown.configure({ transformPastedText: true }),
    ],
    content: note.content ?? '',
    immediatelyRender: false,
    onUpdate({ editor }) {
      const md = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown
      debouncedSave({ content: md.getMarkdown() })
    },
    editorProps: {
      handlePaste(_view, event) {
        const items = Array.from(event.clipboardData?.items ?? [])
        const imageFiles = items
          .filter((i) => i.kind === 'file' && i.type.startsWith('image/'))
          .map((i) => i.getAsFile())
          .filter((f): f is File => f !== null)
        if (!imageFiles.length) return false
        void handleImageFiles(imageFiles)
        return true
      },
      handleDrop(_view, event) {
        const files = Array.from(event.dataTransfer?.files ?? [])
        const imageFiles = files.filter((f) => f.type.startsWith('image/'))
        if (!imageFiles.length) return false
        event.preventDefault()
        void handleImageFiles(imageFiles)
        return true
      },
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

  async function cleanupNote() {
    if (!editor) return
    const md = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown
    const currentContent = md.getMarkdown()
    setCleaning(true)
    try {
      const res = await fetch('/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: note.id, title, content: currentContent }),
      })
      if (!res.ok) return
      const { cleaned_content } = (await res.json()) as { cleaned_content: string }
      editor.commands.setContent(cleaned_content)
      setLastSaved(new Date())
    } finally {
      setCleaning(false)
    }
  }

  async function uploadImage(file: File): Promise<string | null> {
    const resized = await resizeImage(file, 1200)
    const form = new FormData()
    form.append('file', resized)
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const text = await res.text()
    if (!res.ok) {
      let message = `Upload failed (${res.status})`
      try {
        const json = JSON.parse(text) as { error?: string }
        if (json.error) message = json.error
      } catch {}
      throw new Error(message)
    }
    const { url } = JSON.parse(text) as { url: string }
    return url
  }

  async function handleImageFiles(files: File[]) {
    if (!editor) return
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (!images.length) return
    setUploading(true)
    setUploadError(null)
    try {
      for (const file of images) {
        const url = await uploadImage(file)
        if (url) editor.chain().focus().setImage({ src: url }).run()
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    await handleImageFiles(files)
    e.target.value = ''
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
            {uploadError && (
              <span className="text-red-500" title={uploadError}>
                ⚠ Image upload failed
              </span>
            )}
            {lastSaved && (
              <span>
                Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="hover:text-amber-600 transition-colors disabled:opacity-40"
              title="Insert image"
            >
              {uploading ? 'Uploading…' : 'Image'}
            </button>
            <button
              onClick={() => void cleanupNote()}
              disabled={cleaning}
              className="hover:text-amber-600 transition-colors disabled:opacity-40"
              title="Reformat note with AI"
            >
              {cleaning ? 'Cleaning…' : 'Clean up'}
            </button>
            <button
              onClick={() => void deleteNote()}
              className="hover:text-red-500 transition-colors"
            >
              Delete
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void handleFileInputChange(e)}
            />
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

// ---------------------------------------------------------------------------
// Image resize helper — scales down to maxPx on the longest edge, JPEG output
// ---------------------------------------------------------------------------

function resizeImage(file: File, maxPx: number): Promise<File> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      const scale = Math.min(1, maxPx / Math.max(width, height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          resolve(
            blob
              ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                  type: 'image/jpeg',
                })
              : file
          )
        },
        'image/jpeg',
        0.82
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }
    img.src = url
  })
}

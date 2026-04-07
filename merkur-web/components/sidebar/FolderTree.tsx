'use client'

import { useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import type { Folder } from '@/lib/types'

type Props = {
  folders: Folder[]
}

export default function FolderTree({ folders }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const topLevel = folders.filter((f) => f.parent_id === null)
  const childrenOf = (parentId: string) => folders.filter((f) => f.parent_id === parentId)

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function startRename(folder: Folder) {
    setRenaming(folder.id)
    setRenameValue(folder.name)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }

  async function commitRename(id: string) {
    if (!renameValue.trim()) {
      setRenaming(null)
      return
    }
    await fetch('/api/folders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: renameValue.trim() }),
    })
    setRenaming(null)
    router.refresh()
  }

  async function deleteFolder(id: string) {
    if (!confirm('Delete this folder and all its notes?')) return
    await fetch('/api/folders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    router.refresh()
    router.push('/')
  }

  async function createFolder() {
    const name = prompt('Folder name:')
    if (!name?.trim()) return
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    const folder = (await res.json()) as Folder
    router.refresh()
    router.push(`/folders/${folder.id}`)
  }

  async function createSubFolder(parentId: string) {
    const name = prompt('Sub-folder name:')
    if (!name?.trim()) return
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), parent_id: parentId }),
    })
    const folder = (await res.json()) as Folder
    setExpanded((prev) => new Set(prev).add(parentId))
    router.refresh()
    router.push(`/folders/${folder.id}`)
  }

  function renderFolder(folder: Folder, depth = 0) {
    const children = childrenOf(folder.id)
    const isExpanded = expanded.has(folder.id)
    const isActive = pathname === `/folders/${folder.id}`

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded group ${
            isActive
              ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-900 dark:text-amber-300'
              : 'hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400'
          }`}
          style={{ paddingLeft: `${(depth + 1) * 10}px` }}
        >
          {children.length > 0 ? (
            <button
              onClick={() => toggleExpand(folder.id)}
              className="text-stone-400 hover:text-stone-600 w-4 shrink-0 text-xs"
            >
              {isExpanded ? '▾' : '▸'}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {renaming === folder.id ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => void commitRename(folder.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commitRename(folder.id)
                if (e.key === 'Escape') setRenaming(null)
              }}
              className="flex-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 dark:text-stone-100 rounded px-1 text-sm"
              autoFocus
            />
          ) : (
            <Link
              href={`/folders/${folder.id}`}
              className="flex-1 text-sm truncate"
              onDoubleClick={() => startRename(folder)}
            >
              {folder.name}
            </Link>
          )}

          <div className="hidden group-hover:flex items-center gap-0.5">
            {depth === 0 && (
              <button
                onClick={() => void createSubFolder(folder.id)}
                className="text-stone-400 hover:text-stone-600 text-xs px-1"
                title="Add sub-folder"
              >
                +
              </button>
            )}
            <button
              onClick={() => void deleteFolder(folder.id)}
              className="text-stone-400 hover:text-red-500 text-xs px-1"
              title="Delete folder"
            >
              ✕
            </button>
          </div>
        </div>

        {isExpanded && children.map((child) => renderFolder(child, depth + 1))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between px-2 py-1 mb-1">
        <span className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wide">
          Folders
        </span>
        <button
          onClick={() => void createFolder()}
          className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 text-base leading-none"
          title="New folder"
        >
          +
        </button>
      </div>
      {topLevel.map((folder) => renderFolder(folder))}
      {topLevel.length === 0 && <p className="text-xs text-stone-400 px-2 py-1">No folders yet.</p>}
    </div>
  )
}

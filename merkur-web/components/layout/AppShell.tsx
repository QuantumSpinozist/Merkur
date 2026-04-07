'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

type Props = {
  sidebar: React.ReactNode
  children: React.ReactNode
}

const MIN_WIDTH = 160
const MAX_WIDTH = 500
const DEFAULT_WIDTH = 256

export default function AppShell({ sidebar, children }: Props) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem('sidebar-open')
    return saved !== null ? saved === 'true' : true
  })
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_WIDTH
    const saved = localStorage.getItem('sidebar-width')
    return saved ? parseInt(saved) : DEFAULT_WIDTH
  })
  const [isDragging, setIsDragging] = useState(false)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  useEffect(() => {
    localStorage.setItem('sidebar-width', String(width))
  }, [width])

  useEffect(() => {
    localStorage.setItem('sidebar-open', String(open))
  }, [open])

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true
      setIsDragging(true)
      startX.current = e.clientX
      startWidth.current = width
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [width]
  )

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth.current + delta)))
    }
    function onUp() {
      if (!dragging.current) return
      dragging.current = false
      setIsDragging(false)
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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar panel */}
      <div
        className="shrink-0 overflow-hidden"
        style={{
          width: open ? width : 0,
          transition: isDragging ? 'none' : 'width 200ms ease',
        }}
      >
        {sidebar}
      </div>

      {/* Drag handle + toggle button column */}
      <div className="relative shrink-0 flex flex-col items-center">
        {/* Toggle button */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-4 w-5 h-7 flex items-center justify-center rounded-r border border-l-0 border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 text-xs transition-colors z-10"
          title={open ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {open ? '‹' : '›'}
        </button>

        {/* Drag area */}
        {open && (
          <div
            className="flex-1 w-1 cursor-col-resize hover:bg-amber-400 dark:hover:bg-amber-600 transition-colors"
            onMouseDown={startDrag}
          />
        )}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-stone-50 dark:bg-stone-950">{children}</main>
    </div>
  )
}

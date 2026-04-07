'use client'

import Image from '@tiptap/extension-image'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Resize handle component
// ---------------------------------------------------------------------------

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const imgRef = useRef<HTMLImageElement>(null)
  const [isResizing, setIsResizing] = useState(false)

  const width = node.attrs.width as number | null

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    isDragging.current = true
    setIsResizing(true)
    startX.current = e.clientX
    startWidth.current = imgRef.current?.offsetWidth ?? width ?? 400
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isDragging.current) return
      const newWidth = Math.max(80, startWidth.current + (e.clientX - startX.current))
      updateAttributes({ width: newWidth })
    }
    function onUp() {
      if (!isDragging.current) return
      isDragging.current = false
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
  }, [updateAttributes])

  return (
    <NodeViewWrapper
      as="span"
      style={{ display: 'inline-block', position: 'relative', maxWidth: '100%' }}
      className="resizable-image-wrapper"
    >
      <img
        ref={imgRef}
        src={node.attrs.src as string}
        alt={(node.attrs.alt as string) ?? ''}
        title={(node.attrs.title as string) ?? undefined}
        style={{
          width: width ? `${width}px` : 'auto',
          maxWidth: '100%',
          display: 'block',
          outline: selected ? '2px solid #f59e0b' : 'none',
          outlineOffset: '2px',
          borderRadius: '0.375rem',
        }}
      />
      {/* Drag handle — visible on hover or while resizing */}
      <span
        onMouseDown={onMouseDown}
        className={`resizable-image-handle${isResizing ? ' active' : ''}`}
        title="Drag to resize"
      />
    </NodeViewWrapper>
  )
}

// ---------------------------------------------------------------------------
// TipTap extension
// ---------------------------------------------------------------------------

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = (el as HTMLImageElement).getAttribute('width')
          return w ? parseInt(w) : null
        },
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.width ? { width: String(attrs.width) } : {},
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },
})

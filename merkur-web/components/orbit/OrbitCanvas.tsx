'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DOTS = 20
const BASE_SPEED = 0.008 // rad/s, counterclockwise
const SPEED_JITTER = 0.2 // ±20% of base speed
const RADIUS_JITTER = 12 // ±px within a cluster
const FOLDER_SPREAD = (25 * Math.PI) / 180 // ±25° spread within folder cluster
const ARC_SPEED = 0.3 // rad/s for ring highlight arc
const ARC_LENGTH = Math.PI / 3 // 60°
const HIT_RADIUS = 14 // px for hover / click detection
const DOT_RADIUS = 5
const DOT_HOVER_RADIUS = 8
const LABEL_MAX_CHARS = 20
const FADE_STEP = 1 / 20 // progress per frame (fade-in over 20 frames)
const STAGGER_DELAY = 8 // frames between sequential dot appearances
const TODO_ORBIT_OFFSET = 48 // px further out than parent note's orbit radius
const TODO_DOT_RADIUS = 3

// Tailwind stone palette values used in canvas drawing
const COLOR_LIGHT = '#1c1917' // stone-900
const COLOR_DARK = '#e7e5e4' // stone-200
const ARC_COLOR = '#f59e0b' // amber-400

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NoteData {
  id: string
  title: string
  folder_id: string | null
}

interface OrbitDot {
  note: NoteData
  angle: number // current angle on ellipse (radians)
  speed: number // rad/s
  radiusJitter: number // px added to R
  fadeProgress: number // −N…1; negative = not yet started fading in
}

interface TodoDot {
  noteIndex: number // index into dotsRef.current
  angleOffset: number // fixed angular offset from parent note angle (radians)
  fadeProgress: number
}

export interface OrbitCanvasProps {
  maxDots?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '\u2026' : s
}

function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark')
}

// Map an angle on the ellipse parameter to canvas (x, y).
function ellipsePoint(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  angle: number
): [number, number] {
  return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]
}

// Euclidean distance²
function dist2(ax: number, ay: number, bx: number, by: number): number {
  return (ax - bx) ** 2 + (ay - by) ** 2
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrbitCanvas({ maxDots = MAX_DOTS }: OrbitCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dotsRef = useRef<OrbitDot[]>([])
  const todoDotsRef = useRef<TodoDot[]>([])
  const rafRef = useRef<number>(0)
  const arcAngleRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const hoveredRef = useRef<number>(-1)
  const router = useRouter()

  // ------------------------------------------------------------------
  // Data fetch
  // ------------------------------------------------------------------

  useEffect(() => {
    const supabase = createClient()

    supabase
      .from('notes')
      .select('id, title, folder_id')
      .order('updated_at', { ascending: false })
      .limit(maxDots)
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) return

        const notes = data as NoteData[]

        // Unique folders in the order they first appear
        const folderOrder: string[] = []
        notes.forEach((n) => {
          const key = n.folder_id ?? '__inbox__'
          if (!folderOrder.includes(key)) folderOrder.push(key)
        })

        // Assign each folder a base angle evenly distributed around the ellipse
        const folderBaseAngle = new Map<string, number>()
        folderOrder.forEach((key, i) => {
          folderBaseAngle.set(key, (i / folderOrder.length) * 2 * Math.PI)
        })

        // Count notes per folder to compute per-note spread offset
        const folderCount = new Map<string, number>()
        const folderIdx = new Map<string, number>()
        notes.forEach((n) => {
          const key = n.folder_id ?? '__inbox__'
          folderCount.set(key, (folderCount.get(key) ?? 0) + 1)
          folderIdx.set(key, 0)
        })

        const dots: OrbitDot[] = notes.map((note, globalIdx) => {
          const key = note.folder_id ?? '__inbox__'
          const base = folderBaseAngle.get(key) ?? 0
          const count = folderCount.get(key) ?? 1
          const idx = folderIdx.get(key) ?? 0
          folderIdx.set(key, idx + 1)

          // Spread notes within the cluster
          const angle = count === 1 ? base : base + FOLDER_SPREAD * (2 * (idx / (count - 1)) - 1)

          // Per-dot speed jitter
          const speed = BASE_SPEED * (1 + (Math.random() * 2 - 1) * SPEED_JITTER)

          // Per-dot radius jitter (stagger within cluster so labels don't overlap)
          const radiusJitter = (Math.random() * 2 - 1) * RADIUS_JITTER

          // Stagger fade-in: dot i starts appearing after i * STAGGER_DELAY frames
          const fadeProgress = -(globalIdx * STAGGER_DELAY * FADE_STEP)

          return { note, angle, speed, radiusJitter, fadeProgress }
        })

        dotsRef.current = dots

        // Fetch pending todos for visible notes and build TodoDot entries
        const noteIds = notes.map((n) => n.id)
        supabase
          .from('todos')
          .select('id, note_id')
          .eq('done', false)
          .in('note_id', noteIds)
          .then(({ data: todoData }) => {
            if (!todoData || todoData.length === 0) return

            // Build a map from note_id → index in dots array
            const noteIdxMap = new Map<string, number>()
            dots.forEach((d, i) => noteIdxMap.set(d.note.id, i))

            // Group todos by note so we can spread their angle offsets
            const byNote = new Map<string, number>()
            const todoDots: TodoDot[] = []

            todoData.forEach((t) => {
              const noteIndex = noteIdxMap.get(t.note_id)
              if (noteIndex === undefined) return

              const count = byNote.get(t.note_id) ?? 0
              byNote.set(t.note_id, count + 1)

              // Spread multiple todos per note: ±6° per slot
              const spread = (6 * Math.PI) / 180
              const angleOffset =
                (count - Math.floor(count / 2)) * spread * (count % 2 === 0 ? -1 : 1)

              todoDots.push({ noteIndex, angleOffset, fadeProgress: 0 })
            })

            todoDotsRef.current = todoDots
          })
      })
  }, [maxDots])

  // ------------------------------------------------------------------
  // Draw loop
  // ------------------------------------------------------------------

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dt = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0.016
    lastTimeRef.current = timestamp

    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H / 2

    const dark = isDarkMode()
    const color = dark ? COLOR_DARK : COLOR_LIGHT

    // Ellipse dimensions — fit inside the canvas with margin
    const R = Math.min(W * 0.42, H * 0.68)
    const rx = R
    const ry = R * 0.38

    ctx.clearRect(0, 0, W, H)

    // ---- Ring (base ellipse) ----------------------------------------
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI)
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.12
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.globalAlpha = 1

    // ---- Rotating arc highlight (segments approximate the ellipse) ---
    arcAngleRef.current += ARC_SPEED * dt
    const arcStart = arcAngleRef.current
    const segments = 32
    const dA = ARC_LENGTH / segments

    for (let i = 0; i < segments; i++) {
      const a1 = arcStart + i * dA
      const a2 = arcStart + (i + 1) * dA
      const [x1, y1] = ellipsePoint(cx, cy, rx, ry, a1)
      const [x2, y2] = ellipsePoint(cx, cy, rx, ry, a2)
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.strokeStyle = ARC_COLOR
      ctx.globalAlpha = (i / segments) * 0.7
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // ---- Centre mark (planet dot) -----------------------------------
    ctx.beginPath()
    ctx.arc(cx, cy, 10, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.globalAlpha = 0.9
    ctx.fill()
    ctx.globalAlpha = 1

    const dots = dotsRef.current
    if (dots.length === 0) {
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    // Advance angles (counterclockwise) and fade progress
    dots.forEach((dot) => {
      dot.angle -= dot.speed * dt
      dot.fadeProgress = Math.min(1, dot.fadeProgress + FADE_STEP)
    })

    // Compute canvas positions
    const positions = dots.map((dot) => {
      const rx2 = rx + dot.radiusJitter
      const ry2 = ry + dot.radiusJitter * 0.38
      return ellipsePoint(cx, cy, rx2, ry2, dot.angle)
    })

    // Advance todo fade progress and compute todo positions
    const todoDots = todoDotsRef.current
    todoDots.forEach((td) => {
      td.fadeProgress = Math.min(1, td.fadeProgress + FADE_STEP)
    })
    const todoPositions = todoDots.map((td) => {
      const parent = dots[td.noteIndex]
      const angle = parent.angle + td.angleOffset
      const rBase = rx + parent.radiusJitter + TODO_ORBIT_OFFSET
      return ellipsePoint(cx, cy, rBase, rBase * 0.38, angle)
    })

    // ---- Folder connection lines ------------------------------------
    ctx.lineWidth = 0.5
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const fi = dots[i].note.folder_id
        const fj = dots[j].note.folder_id
        if (fi === null || fi !== fj) continue
        const minFade = Math.min(
          Math.max(0, dots[i].fadeProgress),
          Math.max(0, dots[j].fadeProgress)
        )
        if (minFade <= 0) continue
        ctx.beginPath()
        ctx.moveTo(positions[i][0], positions[i][1])
        ctx.lineTo(positions[j][0], positions[j][1])
        ctx.strokeStyle = color
        ctx.globalAlpha = 0.15 * minFade
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1

    // ---- Todo → note dashed connecting lines ------------------------
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 4])
    todoDots.forEach((td, i) => {
      const fade = Math.max(0, td.fadeProgress)
      if (fade <= 0) return
      const noteFade = Math.max(0, dots[td.noteIndex].fadeProgress)
      const [tx, ty] = todoPositions[i]
      const [nx, ny] = positions[td.noteIndex]
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.lineTo(nx, ny)
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.2 * Math.min(fade, noteFade)
      ctx.stroke()
    })
    ctx.setLineDash([])
    ctx.globalAlpha = 1

    // ---- Todo dots --------------------------------------------------
    todoDots.forEach((td, i) => {
      const fade = Math.max(0, td.fadeProgress)
      if (fade <= 0) return
      const [tx, ty] = todoPositions[i]
      ctx.beginPath()
      ctx.arc(tx, ty, TODO_DOT_RADIUS, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.globalAlpha = 0.5 * fade
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // ---- Note dots + labels -----------------------------------------
    ctx.font = `11px system-ui, -apple-system, sans-serif`
    ctx.textBaseline = 'top'

    const hovered = hoveredRef.current
    dots.forEach((dot, i) => {
      const fade = Math.max(0, dot.fadeProgress)
      if (fade <= 0) return
      const [x, y] = positions[i]
      const isHovered = i === hovered
      const r = isHovered ? DOT_HOVER_RADIUS : DOT_RADIUS

      // Dot
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.globalAlpha = (isHovered ? 1 : 0.8) * fade
      ctx.fill()
      ctx.globalAlpha = 1

      // Label
      const label = truncate(dot.note.title, LABEL_MAX_CHARS)
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.globalAlpha = (isHovered ? 1 : 0.6) * fade
      ctx.fillText(label, x, y + r + 4)
      ctx.globalAlpha = 1
    })

    rafRef.current = requestAnimationFrame(draw)
  }, [])

  // ------------------------------------------------------------------
  // Canvas setup + resize
  // ------------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function resize() {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      ro.disconnect()
      cancelAnimationFrame(rafRef.current)
      lastTimeRef.current = 0
    }
  }, [draw])

  // ------------------------------------------------------------------
  // Mouse events
  // ------------------------------------------------------------------

  const getHoveredIndex = useCallback((e: React.MouseEvent<HTMLCanvasElement>): number => {
    const canvas = canvasRef.current
    if (!canvas) return -1
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const W = rect.width
    const H = rect.height
    const cx = W / 2
    const cy = H / 2
    const R = Math.min(W * 0.42, H * 0.68)
    const rx = R
    const ry = R * 0.38

    const dots = dotsRef.current
    for (let i = 0; i < dots.length; i++) {
      if (dots[i].fadeProgress <= 0) continue
      const rx2 = rx + dots[i].radiusJitter
      const ry2 = ry + dots[i].radiusJitter * 0.38
      const [x, y] = ellipsePoint(cx, cy, rx2, ry2, dots[i].angle)
      if (dist2(mx, my, x, y) <= HIT_RADIUS ** 2) return i
    }
    return -1
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const idx = getHoveredIndex(e)
      hoveredRef.current = idx
      if (canvasRef.current) {
        canvasRef.current.style.cursor = idx >= 0 ? 'pointer' : 'default'
      }
    },
    [getHoveredIndex]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const idx = getHoveredIndex(e)
      if (idx >= 0) {
        router.push(`/notes/${dotsRef.current[idx].note.id}`)
      }
    },
    [getHoveredIndex, router]
  )

  const handleMouseLeave = useCallback(() => {
    hoveredRef.current = -1
    if (canvasRef.current) canvasRef.current.style.cursor = 'default'
  }, [])

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onMouseLeave={handleMouseLeave}
    />
  )
}

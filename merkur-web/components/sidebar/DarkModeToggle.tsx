'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export default function DarkModeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 hover:text-stone-700 dark:hover:text-stone-200 transition-colors w-full"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="text-base leading-none">{isDark ? '○' : '◑'}</span>
      <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  )
}

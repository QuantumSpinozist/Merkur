'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function TodosNavLink() {
  const pathname = usePathname()
  const isActive = pathname === '/todos'

  return (
    <Link
      href="/todos"
      className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
        isActive
          ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-900 dark:text-amber-300'
          : 'text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 hover:text-stone-700 dark:hover:text-stone-200'
      }`}
    >
      <span>☐</span>
      <span>Todos</span>
    </Link>
  )
}

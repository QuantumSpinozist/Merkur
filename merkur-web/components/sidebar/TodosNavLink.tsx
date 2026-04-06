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
          ? 'bg-amber-100 text-amber-900'
          : 'text-stone-500 hover:bg-stone-200 hover:text-stone-700'
      }`}
    >
      <span>☐</span>
      <span>Todos</span>
    </Link>
  )
}

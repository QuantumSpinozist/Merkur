import { createClient } from '@/lib/supabase/server'
import FolderTree from './FolderTree'
import TodosNavLink from './TodosNavLink'
import DarkModeToggle from './DarkModeToggle'
import type { Folder } from '@/lib/types'

export default async function Sidebar() {
  const supabase = createClient()
  const { data: folders } = await supabase
    .from('folders')
    .select('id, name, parent_id, created_at, updated_at')
    .order('position', { ascending: true })

  return (
    <aside className="w-full h-full bg-stone-100 dark:bg-stone-900 border-r border-stone-200 dark:border-stone-700 flex flex-col">
      <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700">
        {/* Light logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/merkur-logo.svg" alt="Merkur" className="h-12 w-auto dark:hidden" />
        {/* Dark logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/merkur-logo-dark.svg" alt="Merkur" className="h-12 w-auto hidden dark:block" />
        <span className="text-xs text-stone-400 dark:text-stone-500">v0.1.0</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <FolderTree folders={(folders ?? []) as Folder[]} />
      </div>
      <div className="border-t border-stone-200 dark:border-stone-700 p-2 space-y-1">
        <TodosNavLink />
        <DarkModeToggle />
      </div>
    </aside>
  )
}

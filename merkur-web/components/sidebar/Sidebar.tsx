import { createClient } from '@/lib/supabase/server'
import FolderTree from './FolderTree'
import type { Folder } from '@/lib/types'

export default async function Sidebar() {
  const supabase = createClient()
  const { data: folders } = await supabase
    .from('folders')
    .select('id, name, parent_id, created_at, updated_at')
    .order('name', { ascending: true })

  return (
    <aside className="w-64 h-full bg-stone-100 border-r border-stone-200 flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-stone-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/merkur-logo.svg" alt="Merkur" className="h-7 w-auto" />
        <span className="text-xs text-stone-400">v0.1.0</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <FolderTree folders={(folders ?? []) as Folder[]} />
      </div>
    </aside>
  )
}

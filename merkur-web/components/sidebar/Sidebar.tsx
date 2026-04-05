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
        <h1 className="text-base font-serif font-semibold text-stone-800">Merkur</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <FolderTree folders={(folders ?? []) as Folder[]} />
      </div>
    </aside>
  )
}

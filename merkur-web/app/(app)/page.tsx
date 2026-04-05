import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EmptyState from '@/components/ui/EmptyState'

export default async function HomePage() {
  const supabase = createClient()

  const { data: folders } = await supabase
    .from('folders')
    .select('id')
    .is('parent_id', null)
    .order('name', { ascending: true })
    .limit(1)

  if (folders && folders.length > 0) {
    redirect(`/folders/${folders[0].id}`)
  }

  return (
    <div className="flex items-center justify-center h-full">
      <EmptyState
        title="No folders yet"
        description="Create a folder in the sidebar to get started."
      />
    </div>
  )
}

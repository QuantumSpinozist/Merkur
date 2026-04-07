import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { reorderSchema } from '@/lib/schemas'

export async function PUT(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: unknown = await request.json()
  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { type, ordered_ids } = parsed.data
  const table = type === 'folder' ? 'folders' : 'notes'

  await Promise.all(
    ordered_ids.map((id, index) => supabase.from(table).update({ position: index }).eq('id', id))
  )

  return NextResponse.json({ success: true })
}

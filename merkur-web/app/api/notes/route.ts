import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createNoteSchema, updateNoteSchema, deleteNoteSchema } from '@/lib/schemas'
import type { Note } from '@/lib/types'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get('folderId')

  let query = supabase
    .from('notes')
    .select('id, title, content, folder_id, source, is_cleaned, created_at, updated_at')
    .order('updated_at', { ascending: false })

  query = folderId ? query.eq('folder_id', folderId) : query.is('folder_id', null)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data as Note[])
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: unknown = await request.json()
  const parsed = createNoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('notes')
    .insert({
      title: parsed.data.title ?? 'Untitled',
      folder_id: parsed.data.folder_id ?? null,
      source: 'web',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data as Note, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: unknown = await request.json()
  const parsed = updateNoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title
  if (parsed.data.content !== undefined) updateData.content = parsed.data.content
  if ('folder_id' in parsed.data) updateData.folder_id = parsed.data.folder_id

  const { data, error } = await supabase
    .from('notes')
    .update(updateData)
    .eq('id', parsed.data.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data as Note)
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: unknown = await request.json()
  const parsed = deleteNoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { error } = await supabase.from('notes').delete().eq('id', parsed.data.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

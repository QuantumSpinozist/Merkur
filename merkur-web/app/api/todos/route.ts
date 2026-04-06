import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createTodoSchema, updateTodoSchema, deleteTodoSchema } from '@/lib/schemas'
import type { Todo } from '@/lib/types'

/**
 * Reset done todos whose recurrence period has elapsed.
 * Mutates the DB and returns the updated list.
 */
async function applyRecurrenceResets(
  supabase: ReturnType<typeof createClient>,
  todos: Todo[]
): Promise<void> {
  const now = new Date()
  const toReset: string[] = []

  for (const todo of todos) {
    if (!todo.done || !todo.recurrence || !todo.done_at) continue

    const doneAt = new Date(todo.done_at)
    let resetAfterMs: number

    switch (todo.recurrence) {
      case 'daily':
        resetAfterMs = 24 * 60 * 60 * 1000
        break
      case 'weekly':
        resetAfterMs = 7 * 24 * 60 * 60 * 1000
        break
      case 'monthly':
        resetAfterMs = 30 * 24 * 60 * 60 * 1000
        break
    }

    if (now.getTime() - doneAt.getTime() >= resetAfterMs) {
      toReset.push(todo.id)
    }
  }

  if (toReset.length === 0) return

  await supabase
    .from('todos')
    .update({ done: false, done_at: null, updated_at: now.toISOString() })
    .in('id', toReset)

  // Mutate in-place so caller gets fresh state without a second DB round-trip
  for (const todo of todos) {
    if (toReset.includes(todo.id)) {
      todo.done = false
      todo.done_at = null
    }
  }
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const noteId = searchParams.get('noteId')

  let query = supabase
    .from('todos')
    .select('id, note_id, text, done, done_at, recurrence, due_date, created_at, updated_at')
    .order('created_at', { ascending: true })

  if (noteId) {
    query = query.eq('note_id', noteId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const todos = (data ?? []) as Todo[]
  await applyRecurrenceResets(supabase, todos)

  return NextResponse.json(todos)
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
  const parsed = createTodoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('todos')
    .insert({
      note_id: parsed.data.note_id,
      text: parsed.data.text,
      due_date: parsed.data.due_date ?? null,
      recurrence: parsed.data.recurrence ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data as Todo, { status: 201 })
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
  const parsed = updateTodoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.text !== undefined) updateData.text = parsed.data.text
  if (parsed.data.due_date !== undefined) updateData.due_date = parsed.data.due_date
  if ('recurrence' in parsed.data) updateData.recurrence = parsed.data.recurrence
  if (parsed.data.done !== undefined) {
    updateData.done = parsed.data.done
    updateData.done_at = parsed.data.done ? new Date().toISOString() : null
  }

  const { data, error } = await supabase
    .from('todos')
    .update(updateData)
    .eq('id', parsed.data.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data as Todo)
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
  const parsed = deleteTodoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { error } = await supabase.from('todos').delete().eq('id', parsed.data.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

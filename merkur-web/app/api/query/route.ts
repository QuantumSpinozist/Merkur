import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  question: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: unknown = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const brainUrl = process.env.BRAIN_URL
  const brainSecret = process.env.BRAIN_SECRET
  if (!brainUrl) {
    return NextResponse.json({ error: 'BRAIN_URL not configured' }, { status: 503 })
  }

  const res = await fetch(`${brainUrl}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(brainSecret ? { 'X-Brain-Secret': brainSecret } : {}),
    },
    body: JSON.stringify(parsed.data),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `Brain error: ${text}` }, { status: 502 })
  }

  const data = (await res.json()) as { answer: string }
  return NextResponse.json(data)
}

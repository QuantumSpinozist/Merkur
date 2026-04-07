import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const BUCKET = 'note-images'
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(request: NextRequest) {
  try {
    // Auth check via cookie-based client
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    // FormData file entries are Blob (or File which extends Blob) in Node.js
    if (!file || typeof file === 'string' || !('arrayBuffer' in file)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    const blob = file as Blob & { name?: string }

    if (!ALLOWED_TYPES.includes(blob.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    if (blob.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
    }

    const name = blob.name ?? 'upload'
    const ext = name.split('.').pop() ?? 'jpg'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Use service role key for storage — bypasses RLS for the upload itself
    // (auth check above already guards access)
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const arrayBuffer = await blob.arrayBuffer()
    const { error } = await serviceClient.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: blob.type, upsert: false })

    if (error) {
      console.error('[upload] Supabase storage error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data } = serviceClient.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (err) {
    console.error('[upload] Unhandled error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// Integration tests for the Next.js API route handlers.
// External dependencies (Supabase) are mocked — no live connection needed.
// Run with: npm run test:integration (not run in pre-commit).

import { NextRequest } from 'next/server'

jest.mock('../../lib/supabase/server')

import { createClient } from '../../lib/supabase/server'

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

const VALID_UUID = '00000000-0000-0000-0000-000000000000'
const VALID_UUID_2 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

const MOCK_FOLDER = {
  id: VALID_UUID,
  name: 'Work',
  parent_id: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const MOCK_NOTE = {
  id: VALID_UUID_2,
  title: 'My note',
  content: null,
  folder_id: VALID_UUID,
  source: 'web' as const,
  is_cleaned: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

// Build a chainable Supabase query mock whose terminal value is `result`.
function makeQuery(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  }
  // Make chain itself awaitable (for queries without .single()).
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return chain
}

function setupAuth(queryResult = { data: [] as unknown, error: null as unknown }) {
  const query = makeQuery(queryResult)
  const client = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: jest.fn().mockReturnValue(query),
  }
  mockCreateClient.mockReturnValue(client as unknown as ReturnType<typeof createClient>)
  return { client, query }
}

function setupUnauth() {
  const client = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    from: jest.fn(),
  }
  mockCreateClient.mockReturnValue(client as unknown as ReturnType<typeof createClient>)
}

function jsonRequest(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/test`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => jest.clearAllMocks())

// ---------------------------------------------------------------------------
// Folders API
// ---------------------------------------------------------------------------

describe('GET /api/folders', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeAll(async () => {
    ;({ GET } = await import('../../app/api/folders/route'))
  })

  it('returns 401 when unauthenticated', async () => {
    setupUnauth()
    const res = await GET(jsonRequest('GET'))
    expect(res.status).toBe(401)
  })

  it('returns folder array when authenticated', async () => {
    setupAuth({ data: [MOCK_FOLDER], error: null })
    const res = await GET(jsonRequest('GET'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([MOCK_FOLDER])
  })
})

describe('POST /api/folders', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeAll(async () => {
    ;({ POST } = await import('../../app/api/folders/route'))
  })

  it('returns 401 when unauthenticated', async () => {
    setupUnauth()
    const res = await POST(jsonRequest('POST', { name: 'Work' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for empty name', async () => {
    setupAuth()
    const res = await POST(jsonRequest('POST', { name: '' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Name is required')
  })

  it('returns 400 for name over 100 characters', async () => {
    setupAuth()
    const res = await POST(jsonRequest('POST', { name: 'a'.repeat(101) }))
    expect(res.status).toBe(400)
  })

  it('returns 201 with created folder', async () => {
    setupAuth({ data: MOCK_FOLDER, error: null })
    const res = await POST(jsonRequest('POST', { name: 'Work' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Work')
  })
})

describe('PATCH /api/folders', () => {
  let PATCH: (req: NextRequest) => Promise<Response>

  beforeAll(async () => {
    ;({ PATCH } = await import('../../app/api/folders/route'))
  })

  it('returns 401 when unauthenticated', async () => {
    setupUnauth()
    const res = await PATCH(jsonRequest('PATCH', { id: VALID_UUID, name: 'Renamed' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid uuid', async () => {
    setupAuth()
    const res = await PATCH(jsonRequest('PATCH', { id: 'not-a-uuid', name: 'Renamed' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid folder ID')
  })

  it('returns updated folder', async () => {
    const updated = { ...MOCK_FOLDER, name: 'Renamed' }
    setupAuth({ data: updated, error: null })
    const res = await PATCH(jsonRequest('PATCH', { id: VALID_UUID, name: 'Renamed' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Renamed')
  })
})

describe('DELETE /api/folders', () => {
  let DELETE: (req: NextRequest) => Promise<Response>

  beforeAll(async () => {
    ;({ DELETE } = await import('../../app/api/folders/route'))
  })

  it('returns 401 when unauthenticated', async () => {
    setupUnauth()
    const res = await DELETE(jsonRequest('DELETE', { id: VALID_UUID }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid uuid', async () => {
    setupAuth()
    const res = await DELETE(jsonRequest('DELETE', { id: 'bad' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid folder ID')
  })

  it('returns success on delete', async () => {
    setupAuth({ data: null, error: null })
    const res = await DELETE(jsonRequest('DELETE', { id: VALID_UUID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Notes API
// ---------------------------------------------------------------------------

describe('GET /api/notes', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeAll(async () => {
    ;({ GET } = await import('../../app/api/notes/route'))
  })

  it('returns 401 when unauthenticated', async () => {
    setupUnauth()
    const res = await GET(new NextRequest('http://localhost/api/notes'))
    expect(res.status).toBe(401)
  })

  it('returns notes filtered by folderId', async () => {
    setupAuth({ data: [MOCK_NOTE], error: null })
    const res = await GET(new NextRequest(`http://localhost/api/notes?folderId=${VALID_UUID}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([MOCK_NOTE])
  })

  it('returns inbox notes when no folderId', async () => {
    setupAuth({ data: [MOCK_NOTE], error: null })
    const res = await GET(new NextRequest('http://localhost/api/notes'))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/notes', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeAll(async () => {
    ;({ POST } = await import('../../app/api/notes/route'))
  })

  it('returns 401 when unauthenticated', async () => {
    setupUnauth()
    const res = await POST(jsonRequest('POST', {}))
    expect(res.status).toBe(401)
  })

  it('creates note with defaults on empty body', async () => {
    setupAuth({ data: MOCK_NOTE, error: null })
    const res = await POST(jsonRequest('POST', {}))
    expect(res.status).toBe(201)
  })

  it('creates note with title and folder_id', async () => {
    const note = { ...MOCK_NOTE, title: 'Hello', folder_id: VALID_UUID }
    setupAuth({ data: note, error: null })
    const res = await POST(jsonRequest('POST', { title: 'Hello', folder_id: VALID_UUID }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.title).toBe('Hello')
  })

  it('returns 400 for title over 60 characters', async () => {
    setupAuth()
    const res = await POST(jsonRequest('POST', { title: 'a'.repeat(61) }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Title must be 60 characters or fewer')
  })
})

describe('PATCH /api/notes', () => {
  let PATCH: (req: NextRequest) => Promise<Response>

  beforeAll(async () => {
    ;({ PATCH } = await import('../../app/api/notes/route'))
  })

  it('returns 401 when unauthenticated', async () => {
    setupUnauth()
    const res = await PATCH(jsonRequest('PATCH', { id: VALID_UUID_2, title: 'Updated' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid uuid', async () => {
    setupAuth()
    const res = await PATCH(jsonRequest('PATCH', { id: 'bad' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid note ID')
  })

  it('returns updated note', async () => {
    const updated = { ...MOCK_NOTE, title: 'Updated' }
    setupAuth({ data: updated, error: null })
    const res = await PATCH(jsonRequest('PATCH', { id: VALID_UUID_2, title: 'Updated' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('Updated')
  })
})

describe('DELETE /api/notes', () => {
  let DELETE: (req: NextRequest) => Promise<Response>

  beforeAll(async () => {
    ;({ DELETE } = await import('../../app/api/notes/route'))
  })

  it('returns 401 when unauthenticated', async () => {
    setupUnauth()
    const res = await DELETE(jsonRequest('DELETE', { id: VALID_UUID_2 }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid uuid', async () => {
    setupAuth()
    const res = await DELETE(jsonRequest('DELETE', { id: 'bad' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid note ID')
  })

  it('returns success on delete', async () => {
    setupAuth({ data: null, error: null })
    const res = await DELETE(jsonRequest('DELETE', { id: VALID_UUID_2 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

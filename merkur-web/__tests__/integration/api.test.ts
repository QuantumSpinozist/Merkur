// Integration tests require a live Supabase connection.
// Run with: npm run test:integration
// These are NOT run in pre-commit.

describe('Folders API', () => {
  it.todo('POST /api/folders creates a folder and returns 201')
  it.todo('GET /api/folders returns all folders')
  it.todo('PATCH /api/folders renames a folder')
  it.todo('DELETE /api/folders deletes a folder')
})

describe('Notes API', () => {
  it.todo('POST /api/notes creates a note and returns 201')
  it.todo('GET /api/notes?folderId returns notes for a folder')
  it.todo('PATCH /api/notes updates note title and content')
  it.todo('DELETE /api/notes deletes a note')
})

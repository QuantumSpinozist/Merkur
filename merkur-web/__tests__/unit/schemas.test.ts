import {
  createFolderSchema,
  updateFolderSchema,
  deleteFolderSchema,
  createNoteSchema,
  updateNoteSchema,
  deleteNoteSchema,
} from '../../lib/schemas'

const VALID_UUID = '00000000-0000-0000-0000-000000000000'

describe('createFolderSchema', () => {
  it('accepts a valid name', () => {
    expect(createFolderSchema.safeParse({ name: 'Work' }).success).toBe(true)
  })
  it('accepts a name with optional parent_id', () => {
    expect(
      createFolderSchema.safeParse({ name: 'Sub', parent_id: VALID_UUID }).success
    ).toBe(true)
  })
  it('rejects an empty name', () => {
    const result = createFolderSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Name is required')
  })
  it('rejects a name over 100 characters', () => {
    const result = createFolderSchema.safeParse({ name: 'a'.repeat(101) })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Name must be 100 characters or fewer')
  })
})

describe('updateFolderSchema', () => {
  it('accepts valid id and name', () => {
    expect(updateFolderSchema.safeParse({ id: VALID_UUID, name: 'Renamed' }).success).toBe(true)
  })
  it('rejects invalid uuid for id', () => {
    const result = updateFolderSchema.safeParse({ id: 'not-a-uuid', name: 'Renamed' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Invalid folder ID')
  })
  it('rejects empty name', () => {
    const result = updateFolderSchema.safeParse({ id: VALID_UUID, name: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Name is required')
  })
})

describe('deleteFolderSchema', () => {
  it('accepts valid id', () => {
    expect(deleteFolderSchema.safeParse({ id: VALID_UUID }).success).toBe(true)
  })
  it('rejects invalid uuid', () => {
    const result = deleteFolderSchema.safeParse({ id: 'bad' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Invalid folder ID')
  })
})

describe('createNoteSchema', () => {
  it('accepts empty body', () => {
    expect(createNoteSchema.safeParse({}).success).toBe(true)
  })
  it('accepts title and folder_id', () => {
    expect(
      createNoteSchema.safeParse({ title: 'Hello', folder_id: VALID_UUID }).success
    ).toBe(true)
  })
  it('rejects empty title string', () => {
    const result = createNoteSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Title is required')
  })
  it('rejects title over 60 characters', () => {
    const result = createNoteSchema.safeParse({ title: 'a'.repeat(61) })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Title must be 60 characters or fewer')
  })
})

describe('updateNoteSchema', () => {
  it('accepts id with optional fields', () => {
    expect(
      updateNoteSchema.safeParse({ id: VALID_UUID, title: 'Hello' }).success
    ).toBe(true)
  })
  it('rejects invalid uuid', () => {
    const result = updateNoteSchema.safeParse({ id: 'bad' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Invalid note ID')
  })
  it('rejects title over 60 characters', () => {
    const result = updateNoteSchema.safeParse({ id: VALID_UUID, title: 'a'.repeat(61) })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Title must be 60 characters or fewer')
  })
})

describe('deleteNoteSchema', () => {
  it('accepts valid id', () => {
    expect(deleteNoteSchema.safeParse({ id: VALID_UUID }).success).toBe(true)
  })
  it('rejects invalid uuid', () => {
    const result = deleteNoteSchema.safeParse({ id: 'bad' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Invalid note ID')
  })
})

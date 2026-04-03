import { truncateTitle } from '../../lib/utils'

describe('truncateTitle', () => {
  it('returns title unchanged when under the limit', () => {
    expect(truncateTitle('Hello world', 60)).toBe('Hello world')
  })
  it('returns title unchanged when exactly at the limit', () => {
    expect(truncateTitle('a'.repeat(60), 60)).toBe('a'.repeat(60))
  })
  it('truncates and appends ellipsis when over the limit', () => {
    expect(truncateTitle('a'.repeat(70), 60)).toBe('a'.repeat(57) + '...')
  })
  it('handles empty string', () => {
    expect(truncateTitle('', 60)).toBe('')
  })
})

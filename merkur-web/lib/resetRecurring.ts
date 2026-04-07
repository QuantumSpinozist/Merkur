import type { createClient } from '@/lib/supabase/server'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Reset done todos whose recurrence period has elapsed.
 * Runs 3 parallel UPDATEs (one per recurrence type) so the subsequent
 * SELECT always returns up-to-date state.
 */
export async function resetExpiredRecurring(
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const now = new Date()
  await Promise.all([
    supabase
      .from('todos')
      .update({ done: false, done_at: null, updated_at: now.toISOString() })
      .eq('done', true)
      .eq('recurrence', 'daily')
      .lt('done_at', new Date(now.getTime() - DAY_MS).toISOString()),
    supabase
      .from('todos')
      .update({ done: false, done_at: null, updated_at: now.toISOString() })
      .eq('done', true)
      .eq('recurrence', 'weekly')
      .lt('done_at', new Date(now.getTime() - 7 * DAY_MS).toISOString()),
    supabase
      .from('todos')
      .update({ done: false, done_at: null, updated_at: now.toISOString() })
      .eq('done', true)
      .eq('recurrence', 'monthly')
      .lt('done_at', new Date(now.getTime() - 30 * DAY_MS).toISOString()),
  ])
}

import { supabase } from '../lib/supabaseClient'

const HOURS_TO_LOAD = 24

/**
 * Scraper runs from the last 24 hours, newest first — GitHub runs only.
 * Each scraper adds one row to the `runs` table when it finishes. All five scrapers in one
 * GitHub workflow run share the same run_id; local runs have run_id = null and are skipped.
 * { run_id: 18123456789, source: 'workday', scraped_at: '2026-09-26T10:02:00Z',
 *   report: [{ company: 'Walmart', ok: false, count: 0, error: 'HTTP 429' }, …] }
 */
export async function fetchRuns() {
  const oneDayAgo = new Date(Date.now() - HOURS_TO_LOAD * 60 * 60 * 1000).toISOString()

  const { data: runs, error } = await supabase
    .from('runs')
    .select('id, run_id, source, scraped_at, report')
    .not('run_id', 'is', null)
    .gte('scraped_at', oneDayAgo)
    .order('scraped_at', { ascending: false })
    .limit(1000)

  if (error) throw new Error(`Could not load scraper runs: ${error.message}`)
  return runs
}
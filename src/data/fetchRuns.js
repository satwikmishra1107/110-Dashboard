import { HEALTH_DAYS } from '../lib/constants'
import { supabase } from '../lib/supabaseClient'

const ROWS_PER_PAGE = 1000 // Supabase returns at most 1000 rows per request

/**
 * Scraper runs from the last 7 days, newest first — GitHub runs only.
 * Each scraper adds one row to the `runs` table when it finishes. All scrapers in one
 * GitHub workflow run share the same run_id; local runs have run_id = null and are skipped.
 * { run_id: 18123456789, source: 'workday', scraped_at: '2026-09-26T10:02:00Z',
 *   report: [{ company: 'Walmart', ok: false, count: 0, error: 'HTTP 429' }, …] }
 */
export async function fetchRuns() {
  const sevenDaysAgo = new Date(Date.now() - HEALTH_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const allRuns = []
  let pageStart = 0

  // 7 days is about 1000 rows, so ask page by page until a page comes back short
  while (true) {
    const { data: pageOfRuns, error } = await supabase
      .from('runs')
      .select('id, run_id, source, scraped_at, report')
      .not('run_id', 'is', null)
      .gte('scraped_at', sevenDaysAgo)
      .order('scraped_at', { ascending: false })
      .order('id') // tie-breaker, so paging never skips or repeats a row
      .range(pageStart, pageStart + ROWS_PER_PAGE - 1)

    if (error) throw new Error(`Could not load scraper runs: ${error.message}`)

    allRuns.push(...pageOfRuns)
    if (pageOfRuns.length < ROWS_PER_PAGE) break
    pageStart += ROWS_PER_PAGE
  }
  return allRuns
}

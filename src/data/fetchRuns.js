import { HEALTH_DAYS, RUN_DETAILS_HOURS } from '../lib/constants'
import { supabase } from '../lib/supabaseClient'

const ROWS_PER_PAGE = 1000 // Supabase returns at most 1000 rows per request

/** GitHub runs (run_id set) since a time, newest first, page by page until a page comes back short. */
async function fetchRunRows(tableName, columns, since) {
  const allRows = []
  let pageStart = 0

  while (true) {
    const { data: pageOfRows, error } = await supabase
      .from(tableName)
      .select(columns)
      .not('run_id', 'is', null)
      .gte('scraped_at', since)
      .order('scraped_at', { ascending: false })
      .order('id') // tie-breaker, so paging never skips or repeats a row
      .range(pageStart, pageStart + ROWS_PER_PAGE - 1)

    if (error) throw new Error(`Could not load scraper runs: ${error.message}`)

    allRows.push(...pageOfRows)
    if (pageOfRows.length < ROWS_PER_PAGE) break
    pageStart += ROWS_PER_PAGE
  }
  return allRows
}

/**
 * Just when each scraper last finished, for the header ("15 min ago", amber dot if a source is stale).
 * Last 24 hours, no reports, so it's a few KB: [{ id, run_id, source: 'lever', scraped_at: '…' }, …]
 */
export async function fetchLatestRuns() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  return fetchRunRows('runs', 'id, run_id, source, scraped_at', oneDayAgo)
}

/**
 * Scraper runs for the Scraper health tab (loaded only when it's opened), in two sizes. Each scraper adds one row to the `runs` table when it finishes;
 * all scrapers in one GitHub workflow run share the same run_id (local runs have none and are skipped).
 *
 * runSummaries — last 7 days, from the run_summaries view: each row's report already added up in
 *   Supabase, plus only the companies that failed. Small, so the 7-day stats stay cheap.
 *   { id, run_id, source, scraped_at, companies_checked: 22, companies_ok: 21, new_jobs: 3, updated_jobs: 0,
 *     failures: [{ company: 'Walmart', error: 'HTTP 429' }] }
 *
 * runDetails — last 48 hours, full rows for the clickable run history.
 *   { id, run_id, source, scraped_at, report: [{ company: 'Walmart', ok: false, count: 0, error: 'HTTP 429' }, …] }
 */
export async function fetchRuns() {
  const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  const [runSummaries, runDetails] = await Promise.all([
    fetchRunRows(
      'run_summaries',
      'id, run_id, source, scraped_at, companies_checked, companies_ok, new_jobs, updated_jobs, failures',
      hoursAgo(HEALTH_DAYS * 24),
    ),
    fetchRunRows('runs', 'id, run_id, source, scraped_at, report', hoursAgo(RUN_DETAILS_HOURS)),
  ])
  return { runSummaries, runDetails }
}

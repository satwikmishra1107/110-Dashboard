import { supabase } from '../lib/supabaseClient'

const DAYS_TO_LOAD = 30
const ROWS_PER_PAGE = 1000 // Supabase returns at most 1000 rows per request

/**
 * Get every job your scraper found in the last 30 days, newest first.
 *
 * Returns an array like:
 * [{ source: 'workday', company: 'Google', job_id: 'JR-123', title: '…', location: '…',
 *    url: '…', posted_label: 'Posted Today', posted_date: '2026-09-25', first_seen_at: '2026-09-26T04:30:00Z',
 *    is_update: false }, …]
 */
export async function fetchJobs() {
  const thirtyDaysAgo = new Date(Date.now() - DAYS_TO_LOAD * 24 * 60 * 60 * 1000).toISOString()
  const allJobs = []
  let pageStart = 0

  // Ask for 1000 rows at a time until a page comes back with fewer than 1000 (that's the last page)
  while (true) {
    const { data: pageOfJobs, error } = await supabase
      .from('jobs')
      .select('source, company, job_id, title, location, url, posted_label, posted_date, first_seen_at, is_update')
      .gte('first_seen_at', thirtyDaysAgo) // only jobs found in the last 30 days
      .order('first_seen_at', { ascending: false }) // newest first
      .order('job_id') // tie-breaker, so paging never skips or repeats a row
      .range(pageStart, pageStart + ROWS_PER_PAGE - 1)

    if (error) throw new Error(`Could not load jobs: ${error.message}`)

    allJobs.push(...pageOfJobs)
    if (pageOfJobs.length < ROWS_PER_PAGE) break
    pageStart += ROWS_PER_PAGE
  }

  return allJobs
}
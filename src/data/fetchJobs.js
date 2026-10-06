import { supabase } from '../lib/supabaseClient'

const ROWS_PER_PAGE = 1000 // Supabase returns at most 1000 rows per request

/**
 * Get every job found — or reposted — since `since`, newest first.
 * With `firstSeenBefore`, only jobs first seen before then (the Archive's older jobs, loaded after the Board).
 * A job reposted after `firstSeenBefore` still comes back, so merge with makeJobKey to drop doubles.
 *
 * Returns an array like:
 * [{ source: 'workday', company: 'Google', job_id: 'JR-123', title: '…', location: '…',
 *    url: '…', posted_label: 'Posted Today', posted_date: '2026-09-25', first_seen_at: '2026-09-26T04:30:00Z',
 *    reposted_at: null, is_update: false }, …]
 */
export async function fetchJobs({ since, firstSeenBefore = null }) {
  const sinceText = since.toISOString()
  const allJobs = []
  let pageStart = 0

  // Ask for 1000 rows at a time until a page comes back with fewer than 1000 (that's the last page)
  while (true) {
    let query = supabase
      .from('jobs')
      .select('source, company, job_id, title, location, url, posted_label, posted_date, first_seen_at, reposted_at, is_update')
      // found since then, OR reposted since then
      .or(`first_seen_at.gte."${sinceText}",reposted_at.gte."${sinceText}"`)
    if (firstSeenBefore) query = query.lt('first_seen_at', firstSeenBefore.toISOString())

    const { data: pageOfJobs, error } = await query
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

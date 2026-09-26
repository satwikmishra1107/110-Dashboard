import { makeJobKey } from '../lib/constants'
import { supabase } from '../lib/supabaseClient'

/*
 * What you've done with each job: status, note, archived.
 * Stored in the Supabase table `job_tracking`, one row per job you've touched.
 * Jobs you've never touched have no row (they show as "New").
 */

const ROWS_PER_PAGE = 1000 // Supabase returns at most 1000 rows per request

/** Returns a Map: job key → { company, job_id, status, note, archived } */
export async function fetchJobTracking() {
  const allRows = []
  let pageStart = 0

  while (true) {
    const { data: pageOfRows, error } = await supabase
      .from('job_tracking')
      .select('company, job_id, status, note, archived')
      .order('company')
      .order('job_id')
      .range(pageStart, pageStart + ROWS_PER_PAGE - 1)

    if (error) throw new Error(`Could not load job tracking: ${error.message}`)

    allRows.push(...pageOfRows)
    if (pageOfRows.length < ROWS_PER_PAGE) break
    pageStart += ROWS_PER_PAGE
  }

  return new Map(allRows.map((row) => [makeJobKey(row.company, row.job_id), row]))
}

/** Save one job's tracking. Creates the row the first time, updates it after that. */
export async function saveJobTracking({ company, job_id, status, note, archived }) {
  const { error } = await supabase.from('job_tracking').upsert(
    { company, job_id, status, note: note || null, archived, updated_at: new Date().toISOString() },
    { onConflict: 'company,job_id' }, // company + job_id already exists → update instead of insert
  )
  if (error) throw new Error(`Could not save job: ${error.message}`)
}
import { makeJobKey } from '../lib/constants'
import { supabase } from '../lib/supabaseClient'

/*
 * What's been done with each job, from two Supabase tables:
 *   job_tracking      → shared by both of you: archived (one row per job)
 *   personal_tracking → per person: status + note (one row per job per person)
 * Jobs nobody has touched have no rows (they show as "New").
 */

const ROWS_PER_PAGE = 1000 // Supabase returns at most 1000 rows per request

/**
 * Who is looking at the board. Cloudflare Access answers this at a fixed address on our own domain.
 * On your laptop (npm run dev) Cloudflare isn't in front, so VITE_DEV_USER_EMAIL from .env is used.
 */
export async function fetchCurrentUserEmail() {
  if (import.meta.env.DEV) return import.meta.env.VITE_DEV_USER_EMAIL
  const response = await fetch('/cdn-cgi/access/get-identity')
  if (!response.ok) throw new Error(`Could not find out who is signed in (HTTP ${response.status})`)
  const identity = await response.json()
  return identity.email.toLowerCase()
}

/** Reads every row of a table, 1000 at a time. orderColumns keep paging from skipping or repeating rows. */
async function fetchAllRows(tableName, columns, orderColumns) {
  const allRows = []
  let pageStart = 0

  while (true) {
    let query = supabase.from(tableName).select(columns)
    for (const orderColumn of orderColumns) query = query.order(orderColumn)
    const { data: pageOfRows, error } = await query.range(pageStart, pageStart + ROWS_PER_PAGE - 1)

    if (error) throw new Error(`Could not load ${tableName}: ${error.message}`)

    allRows.push(...pageOfRows)
    if (pageOfRows.length < ROWS_PER_PAGE) break
    pageStart += ROWS_PER_PAGE
  }
  return allRows
}

/**
 * Returns a Map: job key → { company, job_id, archived, status, note, statusChangedAt, otherPeople }
 * status / note / statusChangedAt are YOURS. otherPeople = [{ person, status, statusChangedAt }]
 * holds everyone else's status — never their note, which stays private.
 */
export async function fetchJobTracking(currentUserEmail) {
  const [sharedRows, personalRows] = await Promise.all([
    fetchAllRows('job_tracking', 'company, job_id, archived', ['company', 'job_id']),
    fetchAllRows('personal_tracking', 'company, job_id, person, status, note, status_changed_at', ['company', 'job_id', 'person']),
  ])

  const trackingByJobKey = new Map()
  const getOrCreateTracking = (company, jobId) => {
    const key = makeJobKey(company, jobId)
    if (!trackingByJobKey.has(key)) {
      trackingByJobKey.set(key, {
        company,
        job_id: jobId,
        archived: false,
        status: 'new',
        note: null,
        statusChangedAt: null,
        otherPeople: [],
      })
    }
    return trackingByJobKey.get(key)
  }

  for (const sharedRow of sharedRows) {
    getOrCreateTracking(sharedRow.company, sharedRow.job_id).archived = sharedRow.archived
  }

  for (const personalRow of personalRows) {
    const tracking = getOrCreateTracking(personalRow.company, personalRow.job_id)
    if (personalRow.person === currentUserEmail) {
      tracking.status = personalRow.status
      tracking.note = personalRow.note
      tracking.statusChangedAt = personalRow.status_changed_at
    } else {
      tracking.otherPeople.push({
        person: personalRow.person,
        status: personalRow.status,
        statusChangedAt: personalRow.status_changed_at,
      })
    }
  }

  return trackingByJobKey
}

/**
 * Save only the parts that changed:
 *   archived        → job_tracking (shared)
 *   status / note   → personal_tracking, under your email
 * Each upsert creates the row the first time and updates it after that.
 */
export async function saveJobTracking(tracking, changes, currentUserEmail) {
  const { company, job_id } = tracking

  if ('archived' in changes) {
    const { error } = await supabase.from('job_tracking').upsert(
      { company, job_id, archived: tracking.archived, updated_at: new Date().toISOString() },
      { onConflict: 'company,job_id' },
    )
    if (error) throw new Error(`Could not save archive: ${error.message}`)
  }

  if ('status' in changes || 'note' in changes) {
    const { error } = await supabase.from('personal_tracking').upsert(
      {
        company,
        job_id,
        person: currentUserEmail,
        status: tracking.status,
        note: tracking.note || null,
        status_changed_at: tracking.statusChangedAt,
      },
      { onConflict: 'company,job_id,person' }, // one row per job per person
    )
    if (error) throw new Error(`Could not save status: ${error.message}`)
  }
}

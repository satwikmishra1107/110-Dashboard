import { makeJobKey } from '../lib/constants'
import { supabase } from '../lib/supabaseClient'

/*
 * Resume matching, from three Supabase tables (created by supabase/resume-matching.sql):
 *   resumes         → every resume you've uploaded (v1, v2…). The scraper scores against the newest.
 *   resume_settings → your Gemini key, where "weak match" starts, and how scoring last went (one row per person)
 *   job_scores      → the scraper's score for each Board job, one row per job per person
 * The scoring itself happens in the scraper (career-watcher/score/score-jobs.mjs), once an hour.
 */

export const DEFAULT_WEAK_CUTOFF = 60
const ROWS_PER_PAGE = 1000 // Supabase returns at most 1000 rows per request

/**
 * → { latestResume: { version, fileName, createdAt } | null,
 *     hasKey, keyEnding ('…a1b2'), weakCutoff, keyError, lastScoredAt }
 */
export async function fetchResumeProfile(currentUserEmail) {
  const [resumeResult, settingsResult] = await Promise.all([
    supabase
      .from('resumes')
      .select('version, file_name, created_at')
      .eq('person', currentUserEmail)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('resume_settings')
      .select('gemini_api_key, weak_cutoff, key_error, last_scored_at')
      .eq('person', currentUserEmail)
      .maybeSingle(),
  ])
  if (resumeResult.error) throw new Error(`Could not load your resume: ${resumeResult.error.message}`)
  if (settingsResult.error) throw new Error(`Could not load resume settings: ${settingsResult.error.message}`)

  const resume = resumeResult.data
  const settings = settingsResult.data
  const key = settings?.gemini_api_key?.trim() ?? ''
  return {
    latestResume: resume ? { version: resume.version, fileName: resume.file_name, createdAt: resume.created_at } : null,
    hasKey: Boolean(key),
    keyEnding: key ? `…${key.slice(-4)}` : null, // enough to recognise which key is saved
    weakCutoff: settings?.weak_cutoff ?? DEFAULT_WEAK_CUTOFF,
    keyError: settings?.key_error ?? null,
    lastScoredAt: settings?.last_scored_at ?? null,
  }
}

/**
 * Asks Google whether the key works, without using any of its free requests (it only lists models).
 * → 'valid', 'invalid', or 'unknown' (couldn't reach Google — the key is saved anyway)
 */
export async function checkGeminiKey(key) {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
      headers: { 'x-goog-api-key': key },
    })
    if (response.ok) return 'valid'
    return response.status === 400 || response.status === 401 || response.status === 403 ? 'invalid' : 'unknown'
  } catch {
    return 'unknown'
  }
}

/** Saves your Gemini key. Clears any old "key rejected" message, since this is a new key. */
export async function saveGeminiKey(key, currentUserEmail) {
  const { error } = await supabase.from('resume_settings').upsert(
    { person: currentUserEmail, gemini_api_key: key.trim(), key_error: null, updated_at: new Date().toISOString() },
    { onConflict: 'person' },
  )
  if (error) throw new Error(`Could not save your key: ${error.message}`)
}

export async function saveWeakCutoff(weakCutoff, currentUserEmail) {
  const { error } = await supabase.from('resume_settings').upsert(
    { person: currentUserEmail, weak_cutoff: weakCutoff, updated_at: new Date().toISOString() },
    { onConflict: 'person' },
  )
  if (error) throw new Error(`Could not save the cutoff: ${error.message}`)
}

/** Saves the resume's text as your next version (v1, then v2…). Returns the new version number. */
export async function saveResume({ fileName, resumeText }, currentUserEmail) {
  const { data: latest, error: loadError } = await supabase
    .from('resumes')
    .select('version')
    .eq('person', currentUserEmail)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (loadError) throw new Error(`Could not save your resume: ${loadError.message}`)

  const version = (latest?.version ?? 0) + 1
  const { error } = await supabase
    .from('resumes')
    .insert({ person: currentUserEmail, version, file_name: fileName, resume_text: resumeText })
  if (error) throw new Error(`Could not save your resume: ${error.message}`)
  return version
}

/**
 * Your scores, as a Map: job key → { score, reason, skillsMatched, skillsMissing, resumeVersion, scoredAt }
 * Only yours: everyone is scored against their own resume.
 */
export async function fetchJobScores(currentUserEmail) {
  const scoresByJobKey = new Map()
  for (let pageStart = 0; ; pageStart += ROWS_PER_PAGE) {
    const { data: pageOfRows, error } = await supabase
      .from('job_scores')
      .select('company, job_id, score, reason, skills_matched, skills_missing, resume_version, scored_at')
      .eq('person', currentUserEmail)
      .order('company')
      .order('job_id') // unique per person, so paging never skips or repeats a row
      .range(pageStart, pageStart + ROWS_PER_PAGE - 1)
    if (error) throw new Error(`Could not load match scores: ${error.message}`)

    for (const row of pageOfRows) {
      scoresByJobKey.set(makeJobKey(row.company, row.job_id), {
        score: row.score,
        reason: row.reason,
        skillsMatched: row.skills_matched ?? [],
        skillsMissing: row.skills_missing ?? [],
        resumeVersion: row.resume_version,
        scoredAt: row.scored_at,
      })
    }
    if (pageOfRows.length < ROWS_PER_PAGE) return scoresByJobKey
  }
}

/** Deletes your scores made with an older resume, so the next hourly run scores those jobs again with the newest one. */
export async function deleteOutdatedScores(latestVersion, currentUserEmail) {
  const { error } = await supabase
    .from('job_scores')
    .delete()
    .eq('person', currentUserEmail)
    .lt('resume_version', latestVersion)
  if (error) throw new Error(`Could not clear old scores: ${error.message}`)
}

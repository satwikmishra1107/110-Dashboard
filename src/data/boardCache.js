/*
 * The last board this browser loaded, kept in localStorage so the next visit can show it instantly
 * while fresh data loads in the background. Only a speed-up: if it's missing, too old, or the
 * browser blocks storage, the board just loads the normal way.
 * Holds your own statuses and notes and the others' statuses — never anyone else's note.
 */

const CACHE_KEY = 'job-board-cache-v1'
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000 // older than a day isn't worth showing, even for a second

/** → { savedAt, userEmail, recentJobs, olderJobs, jobTracking (Map), hiddenTitles (Set), latestRuns } or null */
export function readBoardCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY))
    if (!cached || Date.now() - cached.savedAt > MAX_CACHE_AGE_MS) return null
    return {
      ...cached,
      jobTracking: new Map(cached.jobTracking),
      hiddenTitles: new Set(cached.hiddenTitles),
    }
  } catch {
    return null
  }
}

export function writeBoardCache({ userEmail, recentJobs, olderJobs, jobTracking, hiddenTitles, latestRuns }) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        userEmail,
        recentJobs,
        olderJobs,
        jobTracking: [...jobTracking],
        hiddenTitles: [...hiddenTitles],
        latestRuns,
      }),
    )
  } catch {
    // Storage full or blocked: skip caching, nothing else depends on it
  }
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readBoardCache, writeBoardCache } from '../data/boardCache'
import { fetchJobs } from '../data/fetchJobs'
import { fetchLatestRuns } from '../data/fetchRuns'
import { fetchHiddenTitles, hideTitle, unhideTitle } from '../data/hiddenTitles'
import { fetchCurrentUserEmail, fetchJobTracking, saveJobTracking } from '../data/jobTracking'
import { ARCHIVE_MAX_DAYS, AUTO_REFRESH_MS, BOARD_DAYS, makeJobKey, normalizeTitle } from '../lib/constants'

const MIN_TIME_BETWEEN_FOCUS_REFRESHES_MS = 30_000
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

/** Midnight at the start of the Board's oldest day: today + the 6 days before it */
function getBoardStart(now) {
  const boardStart = new Date(now)
  boardStart.setHours(0, 0, 0, 0)
  boardStart.setDate(boardStart.getDate() - (BOARD_DAYS - 1))
  return boardStart
}

/** Recent + older jobs as one list (a reposted job can be in both), newest board time first. */
function mergeJobs(recentJobs, olderJobs) {
  const jobsByKey = new Map()
  for (const job of [...(olderJobs ?? []), ...recentJobs]) jobsByKey.set(makeJobKey(job.company, job.job_id), job)
  // A job's board time is when it was reposted, or else when it was first seen
  const boardTime = (job) => new Date(job.reposted_at ?? job.first_seen_at).getTime()
  return [...jobsByKey.values()].sort((firstJob, secondJob) => boardTime(secondJob) - boardTime(firstJob))
}

/**
 * Holds the data the Board and Archive show, and keeps it fresh.
 *
 * Opening the page:
 *   1. The last board this browser loaded (boardCache) shows straight away, if there is one
 *   2. Board data loads: the last 7 days of jobs + tracking + hidden titles. The board shows as soon as these arrive.
 *   3. Then, in the background: older jobs (8–30 days, for the Archive and the header counts)
 *   Alongside: when each scraper last ran, for the header. The Scraper health tab loads its own runs (useScraperRuns).
 *
 * Data IN (from Supabase):
 *   fetchJobs()             → jobs: recent (Board), then older (Archive)
 *   fetchCurrentUserEmail() → who is signed in (asked once; only tracking and saves wait for it)
 *   fetchJobTracking()      → shared archived + your status / note + the others' status
 *   fetchHiddenTitles()     → titles you always hide
 *   fetchLatestRuns()       → when each scraper last finished
 * Data OUT:
 *   updateJob()         → saves archived to job_tracking, status / note to personal_tracking
 *   toggleHiddenTitle() → saves to the hidden_titles table
 */
export function useJobData() {
  const [cached] = useState(readBoardCache)
  const [recentJobs, setRecentJobs] = useState(cached?.recentJobs ?? [])
  // Jobs first seen 8–30 days ago. null until loaded.
  const [olderJobs, setOlderJobs] = useState(cached?.olderJobs ?? null)
  // What you've done with each job (status, note, archived), looked up by makeJobKey(company, job_id)
  const [jobTracking, setJobTracking] = useState(() => cached?.jobTracking ?? new Map())
  const [hiddenTitles, setHiddenTitles] = useState(() => cached?.hiddenTitles ?? new Set())
  const [latestRuns, setLatestRuns] = useState(cached?.latestRuns ?? [])
  const [currentUserEmail, setCurrentUserEmail] = useState(cached?.userEmail ?? null)
  // With a cached board there's something to show already, so it isn't a "first load"
  const [isFirstLoad, setIsFirstLoad] = useState(!cached)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState(null)

  const lastLoadedAt = useRef(0)
  // The Board start the older jobs were loaded for. They're loaded once a day (or on Refresh).
  const olderJobsLoadedFor = useRef(null)
  // Only cache data that came from Supabase in this visit, not the cached copy itself
  const hasFreshData = useRef(false)
  // Who is signed in: asked once, shared by every load and save
  const userEmailRequest = useRef(null)
  // Edits that are still being saved. A refresh must not overwrite them with older data.
  const unsavedEdits = useRef(new Map())
  // Always the newest jobTracking, readable inside callbacks without waiting for a re-render
  const latestJobTracking = useRef(jobTracking)
  useEffect(() => {
    latestJobTracking.current = jobTracking
  }, [jobTracking])

  const getUserEmail = useCallback(() => {
    if (!userEmailRequest.current) {
      userEmailRequest.current = fetchCurrentUserEmail().catch((error) => {
        userEmailRequest.current = null // ask again next time
        throw error
      })
    }
    return userEmailRequest.current
  }, [])

  const loadOlderJobs = useCallback(async (boardStart, shouldReload) => {
    if (!shouldReload && olderJobsLoadedFor.current === boardStart.getTime()) return
    olderJobsLoadedFor.current = boardStart.getTime()
    try {
      const archiveStart = new Date(Date.now() - ARCHIVE_MAX_DAYS * MILLISECONDS_PER_DAY)
      setOlderJobs(await fetchJobs({ since: archiveStart, firstSeenBefore: boardStart }))
    } catch (error) {
      olderJobsLoadedFor.current = null // try again on the next refresh
      setLoadError(error.message || 'Could not load older jobs')
    }
  }, [])

  /** shouldReloadOlderJobs: also reload the 8–30 day jobs (Refresh button); otherwise once a day is enough. */
  const loadData = useCallback(async ({ shouldReloadOlderJobs = false } = {}) => {
    setIsRefreshing(true)
    const boardStart = getBoardStart(new Date())

    // The header's "last scraped" doesn't hold up the board
    fetchLatestRuns().then(setLatestRuns).catch((error) => console.error(error))

    let didLoadBoard = false
    try {
      // Only tracking needs to know who's signed in; jobs and hidden titles start straight away
      const userEmailPromise = getUserEmail()
      const [loadedJobs, loadedTracking, loadedHiddenTitles, userEmail] = await Promise.all([
        fetchJobs({ since: boardStart }),
        userEmailPromise.then(fetchJobTracking),
        fetchHiddenTitles(),
        userEmailPromise,
      ])

      // Put back any edit that is still being saved, so the screen doesn't jump back
      for (const [key, unsavedTracking] of unsavedEdits.current) loadedTracking.set(key, unsavedTracking)

      hasFreshData.current = true
      setCurrentUserEmail(userEmail)
      setRecentJobs(loadedJobs)
      setJobTracking(loadedTracking)
      setHiddenTitles(loadedHiddenTitles)
      setLoadError(null)
      didLoadBoard = true
    } catch (error) {
      setLoadError(error.message || 'Could not load jobs')
    } finally {
      lastLoadedAt.current = Date.now()
      setIsFirstLoad(false)
      setIsRefreshing(false)
    }

    // Now that the board is showing: the Archive's older jobs
    if (didLoadBoard) loadOlderJobs(boardStart, shouldReloadOlderJobs)
  }, [getUserEmail, loadOlderJobs])

  const reload = useCallback(() => loadData({ shouldReloadOlderJobs: true }), [loadData])

  // Load once, then every 5 minutes, and again when you come back to the tab
  useEffect(() => {
    loadData()
    const refreshTimer = setInterval(() => loadData(), AUTO_REFRESH_MS)

    const refreshWhenTabIsVisible = () => {
      const loadedRecently = Date.now() - lastLoadedAt.current < MIN_TIME_BETWEEN_FOCUS_REFRESHES_MS
      if (document.visibilityState === 'visible' && !loadedRecently) loadData()
    }
    document.addEventListener('visibilitychange', refreshWhenTabIsVisible)
    window.addEventListener('focus', refreshWhenTabIsVisible)

    return () => {
      clearInterval(refreshTimer)
      document.removeEventListener('visibilitychange', refreshWhenTabIsVisible)
      window.removeEventListener('focus', refreshWhenTabIsVisible)
    }
  }, [loadData])

  // Keep the browser's copy up to date for the next visit
  useEffect(() => {
    if (!hasFreshData.current) return
    writeBoardCache({ userEmail: currentUserEmail, recentJobs, olderJobs, jobTracking, hiddenTitles, latestRuns })
  }, [currentUserEmail, recentJobs, olderJobs, jobTracking, hiddenTitles, latestRuns])

  const jobs = useMemo(() => mergeJobs(recentJobs, olderJobs), [recentJobs, olderJobs])

  /** Change a job's status, note or archived flag, e.g. updateJob(job, { archived: true }). */
  const updateJob = useCallback(async (job, changes) => {
    const key = makeJobKey(job.company, job.job_id)
    // Start from the newest version, including an edit that may still be saving
    const previousTracking = unsavedEdits.current.get(key) ?? latestJobTracking.current.get(key)
    const updatedTracking = {
      company: job.company,
      job_id: job.job_id,
      status: 'new',
      note: null,
      archived: false,
      statusChangedAt: null,
      otherPeople: [],
      ...previousTracking,
      ...changes,
    }
    // Start the "you asked X ago" clock only when the status itself changes, not on note edits
    if ('status' in changes) updatedTracking.statusChangedAt = new Date().toISOString()

    // 1. Update the screen straight away
    unsavedEdits.current.set(key, updatedTracking)
    setJobTracking((currentTracking) => new Map(currentTracking).set(key, updatedTracking))

    // 2. Save to Supabase
    try {
      await saveJobTracking(updatedTracking, changes, await getUserEmail())
      // Saved. Stop protecting it, unless a newer edit for the same job came in meanwhile.
      if (unsavedEdits.current.get(key) === updatedTracking) unsavedEdits.current.delete(key)
    } catch (error) {
      console.error(error)
      if (unsavedEdits.current.get(key) !== updatedTracking) return // a newer edit replaced this one
      // 3. Saving failed: put the screen back how it was
      unsavedEdits.current.delete(key)
      setJobTracking((currentTracking) => {
        const restoredTracking = new Map(currentTracking)
        if (previousTracking) restoredTracking.set(key, previousTracking)
        else restoredTracking.delete(key)
        return restoredTracking
      })
    }
  }, [getUserEmail])

  /** "Always hide this title" / "Stop hiding this title" for the job's title. */
  const toggleHiddenTitle = useCallback(async (job) => {
    const title = normalizeTitle(job.title)
    const isCurrentlyHidden = hiddenTitles.has(title)

    // 1. Update the screen straight away
    const setTitleHiddenOnScreen = (shouldHide) =>
      setHiddenTitles((currentTitles) => {
        const updatedTitles = new Set(currentTitles)
        if (shouldHide) updatedTitles.add(title)
        else updatedTitles.delete(title)
        return updatedTitles
      })
    setTitleHiddenOnScreen(!isCurrentlyHidden)

    // 2. Save to Supabase; if that fails, undo the screen change
    try {
      if (isCurrentlyHidden) await unhideTitle(title)
      else await hideTitle(title)
    } catch (error) {
      console.error(error)
      setTitleHiddenOnScreen(isCurrentlyHidden)
    }
  }, [hiddenTitles])

  return {
    currentUserEmail, // null until we know who's signed in (from the cache, or the first load)
    jobs,
    isOlderJobsLoaded: olderJobs !== null,
    jobTracking,
    latestRuns,
    hiddenTitles,
    isFirstLoad,
    isRefreshing,
    loadError,
    reload,
    updateJob,
    toggleHiddenTitle,
  }
}

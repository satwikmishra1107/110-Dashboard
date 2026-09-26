import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchJobs } from '../data/fetchJobs'
import { fetchRuns } from '../data/fetchRuns'
import { fetchHiddenTitles, hideTitle, unhideTitle } from '../data/hiddenTitles'
import { fetchJobTracking, saveJobTracking } from '../data/jobTracking'
import { AUTO_REFRESH_MS, makeJobKey, normalizeTitle } from '../lib/constants'

const MIN_TIME_BETWEEN_FOCUS_REFRESHES_MS = 30_000

/**
 * Holds all the data the app shows, and keeps it fresh.
 *
 * Data IN (all from Supabase, loaded together):
 *   fetchJobs()         → jobs
 *   fetchJobTracking()  → your status / note / archived per job
 *   fetchHiddenTitles() → titles you always hide
 *   fetchRuns()         → scraper runs from the last 24 hours
 * Data OUT:
 *   updateJob()         → saves to the job_tracking table
 *   toggleHiddenTitle() → saves to the hidden_titles table
 */
export function useJobData() {
  const [jobs, setJobs] = useState([])
  // What you've done with each job (status, note, archived), looked up by makeJobKey(company, job_id)
  const [jobTracking, setJobTracking] = useState(() => new Map())
  const [runs, setRuns] = useState([])
  const [hiddenTitles, setHiddenTitles] = useState(() => new Set())
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState(null)

  const lastLoadedAt = useRef(0)
  // Edits that are still being saved. A refresh must not overwrite them with older data.
  const unsavedEdits = useRef(new Map())
  // Always the newest jobTracking, readable inside callbacks without waiting for a re-render
  const latestJobTracking = useRef(jobTracking)
  useEffect(() => {
    latestJobTracking.current = jobTracking
  }, [jobTracking])

  const loadData = useCallback(async () => {
    setIsRefreshing(true)
    try {
      // All four requests go out at the same time; wait for all of them
      const [loadedJobs, loadedTracking, loadedHiddenTitles, loadedRuns] = await Promise.all([
        fetchJobs(),
        fetchJobTracking(),
        fetchHiddenTitles(),
        fetchRuns(),
      ])

      // Put back any edit that is still being saved, so the screen doesn't jump back
      for (const [key, unsavedTracking] of unsavedEdits.current) loadedTracking.set(key, unsavedTracking)

      setJobs(loadedJobs)
      setJobTracking(loadedTracking)
      setHiddenTitles(loadedHiddenTitles)
      setRuns(loadedRuns)
      setLoadError(null)
    } catch (error) {
      setLoadError(error.message || 'Could not load jobs')
    } finally {
      lastLoadedAt.current = Date.now()
      setIsFirstLoad(false)
      setIsRefreshing(false)
    }
  }, [])

  // Load once, then every 5 minutes, and again when you come back to the tab
  useEffect(() => {
    loadData()
    const refreshTimer = setInterval(loadData, AUTO_REFRESH_MS)

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
      ...previousTracking,
      ...changes,
    }

    // 1. Update the screen straight away
    unsavedEdits.current.set(key, updatedTracking)
    setJobTracking((currentTracking) => new Map(currentTracking).set(key, updatedTracking))

    // 2. Save to Supabase
    try {
      await saveJobTracking(updatedTracking)
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
  }, [])

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
    jobs,
    jobTracking,
    runs,
    hiddenTitles,
    isFirstLoad,
    isRefreshing,
    loadError,
    reload: loadData,
    updateJob,
    toggleHiddenTitle,
  }
}
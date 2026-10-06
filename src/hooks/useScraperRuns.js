import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchRuns } from '../data/fetchRuns'
import { AUTO_REFRESH_MS } from '../lib/constants'

/**
 * The Scraper health tab's runs (7 days of totals + 48 hours of detail). Loaded the first time
 * the tab opens, refreshed every 5 minutes while it stays open, and kept when you switch away.
 */
export function useScraperRuns(isHealthTabOpen) {
  const [runs, setRuns] = useState(null) // null until loaded
  const [isLoadingRuns, setIsLoadingRuns] = useState(false)
  const [runsError, setRunsError] = useState(null)
  const lastLoadedAt = useRef(0)

  const loadRuns = useCallback(async () => {
    setIsLoadingRuns(true)
    try {
      setRuns(await fetchRuns())
      setRunsError(null)
    } catch (error) {
      setRunsError(error.message || 'Could not load scraper runs')
    } finally {
      lastLoadedAt.current = Date.now()
      setIsLoadingRuns(false)
    }
  }, [])

  useEffect(() => {
    if (!isHealthTabOpen) return
    // Coming back to the tab within 5 minutes shows what's already loaded
    if (Date.now() - lastLoadedAt.current > AUTO_REFRESH_MS) loadRuns()
    const refreshTimer = setInterval(loadRuns, AUTO_REFRESH_MS)
    return () => clearInterval(refreshTimer)
  }, [isHealthTabOpen, loadRuns])

  return { runs, isLoadingRuns, runsError, reloadRuns: loadRuns }
}

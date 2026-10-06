import { useCallback, useEffect, useState } from 'react'
import { SOURCES, STATUSES, TIME_RANGES, findPersonBySlug } from '../lib/constants'

const TABS = ['board', 'archive', 'health']

const DEFAULT_FILTERS = {
  tab: 'board',
  range: '7d',
  sources: [],
  statuses: [],
  search: '',
  by: null, // whose status the Status filter looks at: null = yours, or a person's slug like 'deepak'
}

/** "lever,ashby" → ['lever', 'ashby'], dropping anything not in allowedValues */
function readList(text, allowedValues) {
  if (!text) return []
  return text.split(',').filter((value) => allowedValues.includes(value))
}

/** URL → filters. Example: ?tab=archive&status=applied&q=google&by=deepak */
function readFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const tab = params.get('tab')
  const range = params.get('range')
  const by = params.get('by')?.toLowerCase()
  return {
    tab: TABS.includes(tab) ? tab : DEFAULT_FILTERS.tab,
    range: TIME_RANGES.some((timeRange) => timeRange.id === range) ? range : DEFAULT_FILTERS.range,
    sources: readList(params.get('source'), SOURCES),
    statuses: readList(params.get('status'), STATUSES),
    search: params.get('q') ?? '',
    by: by && findPersonBySlug(by) ? by : DEFAULT_FILTERS.by,
  }
}

/** Filters → URL. Default values are left out to keep the URL short. */
function buildUrl(filters) {
  const params = new URLSearchParams()
  if (filters.tab !== DEFAULT_FILTERS.tab) params.set('tab', filters.tab)
  if (filters.range !== DEFAULT_FILTERS.range) params.set('range', filters.range)
  if (filters.sources.length > 0) params.set('source', filters.sources.join(','))
  if (filters.statuses.length > 0) params.set('status', filters.statuses.join(','))
  if (filters.search) params.set('q', filters.search)
  if (filters.by) params.set('by', filters.by)

  const queryString = params.toString()
  return window.location.pathname + (queryString ? `?${queryString}` : '')
}

/** Filters that live in the URL, so refreshing or bookmarking keeps the same view. */
export function useUrlFilters() {
  const [filters, setFilters] = useState(readFiltersFromUrl)

  // Whenever filters change, rewrite the address bar (replaceState = no new history entry)
  useEffect(() => {
    window.history.replaceState(null, '', buildUrl(filters))
  }, [filters])

  // Browser back/forward → read the filters from the URL again
  useEffect(() => {
    const syncFromUrl = () => setFilters(readFiltersFromUrl())
    window.addEventListener('popstate', syncFromUrl)
    return () => window.removeEventListener('popstate', syncFromUrl)
  }, [])

  /** updateFilters({ search: 'pune' }) or updateFilters(current => ({ statuses: [...] })) */
  const updateFilters = useCallback((changes) => {
    setFilters((currentFilters) => {
      const changesToApply = typeof changes === 'function' ? changes(currentFilters) : changes
      return { ...currentFilters, ...changesToApply }
    })
  }, [])

  /** Clear everything except the tab and time range you're on. */
  const clearFilters = useCallback(() => {
    setFilters((currentFilters) => ({ ...DEFAULT_FILTERS, tab: currentFilters.tab, range: currentFilters.range }))
  }, [])

  const activeFilterCount =
    filters.sources.length + filters.statuses.length + (filters.search ? 1 : 0) + (filters.by ? 1 : 0)

  return { filters, updateFilters, clearFilters, activeFilterCount }
}
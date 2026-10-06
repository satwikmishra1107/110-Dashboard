import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BottomSheet from './components/BottomSheet'
import FilterPanel, { SearchBox } from './components/FilterPanel'
import Header from './components/Header'
import HealthView from './components/HealthView'
import { CloseIcon, FilterIcon } from './components/Icons'
import JobList, { EmptyState, LoadingSkeleton } from './components/JobList'
import NotepadPanel from './components/NotepadPanel'
import { useCurrentTime } from './hooks/useCurrentTime'
import { useIsDesktop } from './hooks/useIsDesktop'
import { useJobData } from './hooks/useJobData'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useTheme } from './hooks/useTheme'
import { useUrlFilters } from './hooks/useUrlFilters'
import { SOURCE_LABELS, STATUS_DETAILS, TIME_RANGES, findPersonBySlug, getPersonName } from './lib/constants'
import { prepareJobsForDisplay, countSummary, filterJobs } from './lib/jobFilters'
import { summarizeScraperHealth } from './lib/scraperHealth'

const SHORTCUTS = [
  ['/', 'Search'],
  ['j / k', 'Next / previous'],
  ['a', 'Applied'],
  ['r', 'Referral requested'],
  ['o', 'Open apply link'],
]

function OutlineButton({ children, className = '', ...buttonProps }) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 px-3 text-[13px] font-medium transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900 ${className}`}
      {...buttonProps}
    >
      {children}
    </button>
  )
}

function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-zinc-200 pr-1 pl-2.5 text-[12px] text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        className="grid size-5 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
      >
        <CloseIcon width={12} height={12} />
      </button>
    </span>
  )
}

function ShortcutList() {
  return (
    <div className="mt-2 border-t border-zinc-100 pt-4 dark:border-zinc-900">
      <h3 className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">Shortcuts</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 px-1 text-[12px] text-zinc-500 dark:text-zinc-400">
        {SHORTCUTS.map(([shortcutKey, description]) => (
          <div key={shortcutKey} className="contents">
            <dt>
              <kbd className="rounded border border-zinc-200 px-1.5 font-mono text-[11px] dark:border-zinc-800">{shortcutKey}</kbd>
            </dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default function App() {
  const { currentUserEmail, jobs, jobTracking, runs, hiddenTitles, isFirstLoad, isRefreshing, loadError, reload, updateJob, toggleHiddenTitle } =
    useJobData()
  const { filters, updateFilters, clearFilters, activeFilterCount } = useUrlFilters()
  const { theme, cycleTheme } = useTheme()
  const now = useCurrentTime()
  const isDesktop = useIsDesktop()

  const [selectedJobKey, setSelectedJobKey] = useState(null)
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const [isNotepadOpen, setIsNotepadOpen] = useState(false)
  const searchInputRef = useRef(null)

  // ---- Derived data: raw data + filters → what the screen shows ----
  const jobsWithStatus = useMemo(
    () => prepareJobsForDisplay(jobs, jobTracking, hiddenTitles, now),
    [jobs, jobTracking, hiddenTitles, now],
  )
  const summary = useMemo(() => (isFirstLoad ? null : countSummary(jobsWithStatus)), [jobsWithStatus, isFirstLoad])
  const health = useMemo(() => summarizeScraperHealth(runs, jobsWithStatus, now), [runs, jobsWithStatus, now])
  const { visibleJobs, filterCounts } = useMemo(
    () => filterJobs(jobsWithStatus, filters, currentUserEmail),
    [jobsWithStatus, filters, currentUserEmail],
  )

  // ?by=<your own name> is the same as no ?by= — drop it so "Mine" shows as picked
  useEffect(() => {
    if (filters.by && currentUserEmail && findPersonBySlug(filters.by) === currentUserEmail) updateFilters({ by: null })
  }, [filters.by, currentUserEmail, updateFilters])

  const isJobTab = filters.tab !== 'health'
  const selectedIndex = visibleJobs.findIndex((job) => job.key === selectedJobKey)
  const selectedJob = visibleJobs[selectedIndex] ?? null

  // Keep the selected job scrolled into view when moving with j / k
  useEffect(() => {
    if (!selectedJobKey) return
    const selectedElement = document.querySelector(`[data-job-key="${CSS.escape(selectedJobKey)}"]`)
    selectedElement?.scrollIntoView({ block: 'nearest' })
  }, [selectedJobKey])

  useKeyboardShortcuts(
    {
      focusSearch: () => searchInputRef.current?.focus(),
      moveSelection: (direction) => {
        if (visibleJobs.length === 0) return
        let nextIndex
        if (selectedIndex === -1) nextIndex = direction > 0 ? 0 : visibleJobs.length - 1
        else nextIndex = Math.min(visibleJobs.length - 1, Math.max(0, selectedIndex + direction))
        setSelectedJobKey(visibleJobs[nextIndex].key)
      },
      setSelectedStatus: (status) => {
        if (!selectedJob) return
        // Pressing the same key again sets the job back to "new"
        const newStatus = selectedJob.status === status ? 'new' : status
        updateJob(selectedJob, { status: newStatus })
      },
      openSelectedJob: () => {
        if (selectedJob) window.open(selectedJob.url, '_blank', 'noopener,noreferrer')
      },
      clearSelection: () => setSelectedJobKey(null),
    },
    isDesktop && isJobTab,
  )

  const changeTab = (tab) => {
    updateFilters({ tab })
    setSelectedJobKey(null)
  }

  const closeFilterSheet = useCallback(() => setIsFilterSheetOpen(false), [])

  // ---- Chips above the list, one per active filter ----
  const removeFromList = (listName, value) =>
    updateFilters((current) => ({ [listName]: current[listName].filter((item) => item !== value) }))

  const activeFilterChips = [
    ...(filters.by ? [{ id: 'by', label: `${getPersonName(findPersonBySlug(filters.by))}'s jobs`, onRemove: () => updateFilters({ by: null }) }] : []),
    ...filters.statuses.map((status) => ({ id: `status-${status}`, label: STATUS_DETAILS[status].label, onRemove: () => removeFromList('statuses', status) })),
    ...filters.sources.map((source) => ({ id: `source-${source}`, label: SOURCE_LABELS[source], onRemove: () => removeFromList('sources', source) })),
  ]
  if (filters.search) activeFilterChips.push({ id: 'search', label: `“${filters.search}”`, onRemove: () => updateFilters({ search: '' }) })

  const rangeLabel = TIME_RANGES.find((timeRange) => timeRange.id === filters.range).label.toLowerCase()
  const listDescription =
    filters.tab === 'archive'
      ? 'archived by you, 8–30 days old, or auto-hidden today'
      : filters.range === 'today'
        ? 'found today'
        : `found in the last ${rangeLabel}`

  // ---- Main list area: loading, error, empty, or the jobs ----
  let listContent
  if (isFirstLoad) {
    listContent = <LoadingSkeleton />
  } else if (loadError && jobs.length === 0) {
    listContent = (
      <EmptyState title="Couldn’t load jobs" description={loadError} action={<OutlineButton onClick={reload}>Try again</OutlineButton>} />
    )
  } else if (visibleJobs.length === 0 && activeFilterCount > 0) {
    listContent = (
      <EmptyState
        title="No jobs match these filters"
        action={<OutlineButton onClick={clearFilters}>Clear filters</OutlineButton>}
      />
    )
  } else if (visibleJobs.length === 0 && filters.tab === 'archive') {
    listContent = <EmptyState title="The archive is empty" description="Jobs you archive, jobs first seen 8–30 days ago, and today's auto-hidden jobs show up here." />
  } else if (visibleJobs.length === 0) {
    listContent = (
      <EmptyState
        title={filters.range === 'today' ? 'Nothing new today yet' : `Nothing new in the last ${rangeLabel}`}
        description="The scraper runs hourly — new openings will appear here."
        action={filters.range !== '7d' && <OutlineButton onClick={() => updateFilters({ range: '7d' })}>Show last 7 days</OutlineButton>}
      />
    )
  } else {
    listContent = (
      <JobList
        jobs={visibleJobs}
        now={now}
        layout={isDesktop ? 'row' : 'card'}
        isMuted={filters.tab === 'archive'}
        selectedJobKey={selectedJobKey}
        onSelectJob={setSelectedJobKey}
        onUpdateJob={updateJob}
        onToggleHiddenTitle={toggleHiddenTitle}
      />
    )
  }

  const filterPanel = (
    <FilterPanel filters={filters} updateFilters={updateFilters} filterCounts={filterCounts} currentUserEmail={currentUserEmail} />
  )
  const searchBox = (
    <SearchBox value={filters.search} onChange={(searchText) => updateFilters({ search: searchText })} inputRef={searchInputRef} />
  )

  return (
    <div className="lg:flex lg:h-dvh lg:flex-col">
      <Header
        activeTab={filters.tab}
        onChangeTab={changeTab}
        summary={summary}
        lastScrapedAt={health.lastScrapedAt}
        now={now}
        hasStaleSource={!isFirstLoad && health.staleSources.length > 0}
        isRefreshing={isRefreshing}
        onRefresh={reload}
        theme={theme}
        onCycleTheme={cycleTheme}
        isNotepadOpen={isNotepadOpen}
        onToggleNotepad={() => setIsNotepadOpen((isOpen) => !isOpen)}
      />

      <NotepadPanel isOpen={isNotepadOpen} onClose={() => setIsNotepadOpen(false)} />

      {loadError && jobs.length > 0 && (
        <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-[12px] text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Couldn’t refresh ({loadError}). Showing the last loaded data.{' '}
          <button type="button" onClick={reload} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {!isJobTab ? (
        <main className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {isFirstLoad ? <LoadingSkeleton /> : <HealthView health={health} now={now} />}
        </main>
      ) : (
        <div className="mx-auto w-full max-w-[1600px] lg:flex lg:min-h-0 lg:flex-1">
          {isDesktop && (
            <aside aria-label="Filters" className="w-64 shrink-0 bg-surface overflow-y-auto border-r border-zinc-200 px-4 py-5 xl:w-72 dark:border-zinc-800">
              <div className="pb-2">{searchBox}</div>
              {filterPanel}
              <ShortcutList />
            </aside>
          )}

          <main className="min-w-0 flex-1 pb-28 lg:overflow-y-auto lg:pb-10">
            {!isDesktop && <div className="px-4 pt-4">{searchBox}</div>}

            {!isFirstLoad && jobs.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 px-4 pt-4 text-[13px] text-zinc-500 dark:text-zinc-400">
                <span className="mr-1">
                  <span className="font-medium text-zinc-800 tabular-nums dark:text-zinc-200">{visibleJobs.length}</span>{' '}
                  {visibleJobs.length === 1 ? 'job' : 'jobs'} · {listDescription}
                </span>
                {activeFilterChips.map((chip) => (
                  <FilterChip key={chip.id} label={chip.label} onRemove={chip.onRemove} />
                ))}
                {activeFilterChips.length > 1 && (
                  <button type="button" onClick={clearFilters} className="text-[12px] text-accent-600 hover:underline dark:text-accent-400">
                    Clear all
                  </button>
                )}
              </div>
            )}

            {listContent}
          </main>
        </div>
      )}

      {/* Phone only: floating Filters button + bottom sheet */}
      {!isDesktop && isJobTab && (
        <button
          type="button"
          onClick={() => setIsFilterSheetOpen(true)}
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-30 inline-flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-900 px-5 text-[14px] font-medium text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
        >
          <FilterIcon />
          Filters
          {activeFilterCount > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-accent-500 px-1.5 text-[11px] text-white tabular-nums">
              {activeFilterCount}
            </span>
          )}
        </button>
      )}

      <BottomSheet
        isOpen={isFilterSheetOpen && !isDesktop}
        onClose={closeFilterSheet}
        title="Filters"
        footer={
          <div className="flex gap-2">
            <OutlineButton className="h-11 flex-1" onClick={clearFilters} disabled={activeFilterCount === 0}>
              Clear
            </OutlineButton>
            <button
              type="button"
              onClick={closeFilterSheet}
              className="h-11 flex-[2] rounded-md bg-accent-500 text-[14px] font-medium text-white hover:bg-accent-600"
            >
              Show {visibleJobs.length} {visibleJobs.length === 1 ? 'job' : 'jobs'}
            </button>
          </div>
        }
      >
        {filterPanel}
      </BottomSheet>
    </div>
  )
}
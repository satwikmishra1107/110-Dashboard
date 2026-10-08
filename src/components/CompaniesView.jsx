import { useMemo, useState } from 'react'
import { SOURCE_LABELS } from '../lib/constants'
import { NOISY_MIN_JOBS, countCompanyTotals } from '../lib/companyStats'
import { formatFullDateTime, formatTimeAgo } from '../lib/time'
import { SourceBadge } from './Badges'
import { SearchBox } from './FilterPanel'

// ---------- Small shared pieces ----------

function SectionHeading({ children, detail }) {
  return (
    <h2 className="mb-3 flex items-baseline gap-2 text-[12px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
      {children}
      {detail && <span className="font-normal tracking-normal normal-case text-zinc-400 dark:text-zinc-500">{detail}</span>}
    </h2>
  )
}

function StatTile({ label, value, detail, isActive, onClick }) {
  const className = `rounded-lg border bg-surface px-4 py-3.5 text-left transition-colors ${
    isActive ? 'border-accent-500 ring-1 ring-accent-500' : 'border-zinc-200 dark:border-zinc-800'
  } ${onClick ? 'hover:border-zinc-300 dark:hover:border-zinc-700' : ''}`
  const content = (
    <>
      <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">{detail}</p>
    </>
  )
  if (!onClick) return <div className={className}>{content}</div>
  return (
    <button type="button" onClick={onClick} aria-pressed={isActive} className={className}>
      {content}
    </button>
  )
}

const FLAG_DETAILS = {
  failing: { label: 'Failing', className: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
  silent: { label: 'Silent', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  noisy: { label: 'Noisy', className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
  notScraped: { label: 'Not scraped', className: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
}

const FLAG_HELP = {
  failing: 'Its latest check failed',
  silent: 'The scraper works, but no jobs in the last 30 days — the careers page or filters may have changed',
  noisy: `${NOISY_MIN_JOBS}+ jobs in 30 days and none passed your filters`,
  notScraped: 'Has jobs, but no scraper checked it in the last 48 hours — probably removed from the list',
}

function FlagPill({ flag }) {
  return (
    <span title={FLAG_HELP[flag]} className={`rounded px-1.5 text-[11px] font-medium whitespace-nowrap ${FLAG_DETAILS[flag].className}`}>
      {FLAG_DETAILS[flag].label}
    </span>
  )
}

/** "4 / 23" with a thin bar for the percentage, or a dash when nothing was found. */
function PassRate({ company }) {
  if (company.passPercent === null) return <span className="text-zinc-400 dark:text-zinc-600">—</span>
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden>
        <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${company.passPercent}%` }} />
      </span>
      <span className="w-9 text-right font-medium tabular-nums">{company.passPercent}%</span>
    </span>
  )
}

/** Green dot + 7-day success rate, or red with the latest error on hover. */
function ScraperStatus({ company }) {
  const { latestCheck } = company
  if (!latestCheck) return <span className="text-zinc-400 dark:text-zinc-600">—</span>
  const title = latestCheck.ok
    ? `Last checked ${formatFullDateTime(latestCheck.checkedAt)}`
    : `Failed ${formatFullDateTime(latestCheck.checkedAt)}: ${latestCheck.error ?? 'Unknown error'}`
  return (
    <span title={title} className="inline-flex items-center gap-1.5 tabular-nums">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${latestCheck.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {company.successPercent === null ? (latestCheck.ok ? 'OK' : 'Failing') : `${company.successPercent}%`}
    </span>
  )
}

// ---------- The table ----------

const SORTS = {
  found: { label: 'Jobs found', compare: (first, second) => second.jobsFound - first.jobsFound },
  passed: { label: 'Passed', compare: (first, second) => second.jobsPassed - first.jobsPassed || second.jobsFound - first.jobsFound },
  // Companies with nothing found go last; ties → more jobs first, so 12/40 isn't buried under 1/1
  passRate: {
    label: 'Pass rate',
    compare: (first, second) => (second.passPercent ?? -1) - (first.passPercent ?? -1) || second.jobsFound - first.jobsFound,
  },
  openNow: { label: 'Open now', compare: (first, second) => (second.latestCheck?.count ?? -1) - (first.latestCheck?.count ?? -1) },
  company: { label: 'Company', compare: (first, second) => first.company.localeCompare(second.company) },
}

const FILTERS = {
  all: () => true,
  failing: (company) => company.flags.failing,
  silent: (company) => company.flags.silent,
  noisy: (company) => company.flags.noisy,
  notScraped: (company) => company.flags.notScraped,
}

const GRID_CLASS = 'lg:grid lg:grid-cols-[minmax(0,1fr)_88px_80px_80px_72px_120px_96px] lg:items-center lg:gap-4'

function SortHeader({ sortId, activeSort, onSort, className = '' }) {
  const isActive = activeSort === sortId
  return (
    <button
      type="button"
      onClick={() => onSort(sortId)}
      aria-pressed={isActive}
      className={`text-left hover:text-zinc-800 dark:hover:text-zinc-200 ${isActive ? 'text-zinc-900 dark:text-zinc-100' : ''} ${className}`}
    >
      {SORTS[sortId].label}
      {isActive && <span aria-hidden> ↓</span>}
    </button>
  )
}

function CompanyRow({ company, now }) {
  const activeFlags = Object.keys(FLAG_DETAILS).filter((flag) => company.flags[flag])
  const hiddenSummary = company.topHideReasons.map(({ reason, count }) => `${reason} (${count})`).join(', ')

  return (
    <li className={`px-4 py-3 text-[13px] ${GRID_CLASS}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{company.company}</span>
          <SourceBadge source={company.source} />
          {activeFlags.map((flag) => (
            <FlagPill key={flag} flag={flag} />
          ))}
        </div>
        {hiddenSummary && (
          <p className="mt-0.5 truncate text-[12px] text-zinc-500 dark:text-zinc-400" title={`Kept out by: ${hiddenSummary}`}>
            Kept out by: {hiddenSummary}
          </p>
        )}
      </div>

      {/* On phones the numbers wrap under the name as label: value pairs */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-zinc-500 lg:contents lg:text-[13px] dark:text-zinc-400">
        <span className="lg:text-zinc-700 lg:dark:text-zinc-300">
          <span className="lg:hidden">Scraper </span>
          <ScraperStatus company={company} />
        </span>
        <span className="tabular-nums lg:text-right lg:text-zinc-700 lg:dark:text-zinc-300" title="Jobs the scraper matched on the careers page in its latest run">
          <span className="lg:hidden">Open now </span>
          {company.latestCheck ? company.latestCheck.count : '—'}
        </span>
        <span className="tabular-nums lg:text-right lg:text-zinc-700 lg:dark:text-zinc-300">
          <span className="lg:hidden">Found </span>
          {company.jobsFound}
        </span>
        <span className="tabular-nums lg:text-right lg:text-zinc-700 lg:dark:text-zinc-300">
          <span className="lg:hidden">Passed </span>
          {company.jobsPassed}
        </span>
        <span className="lg:text-zinc-700 lg:dark:text-zinc-300">
          <PassRate company={company} />
        </span>
        <span className="lg:text-right" title={company.lastPassedAt ? formatFullDateTime(company.lastPassedAt) : undefined}>
          <span className="lg:hidden">Last passed </span>
          {company.lastPassedAt ? formatTimeAgo(company.lastPassedAt, now) : '—'}
        </span>
      </div>
    </li>
  )
}

// ---------- The tab ----------

export default function CompaniesView({ companies, now }) {
  const [sortId, setSortId] = useState('found')
  const [filterId, setFilterId] = useState('all')
  const [search, setSearch] = useState('')

  const totals = useMemo(() => countCompanyTotals(companies), [companies])
  const visibleCompanies = useMemo(() => {
    const searchText = search.trim().toLowerCase()
    return companies
      .filter(FILTERS[filterId])
      .filter((company) => !searchText || `${company.company} ${SOURCE_LABELS[company.source]}`.toLowerCase().includes(searchText))
      .sort(SORTS[sortId].compare)
  }, [companies, filterId, search, sortId])

  // Clicking the tile that's already picked goes back to all companies
  const toggleFilter = (newFilterId) => setFilterId((current) => (current === newFilterId ? 'all' : newFilterId))

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <SectionHeading detail="jobs from the last 30 days · scraper checks from the last 7">Companies</SectionHeading>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="Pass rate"
          value={totals.passPercent === null ? '—' : `${totals.passPercent}%`}
          detail={`${totals.jobsPassed} of ${totals.jobsFound} jobs passed`}
        />
        <StatTile
          label="Failing"
          value={totals.failing}
          detail={`of ${totals.companies} companies`}
          isActive={filterId === 'failing'}
          onClick={() => toggleFilter('failing')}
        />
        <StatTile label="Silent" value={totals.silent} detail="working, but 0 jobs" isActive={filterId === 'silent'} onClick={() => toggleFilter('silent')} />
        <StatTile
          label="Noisy"
          value={totals.noisy}
          detail={`${NOISY_MIN_JOBS}+ jobs, none passed`}
          isActive={filterId === 'noisy'}
          onClick={() => toggleFilter('noisy')}
        />
        <StatTile
          label="Not scraped"
          value={totals.notScraped}
          detail="has jobs, no recent check"
          isActive={filterId === 'notScraped'}
          onClick={() => toggleFilter('notScraped')}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <SearchBox value={search} onChange={setSearch} placeholder="Company or source" />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-zinc-500 lg:hidden dark:text-zinc-400">
          Sort by
          <select
            value={sortId}
            onChange={(event) => setSortId(event.target.value)}
            className="h-9 rounded-md border border-zinc-200 bg-surface px-2 text-[13px] text-zinc-800 dark:border-zinc-800 dark:text-zinc-200"
          >
            {Object.entries(SORTS).map(([id, sort]) => (
              <option key={id} value={id}>
                {sort.label}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[13px] text-zinc-500 sm:ml-auto dark:text-zinc-400">
          <span className="font-medium text-zinc-800 tabular-nums dark:text-zinc-200">{visibleCompanies.length}</span>{' '}
          {visibleCompanies.length === 1 ? 'company' : 'companies'}
          {filterId !== 'all' && (
            <>
              {' · '}
              <button type="button" onClick={() => setFilterId('all')} className="text-accent-600 hover:underline dark:text-accent-400">
                show all
              </button>
            </>
          )}
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-surface dark:border-zinc-800">
        <div
          className={`hidden border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase lg:grid dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 ${GRID_CLASS}`}
        >
          <SortHeader sortId="company" activeSort={sortId} onSort={setSortId} />
          <span title="7-day success rate of the scraper for this company">Scraper</span>
          <SortHeader sortId="openNow" activeSort={sortId} onSort={setSortId} className="text-right" />
          <SortHeader sortId="found" activeSort={sortId} onSort={setSortId} className="text-right" />
          <SortHeader sortId="passed" activeSort={sortId} onSort={setSortId} className="text-right" />
          <SortHeader sortId="passRate" activeSort={sortId} onSort={setSortId} />
          <span className="text-right">Last passed</span>
        </div>
        {visibleCompanies.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-zinc-500 dark:text-zinc-400">No companies match.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {visibleCompanies.map((company) => (
              <CompanyRow key={company.key} company={company} now={now} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

import { HEALTH_DAYS, SOURCE_LABELS, SOURCES } from '../lib/constants'
import { formatClockTime, formatDayLabel, formatFullDateTime, formatShortDate, formatTimeAgo } from '../lib/time'
import { WarningIcon } from './Icons'

// ---------- Small shared pieces ----------

const PILL_TONES = {
  ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  neutral: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
}

function Pill({ tone, children }) {
  return <span className={`rounded px-1.5 text-[11px] font-medium whitespace-nowrap ${PILL_TONES[tone]}`}>{children}</span>
}

const DOT_TONES = { ok: 'bg-emerald-500', warning: 'bg-amber-400', neutral: 'bg-zinc-400' }

function StatusDot({ tone }) {
  return <span aria-hidden className={`size-2 shrink-0 rounded-full ${DOT_TONES[tone]}`} />
}

/** Amber if something never reported, grey if companies failed, green if everything passed. */
function RunStatusPill({ companiesFailed, missingSourceCount = 0 }) {
  if (missingSourceCount > 0) return <Pill tone="warning">{missingSourceCount} missing</Pill>
  if (companiesFailed > 0) return <Pill tone="neutral">{companiesFailed} failed</Pill>
  return <Pill tone="ok">OK</Pill>
}

function SectionHeading({ children, detail }) {
  return (
    <h2 className="mb-3 flex items-baseline gap-2 text-[12px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
      {children}
      {detail && <span className="font-normal tracking-normal normal-case text-zinc-400 dark:text-zinc-500">{detail}</span>}
    </h2>
  )
}

/** A › chevron that turns to point down when its <details> is open. `level` picks which <details> it follows. */
function ExpandArrow({ level }) {
  const rotateClass = { day: 'group-open/day:rotate-90', run: 'group-open/run:rotate-90', source: 'group-open/source:rotate-90' }[level]
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`size-3.5 shrink-0 text-zinc-400 transition-transform ${rotateClass}`}>
      <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Hides the browser's default ▸ marker on <summary>
const SUMMARY_CLASS = 'flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden'

/** "4 new · 1 updated" in green, or nothing when both are 0. */
function NewAndUpdated({ newCount, updatedCount }) {
  const parts = []
  if (newCount > 0) parts.push(`${newCount} new`)
  if (updatedCount > 0) parts.push(`${updatedCount} updated`)
  if (parts.length === 0) return null
  return <span className="font-medium text-emerald-700 dark:text-emerald-400">{parts.join(' · ')}</span>
}

// ---------- Sources: one card each ----------

function SourceCard({ summary, now }) {
  let tone = 'ok'
  let pill = <Pill tone="ok">OK</Pill>
  if (summary.isStale) {
    tone = 'warning'
    pill = <Pill tone="warning">Stale</Pill>
  } else if (summary.companiesFailed > 0) {
    tone = 'neutral'
    pill = <Pill tone="neutral">{summary.companiesFailed} failed</Pill>
  }

  return (
    <li className="rounded-lg border border-zinc-200 bg-surface p-4 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <StatusDot tone={tone} />
        <span className="text-[14px] font-semibold">{SOURCE_LABELS[summary.source]}</span>
        <span className="ml-auto">{pill}</span>
      </div>
      <p className="mt-3 text-[13px] text-zinc-700 dark:text-zinc-300" title={summary.lastRunAt ? formatFullDateTime(summary.lastRunAt) : undefined}>
        {summary.lastRunAt ? `Ran ${formatTimeAgo(summary.lastRunAt, now)}` : 'No runs recorded'}
      </p>
      {summary.lastRunAt && (
        <p className="mt-0.5 text-[12px] text-zinc-500 tabular-nums dark:text-zinc-400">
          {summary.companiesOk}/{summary.companiesChecked} companies ok
        </p>
      )}
    </li>
  )
}

// ---------- Last 7 days: stat tiles ----------

function StatTile({ label, value, detail }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-surface px-4 py-3.5 dark:border-zinc-800">
      <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">{detail}</p>
    </div>
  )
}

function WeekStats({ weekStats }) {
  const passedPercent = weekStats.jobsFound > 0 ? Math.round((weekStats.jobsPassed / weekStats.jobsFound) * 100) : 0
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Runs" value={weekStats.runCount} detail={`of about ${weekStats.expectedRuns} hourly runs`} />
      <StatTile
        label="Success rate"
        value={weekStats.successPercent === null ? '—' : `${weekStats.successPercent}%`}
        detail={weekStats.failedChecks > 0 ? `${weekStats.failedChecks} failed company checks` : 'no failed company checks'}
      />
      <StatTile label="New jobs" value={weekStats.jobsFound} detail="first seen in the last 7 days" />
      <StatTile label="Passed your filters" value={weekStats.jobsPassed} detail={`${passedPercent}% of new jobs`} />
    </div>
  )
}

// ---------- Run history: day → run → source → company ----------

/** Level 4: every company one source checked in this run, failures first. A small table on white. */
function CompanyResultTable({ companyResults }) {
  const failedFirst = [...companyResults].sort((firstResult, secondResult) => Number(firstResult.ok) - Number(secondResult.ok))
  return (
    <div className="mt-2 mb-2 ml-6 overflow-hidden rounded-md border border-zinc-200 bg-surface text-[12px] dark:border-zinc-800">
      <div className="flex justify-between bg-zinc-50 px-3 py-1.5 text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:bg-zinc-900 dark:text-zinc-400">
        <span>Company</span>
        <span>Jobs matched</span>
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
        {failedFirst.map((companyResult) => (
          <li key={companyResult.company} className="px-3 py-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-medium">
                <StatusDot tone={companyResult.ok ? 'ok' : 'warning'} />
                {companyResult.company}
              </span>
              {companyResult.ok ? (
                <span className="flex gap-2 text-zinc-500 tabular-nums dark:text-zinc-400">
                  <NewAndUpdated newCount={companyResult.newCount || 0} updatedCount={companyResult.updatedCount || 0} />
                  {companyResult.count}
                </span>
              ) : (
                <span className="font-medium text-amber-700 dark:text-amber-300">Failed</span>
              )}
            </div>
            {!companyResult.ok && (
              <p className="mt-1 pl-4 font-mono text-[11px] break-all text-zinc-600 dark:text-zinc-400">{companyResult.error || 'Unknown error'}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Level 3: one source inside a run. Click to see its companies. */
function SourceRowDetails({ sourceRow }) {
  const companiesOk = sourceRow.report.filter((companyResult) => companyResult.ok).length
  const newJobs = sourceRow.report.reduce((total, companyResult) => total + (companyResult.newCount || 0), 0)
  const updatedJobs = sourceRow.report.reduce((total, companyResult) => total + (companyResult.updatedCount || 0), 0)

  return (
    <details className="group/source py-2">
      <summary className={`${SUMMARY_CLASS} text-[13px]`}>
        <ExpandArrow level="source" />
        <span className="font-medium">{SOURCE_LABELS[sourceRow.source]}</span>
        <span className="text-[12px] text-zinc-500 dark:text-zinc-400" title={formatFullDateTime(sourceRow.scraped_at)}>
          finished {formatClockTime(sourceRow.scraped_at)}
        </span>
        <span className="ml-auto flex items-center gap-3 text-[12px] text-zinc-500 tabular-nums dark:text-zinc-400">
          <NewAndUpdated newCount={newJobs} updatedCount={updatedJobs} />
          <span>{companiesOk}/{sourceRow.report.length} ok</span>
          <RunStatusPill companiesFailed={sourceRow.report.length - companiesOk} />
        </span>
      </summary>
      <CompanyResultTable companyResults={sourceRow.report} />
    </details>
  )
}

/** Level 2: one hourly GitHub run. Click to see its sources, shown in an inset panel. */
function RunRowDetails({ runGroup, now }) {
  const reportedSources = new Set(runGroup.sourceRows.map((sourceRow) => sourceRow.source))
  const missingSources = SOURCES.filter((source) => !reportedSources.has(source))

  return (
    <details className="group/run border-t border-zinc-100 dark:border-zinc-800/70">
      <summary className={`${SUMMARY_CLASS} px-4 py-2.5 text-[13px] hover:bg-zinc-50 dark:hover:bg-zinc-800/40`}>
        <ExpandArrow level="run" />
        <span className="font-medium tabular-nums" title={formatFullDateTime(runGroup.ranAt)}>{formatClockTime(runGroup.ranAt)}</span>
        <span className="text-[12px] text-zinc-400 dark:text-zinc-500">{formatTimeAgo(runGroup.ranAt, now)}</span>
        <span className="ml-auto flex items-center gap-3 text-[12px] text-zinc-500 tabular-nums dark:text-zinc-400">
          <NewAndUpdated newCount={runGroup.newJobs} updatedCount={runGroup.updatedJobs} />
          <span>{runGroup.companiesOk}/{runGroup.companiesChecked} ok</span>
          <RunStatusPill companiesFailed={runGroup.companiesFailed} missingSourceCount={missingSources.length} />
        </span>
      </summary>

      <div className="mx-4 mb-3 ml-9 divide-y divide-zinc-200/70 rounded-r-md border-l-2 border-accent-500/40 bg-page px-3 dark:divide-zinc-800">
        {runGroup.sourceRows.map((sourceRow) => (
          <SourceRowDetails key={sourceRow.source} sourceRow={sourceRow} />
        ))}
        {/* A source with no row in this run: its step crashed before saveRun() */}
        {missingSources.map((source) => (
          <p key={source} className="py-2 pl-5 text-[13px] text-amber-800 dark:text-amber-300">
            {SOURCE_LABELS[source]} <span className="text-[12px] opacity-80">— didn’t report in this run</span>
          </p>
        ))}
      </div>
    </details>
  )
}

/** Level 1: one day. A shaded header bar; open it to see that day's runs. Today starts open. */
function DayDetails({ dayGroup, now }) {
  const isMissingRuns = !dayGroup.isToday && dayGroup.runGroups.length < dayGroup.expectedRuns
  return (
    <details open={dayGroup.isToday} className="group/day overflow-hidden rounded-lg border border-zinc-200 bg-surface dark:border-zinc-800">
      <summary className={`${SUMMARY_CLASS} bg-zinc-100/80 px-4 py-3 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800/70`}>
        <ExpandArrow level="day" />
        <span className="text-[14px] font-semibold">{formatDayLabel(dayGroup.dayStart, now)}</span>
        {dayGroup.isToday && <span className="text-[12px] text-zinc-500 dark:text-zinc-400">{formatShortDate(dayGroup.dayStart, true)}</span>}
        <span className="ml-auto flex items-center gap-4 text-[12px] text-zinc-500 tabular-nums dark:text-zinc-400">
          <span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{dayGroup.jobsFound}</span> new
            {' · '}
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{dayGroup.jobsPassed}</span> passed filters
          </span>
          <span className={isMissingRuns ? 'text-amber-700 dark:text-amber-300' : undefined}>
            {dayGroup.runGroups.length}/{dayGroup.expectedRuns} runs
          </span>
          {dayGroup.failedChecks > 0 ? <Pill tone="neutral">{dayGroup.failedChecks} failed</Pill> : <Pill tone="ok">OK</Pill>}
        </span>
      </summary>

      {dayGroup.runGroups.length === 0 ? (
        <p className="border-t border-zinc-100 px-4 py-4 text-[13px] text-zinc-500 dark:border-zinc-800/70 dark:text-zinc-400">No runs recorded this day.</p>
      ) : (
        dayGroup.runGroups.map((runGroup) => <RunRowDetails key={runGroup.runId} runGroup={runGroup} now={now} />)
      )}
    </details>
  )
}

// ---------- Failing companies: a terminal-style log, dark in both themes ----------

/** "██████░░░░" — failure rate as a 10-block text bar. */
function failureBar(percent) {
  const filledBlocks = Math.max(1, Math.round(percent / 10))
  return '█'.repeat(filledBlocks) + '░'.repeat(10 - filledBlocks)
}

/** Red when it fails a lot, amber when now and then, grey when rarely. */
function failureRateColor(percent) {
  if (percent >= 25) return 'text-red-400'
  if (percent >= 5) return 'text-amber-300'
  return 'text-zinc-400'
}

function RepeatFailureLines({ stats, now }) {
  return (
    <li className="py-1.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="font-semibold text-zinc-100">{stats.company}</span>
        <span className="text-zinc-500">{SOURCE_LABELS[stats.source]}</span>
        <span className={`tracking-tighter ${failureRateColor(stats.failurePercent)}`} aria-hidden>{failureBar(stats.failurePercent)}</span>
        <span className={failureRateColor(stats.failurePercent)}>
          {stats.failures}/{stats.checks} runs failed · {stats.failurePercent}%
        </span>
        {stats.isFailingNow ? <span className="text-red-400">[failing now]</span> : <span className="text-emerald-400">[recovered]</span>}
        <span className="text-zinc-500" title={formatFullDateTime(stats.lastFailedAt)}>last {formatTimeAgo(stats.lastFailedAt, now)}</span>
      </div>
      {stats.errors.map((error) => (
        <p key={error.message} className="mt-0.5 flex gap-2 pl-3 text-zinc-400">
          <span className="text-zinc-600">└─</span>
          <span className="shrink-0 text-amber-300/90">×{error.count}</span>
          <span className="[overflow-wrap:anywhere]">{error.message}</span>
        </p>
      ))}
    </li>
  )
}

function FailureTerminal({ failureSummary, now }) {
  const { repeatFailures, oneOffFailures, companiesChecked } = failureSummary
  const oneOffCount = oneOffFailures.reduce((total, group) => total + group.companies.length, 0)

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 font-mono text-[12px] leading-relaxed text-zinc-300 shadow-sm">
      {/* Title bar */}
      <div className="flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <span className="size-2.5 rounded-full bg-zinc-700" />
        <span className="size-2.5 rounded-full bg-zinc-700" />
        <span className="size-2.5 rounded-full bg-zinc-700" />
        <span className="ml-3 text-[11px] text-zinc-500">scraper — failures, last {HEALTH_DAYS} days</span>
      </div>

      <div className="px-4 py-3">
        <p>
          <span className="text-emerald-400">$</span> scraper failures --since {HEALTH_DAYS}d --sort frequency
        </p>
        <p className="text-zinc-500">
          {companiesChecked} companies checked · {repeatFailures.length} failing repeatedly · {oneOffCount} failed once
        </p>

        {repeatFailures.length === 0 && oneOffCount === 0 ? (
          <p className="mt-3 text-emerald-400">✓ no failures in the last {HEALTH_DAYS} days</p>
        ) : (
          <>
            {repeatFailures.length > 0 && (
              <ul className="mt-3 divide-y divide-zinc-800/70">
                {repeatFailures.map((stats) => (
                  <RepeatFailureLines key={`${stats.source}-${stats.company}`} stats={stats} now={now} />
                ))}
              </ul>
            )}

            {oneOffFailures.length > 0 && (
              <div className="mt-4">
                <p className="text-zinc-500"># failed only once — usually a one-off hiccup, nothing to fix</p>
                {oneOffFailures.map((group) => (
                  <div key={group.message} className="mt-1.5">
                    <p className="flex gap-2 text-zinc-400">
                      <span className="shrink-0 text-zinc-500">×{group.companies.length}</span>
                      <span className="[overflow-wrap:anywhere]">{group.message}</span>
                    </p>
                    <p className="pl-6 text-zinc-500">
                      {group.companies.map((stats) => stats.company).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <p className="mt-3">
          <span className="text-emerald-400">$</span> <span className="inline-block h-3.5 w-2 translate-y-0.5 motion-safe:animate-pulse bg-zinc-400" aria-hidden />
        </p>
      </div>
    </div>
  )
}

// ---------- The tab ----------

export default function HealthView({ health, now }) {
  const { sourceSummaries, failureSummary, staleSources, weekStats, dayGroups } = health

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      {staleSources.length > 0 && (
        <div role="alert" className="mb-6 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          <WarningIcon className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">
              {staleSources.length === 1 ? '1 source hasn’t' : `${staleSources.length} sources haven’t`} run in over 2 hours
            </p>
            <p className="mt-0.5 opacity-80">
              {staleSources
                .map((summary) => {
                  const lastRun = summary.lastRunAt ? formatTimeAgo(summary.lastRunAt, now) : 'never'
                  return `${SOURCE_LABELS[summary.source]} (${lastRun})`
                })
                .join(' · ')}
            </p>
          </div>
        </div>
      )}

      <SectionHeading detail="latest run of each">Sources</SectionHeading>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {sourceSummaries.map((summary) => (
          <SourceCard key={summary.source} summary={summary} now={now} />
        ))}
      </ul>

      <div className="mt-10">
        <SectionHeading detail={`today + the ${HEALTH_DAYS - 1} days before`}>Last {HEALTH_DAYS} days</SectionHeading>
        <WeekStats weekStats={weekStats} />
      </div>

      <div className="mt-10">
        <SectionHeading detail="click a day, run or source for details">Run history</SectionHeading>
        <div className="space-y-2">
          {dayGroups.map((dayGroup) => (
            <DayDetails key={dayGroup.dayStart} dayGroup={dayGroup} now={now} />
          ))}
        </div>
      </div>

      <div className="mt-10">
        <SectionHeading detail="most frequent first, last 7 days">Failing companies</SectionHeading>
        <FailureTerminal failureSummary={failureSummary} now={now} />
      </div>
    </div>
  )
}

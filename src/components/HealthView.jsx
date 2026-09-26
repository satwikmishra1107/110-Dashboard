import { SOURCE_LABELS, SOURCES } from '../lib/constants'
import { formatFullDateTime, formatTimeAgo } from '../lib/time'
import { CheckIcon, WarningIcon } from './Icons'

function SourceStatusPill({ summary }) {
  if (summary.isStale) {
    return <span className="rounded bg-amber-100 px-1.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">Stale</span>
  }
  if (summary.companiesFailed > 0) {
    return <span className="rounded bg-zinc-100 px-1.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{summary.companiesFailed} failed</span>
  }
  return <span className="rounded bg-emerald-50 px-1.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">OK</span>
}

// ---------- Last 24 hours: stats + run list ----------

function StatTile({ label, value, detail }) {
  return (
    <div className="rounded-lg border bg-surface border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-[20px] font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">{detail}</p>
    </div>
  )
}

function DayStats({ dayStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Runs" value={`${dayStats.runCount}/${dayStats.expectedRuns}`} detail="hourly GitHub runs" />
      <StatTile
        label="Success rate"
        value={dayStats.successPercent === null ? '—' : `${dayStats.successPercent}%`}
        detail="of company checks"
      />
      <StatTile label="Companies OK" value={`${dayStats.companiesOk}/${dayStats.companiesChecked}`} detail="checks across all runs" />
      <StatTile label="Jobs found" value={dayStats.jobsFound} detail="across all runs (with repeats)" />
    </div>
  )
}

/** Amber if a source never reported, grey if companies failed, green if everything passed. */
function RunStatusPill({ companiesFailed, missingSourceCount }) {
  if (missingSourceCount > 0) {
    return <span className="rounded bg-amber-100 px-1.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">{missingSourceCount} missing</span>
  }
  if (companiesFailed > 0) {
    return <span className="rounded bg-zinc-100 px-1.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{companiesFailed} failed</span>
  }
  return <span className="rounded bg-emerald-50 px-1.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">OK</span>
}

/** ▸ that turns into ▾ when its <details> is open. `isRunLevel` picks which <details> it follows. */
function ExpandArrow({ isRunLevel }) {
  const rotateClass = isRunLevel ? 'group-open/run:rotate-90' : 'group-open/source:rotate-90'
  return <span aria-hidden="true" className={`text-zinc-400 transition-transform ${rotateClass}`}>▸</span>
}

// Hides the browser's default ▸ marker on <summary>
const SUMMARY_CLASS = 'flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden'

/** Level 3: every company one source checked in this run, failures first. */
function CompanyResultList({ companyResults }) {
  const failedFirst = [...companyResults].sort((firstResult, secondResult) => Number(firstResult.ok) - Number(secondResult.ok))
  return (
    <ul className="mt-2 mb-1 ml-5 divide-y divide-zinc-100 rounded-md border border-zinc-200 bg-surface dark:divide-zinc-900 dark:border-zinc-800">
      {failedFirst.map((companyResult) => (
        <li key={companyResult.company} className="px-3 py-2 text-[12px]">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{companyResult.company}</span>
            {companyResult.ok ? (
              <span className="text-zinc-500 tabular-nums dark:text-zinc-400">{companyResult.count} jobs</span>
            ) : (
              <span className="font-medium text-amber-700 dark:text-amber-300">Failed</span>
            )}
          </div>
          {!companyResult.ok && (
            <p className="mt-1 font-mono text-[11px] break-all text-zinc-600 dark:text-zinc-400">{companyResult.error || 'Unknown error'}</p>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Level 2: one source inside a run. Click to see its companies. */
function SourceRowDetails({ sourceRow, now }) {
  const companiesOk = sourceRow.report.filter((companyResult) => companyResult.ok).length
  const companiesFailed = sourceRow.report.length - companiesOk
  const jobsFound = sourceRow.report.reduce((total, companyResult) => total + (companyResult.count || 0), 0)

  return (
    <details className="group/source py-1.5">
      <summary className={`${SUMMARY_CLASS} text-[13px]`}>
        <ExpandArrow isRunLevel={false} />
        <span className="font-medium">{SOURCE_LABELS[sourceRow.source]}</span>
        <span className="text-[12px] text-zinc-500 dark:text-zinc-400" title={formatFullDateTime(sourceRow.scraped_at)}>
          {formatTimeAgo(sourceRow.scraped_at, now)}
        </span>
        <span className="ml-auto flex items-center gap-3 text-[12px] text-zinc-500 tabular-nums dark:text-zinc-400">
          <span>{companiesOk}/{sourceRow.report.length} ok</span>
          <span>{jobsFound} jobs</span>
          <RunStatusPill companiesFailed={companiesFailed} missingSourceCount={0} />
        </span>
      </summary>
      <CompanyResultList companyResults={sourceRow.report} />
    </details>
  )
}

/** Level 1: one hourly GitHub run. Click to see its sources. */
function RunRowDetails({ runGroup, now }) {
  const reportedSources = new Set(runGroup.sourceRows.map((sourceRow) => sourceRow.source))
  const missingSources = SOURCES.filter((source) => !reportedSources.has(source))

  return (
    <details className="group/run">
      <summary className={`${SUMMARY_CLASS} px-4 py-3 text-[13px] hover:bg-zinc-50 dark:hover:bg-zinc-900/60`}>
        <ExpandArrow isRunLevel />
        <span className="font-medium" title={formatFullDateTime(runGroup.ranAt)}>{formatTimeAgo(runGroup.ranAt, now)}</span>
        <span className="ml-auto flex items-center gap-3 text-[12px] text-zinc-500 tabular-nums dark:text-zinc-400">
          <span>{runGroup.sourcesReported}/{SOURCES.length} sources</span>
          <span>{runGroup.companiesOk}/{runGroup.companiesChecked} ok</span>
          <span>{runGroup.jobsFound} jobs</span>
          <RunStatusPill companiesFailed={runGroup.companiesFailed} missingSourceCount={missingSources.length} />
        </span>
      </summary>

      <div className="divide-y divide-zinc-100 border-t border-zinc-100 bg-zinc-50/60 px-4 py-1 dark:divide-zinc-900 dark:border-zinc-900 dark:bg-zinc-900/30">
        {runGroup.sourceRows.map((sourceRow) => (
          <SourceRowDetails key={sourceRow.source} sourceRow={sourceRow} now={now} />
        ))}
        {/* A source with no row in this run: its step crashed before saveRun() */}
        {missingSources.map((source) => (
          <p key={source} className="py-1.5 pl-5 text-[13px] text-amber-800 dark:text-amber-300">
            {SOURCE_LABELS[source]} <span className="text-[12px] opacity-80">— didn’t report in this run</span>
          </p>
        ))}
      </div>
    </details>
  )
}

function RunList({ runGroups, now }) {
  if (runGroups.length === 0) {
    return (
      <div className="mt-3 rounded-lg border bg-surface border-zinc-200 px-4 py-6 text-[13px] text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
        No GitHub runs recorded in the last 24 hours.
      </div>
    )
  }
  return (
    <div className="mt-3 divide-y divide-zinc-100 overflow-hidden rounded-lg border bg-surface border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
      {runGroups.map((runGroup) => (
        <RunRowDetails key={runGroup.runId} runGroup={runGroup} now={now} />
      ))}
    </div>
  )
}

export default function HealthView({ health, now }) {
  const { sourceSummaries, failingCompanies, staleSources, runGroups, dayStats } = health

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

      <h2 className="mb-3 text-[12px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Latest run per source</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {sourceSummaries.map((summary) => (
          <li key={summary.source} className="rounded-lg border bg-surface border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-semibold">{SOURCE_LABELS[summary.source]}</span>
              <SourceStatusPill summary={summary} />
            </div>
            <p className="mt-2 text-[13px] text-zinc-700 dark:text-zinc-300" title={summary.lastRunAt ? formatFullDateTime(summary.lastRunAt) : undefined}>
              {summary.lastRunAt ? `Ran ${formatTimeAgo(summary.lastRunAt, now)}` : 'No runs recorded'}
            </p>
            {summary.lastRunAt && (
              <p className="mt-1 text-[12px] text-zinc-500 tabular-nums dark:text-zinc-400">
                {summary.companiesOk}/{summary.companiesChecked} ok · {summary.jobsFound} jobs
              </p>
            )}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 mb-3 text-[12px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Last 24 hours</h2>
      <DayStats dayStats={dayStats} />
      <RunList runGroups={runGroups} now={now} />

      <h2 className="mt-10 mb-3 text-[12px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        Companies failing on their last run
        {failingCompanies.length > 0 && <span className="ml-2 font-normal text-zinc-400">{failingCompanies.length}</span>}
      </h2>

      {failingCompanies.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border bg-surface border-zinc-200 px-4 py-6 text-[13px] text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          <CheckIcon className="text-emerald-500" />
          Every company scraped cleanly on its last run.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-surface border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-[13px]">
            <thead className="hidden bg-zinc-50 text-[12px] text-zinc-500 sm:table-header-group dark:bg-zinc-900/60 dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Company</th>
                <th scope="col" className="px-4 py-2 font-medium">Source</th>
                <th scope="col" className="px-4 py-2 font-medium">Error</th>
                <th scope="col" className="px-4 py-2 font-medium whitespace-nowrap">Last run</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {failingCompanies.map((failure) => (
                <tr key={`${failure.source}-${failure.company}`} className="flex flex-col gap-1 px-4 py-3 sm:table-row sm:p-0">
                  <td className="font-medium sm:px-4 sm:py-2.5">{failure.company}</td>
                  <td className="text-zinc-500 sm:px-4 sm:py-2.5 dark:text-zinc-400">{SOURCE_LABELS[failure.source]}</td>
                  <td className="font-mono text-[12px] break-all text-zinc-700 sm:px-4 sm:py-2.5 dark:text-zinc-300">{failure.error}</td>
                  <td className="text-zinc-500 sm:px-4 sm:py-2.5 sm:whitespace-nowrap dark:text-zinc-400" title={formatFullDateTime(failure.failedAt)}>
                    {formatTimeAgo(failure.failedAt, now)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
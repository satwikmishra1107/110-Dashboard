import { HEALTH_DAYS, SOURCES, STALE_SOURCE_MS } from './constants'
import { daysAgo } from './time'

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000
const RUNS_PER_FULL_DAY = 24 // the workflow runs hourly

/**
 * Group the rows by run_id: one group = one hourly GitHub run = up to one row per source.
 * Rows arrive newest first, and a Map keeps insertion order, so the groups are newest first too.
 */
function groupRunsByRunId(runs) {
  const sourceRowsByRunId = new Map()
  for (const run of runs) {
    if (!sourceRowsByRunId.has(run.run_id)) sourceRowsByRunId.set(run.run_id, [])
    sourceRowsByRunId.get(run.run_id).push(run)
  }

  return [...sourceRowsByRunId.entries()].map(([runId, sourceRows]) => {
    const allCompanyResults = sourceRows.flatMap((sourceRow) => sourceRow.report)
    const companiesOk = allCompanyResults.filter((entry) => entry.ok).length
    return {
      runId,
      ranAt: sourceRows[sourceRows.length - 1].scraped_at, // oldest row = when the first scraper finished
      // Same order as SOURCES, so the detail view always lists Workday, Greenhouse, …
      sourceRows: [...sourceRows].sort((firstRow, secondRow) => SOURCES.indexOf(firstRow.source) - SOURCES.indexOf(secondRow.source)),
      sourcesReported: sourceRows.length,
      companiesChecked: allCompanyResults.length,
      companiesOk,
      companiesFailed: allCompanyResults.length - companiesOk,
      // Runs saved before new/updated tracking have no counts; they add up as 0
      newJobs: allCompanyResults.reduce((total, entry) => total + (entry.newCount || 0), 0),
      updatedJobs: allCompanyResults.reduce((total, entry) => total + (entry.updatedCount || 0), 0),
    }
  })
}

/**
 * How often each company failed over the given runs, worst first.
 * - repeatFailures: companies that failed 2+ times, each with its error messages and how often each happened
 * - oneOffFailures: companies that failed just once, grouped by error (often one bad run hit many at once)
 */
function summarizeFailures(runs) {
  const statsByCompany = new Map()
  for (const run of runs) {
    for (const entry of run.report) {
      const key = `${run.source}|${entry.company}`
      if (!statsByCompany.has(key)) {
        statsByCompany.set(key, { company: entry.company, source: run.source, checks: 0, failures: 0, errorCounts: new Map(), lastFailedAt: null, latestAt: null, isFailingNow: false })
      }
      const stats = statsByCompany.get(key)
      stats.checks += 1
      // The newest result decides whether it's still failing now
      if (!stats.latestAt || run.scraped_at > stats.latestAt) {
        stats.latestAt = run.scraped_at
        stats.isFailingNow = !entry.ok
      }
      if (entry.ok) continue
      const error = entry.error || 'Unknown error'
      stats.failures += 1
      stats.errorCounts.set(error, (stats.errorCounts.get(error) ?? 0) + 1)
      if (!stats.lastFailedAt || run.scraped_at > stats.lastFailedAt) stats.lastFailedAt = run.scraped_at
    }
  }

  const failedCompanies = [...statsByCompany.values()].filter((stats) => stats.failures > 0)

  const repeatFailures = failedCompanies
    .filter((stats) => stats.failures > 1)
    .map((stats) => ({
      ...stats,
      failurePercent: Math.round((stats.failures / stats.checks) * 100),
      // Most common error first
      errors: [...stats.errorCounts].map(([message, count]) => ({ message, count })).sort((first, second) => second.count - first.count),
    }))
    .sort((first, second) => second.failures - first.failures || first.company.localeCompare(second.company))

  const oneOffsByError = new Map()
  for (const stats of failedCompanies.filter((stats) => stats.failures === 1)) {
    const [error] = stats.errorCounts.keys()
    if (!oneOffsByError.has(error)) oneOffsByError.set(error, [])
    oneOffsByError.get(error).push(stats)
  }
  const oneOffFailures = [...oneOffsByError]
    .map(([message, companies]) => ({ message, companies: companies.sort((first, second) => first.company.localeCompare(second.company)) }))
    .sort((first, second) => second.companies.length - first.companies.length)

  return { repeatFailures, oneOffFailures, companiesChecked: statsByCompany.size }
}

/** A job that made it past the auto-hide words and your "always hide" titles. */
const passedFilters = (job) => !job.autoHideReason && !job.isTitleHidden

/**
 * Turn scraper runs and jobs into what the "Scraper health" tab shows:
 * - sourceSummaries: one per source — last run time, stale or not, pass/fail counts
 * - failureSummary: which companies failed most over the last 7 days, and why
 * - staleSources: sources that haven't run in over 2 hours
 * - lastScrapedAt: the newest run across all sources (for the header)
 * - weekStats: totals for the last 7 days (for the stats at the top)
 * - dayGroups: one entry per day, newest first, each holding that day's runs
 *
 * New-job numbers come from the jobs themselves, not the run reports, so jobs deleted
 * from the database since (e.g. a bad first run) don't count.
 */
export function summarizeScraperHealth(runs, jobs, now) {
  const sourceSummaries = []
  let lastScrapedAt = null

  for (const source of SOURCES) {
    const runsNewestFirst = runs
      .filter((run) => run.source === source)
      .sort((firstRun, secondRun) => new Date(secondRun.scraped_at) - new Date(firstRun.scraped_at))

    const latestRun = runsNewestFirst[0]
    const latestReport = latestRun?.report ?? []
    const latestRunTime = latestRun ? new Date(latestRun.scraped_at).getTime() : null

    if (latestRunTime && (lastScrapedAt === null || latestRunTime > lastScrapedAt)) {
      lastScrapedAt = latestRunTime
    }

    sourceSummaries.push({
      source,
      lastRunAt: latestRun?.scraped_at ?? null,
      isStale: latestRunTime === null || now - latestRunTime > STALE_SOURCE_MS,
      companiesChecked: latestReport.length,
      companiesOk: latestReport.filter((entry) => entry.ok).length,
      companiesFailed: latestReport.filter((entry) => !entry.ok).length,
    })
  }

  // Only whole calendar days: today + the 6 before it
  const runGroups = groupRunsByRunId(runs).filter((runGroup) => daysAgo(runGroup.ranAt, now) < HEALTH_DAYS)
  const recentJobs = jobs.filter((job) => job.daysAgo < HEALTH_DAYS)

  const dayGroups = []
  for (let daysBack = 0; daysBack < HEALTH_DAYS; daysBack++) {
    const runsThatDay = runGroups.filter((runGroup) => daysAgo(runGroup.ranAt, now) === daysBack)
    const jobsThatDay = recentJobs.filter((job) => job.daysAgo === daysBack)
    const dayStart = new Date(now)
    dayStart.setHours(0, 0, 0, 0)
    dayStart.setDate(dayStart.getDate() - daysBack)
    dayGroups.push({
      dayStart: dayStart.toISOString(),
      isToday: daysBack === 0,
      runGroups: runsThatDay,
      // Today isn't over, so count the hours so far
      expectedRuns: daysBack === 0 ? Math.max(1, Math.floor((now - dayStart) / MILLISECONDS_PER_HOUR)) : RUNS_PER_FULL_DAY,
      failedChecks: runsThatDay.reduce((total, runGroup) => total + runGroup.companiesFailed, 0),
      jobsFound: jobsThatDay.length,
      jobsPassed: jobsThatDay.filter(passedFilters).length,
    })
  }

  const companiesChecked = runGroups.reduce((total, runGroup) => total + runGroup.companiesChecked, 0)
  const companiesOk = runGroups.reduce((total, runGroup) => total + runGroup.companiesOk, 0)
  const weekStats = {
    runCount: runGroups.length,
    expectedRuns: dayGroups.reduce((total, dayGroup) => total + dayGroup.expectedRuns, 0),
    successPercent: companiesChecked > 0 ? Math.round((companiesOk / companiesChecked) * 100) : null,
    failedChecks: companiesChecked - companiesOk,
    jobsFound: recentJobs.length,
    jobsPassed: recentJobs.filter(passedFilters).length,
  }

  return {
    sourceSummaries,
    failureSummary: summarizeFailures(runs.filter((run) => daysAgo(run.scraped_at, now) < HEALTH_DAYS)),
    staleSources: sourceSummaries.filter((summary) => summary.isStale),
    lastScrapedAt,
    weekStats,
    dayGroups,
  }
}

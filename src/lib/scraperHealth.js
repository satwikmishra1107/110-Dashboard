import { HEALTH_DAYS, SOURCES, STALE_SOURCE_MS } from './constants'
import { daysAgo } from './time'

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000
const RUNS_PER_FULL_DAY = 24 // the workflow runs hourly

/**
 * Group the summary rows by run_id: one group = one hourly GitHub run = up to one row per source.
 * Rows arrive newest first, and a Map keeps insertion order, so the groups are newest first too.
 * sourceRows holds the full rows (with each company's result) for runs in the last 48 hours,
 * and is null for older runs — only their totals are loaded.
 */
function groupRunsByRunId(runSummaries, runDetails) {
  const summaryRowsByRunId = new Map()
  for (const summaryRow of runSummaries) {
    if (!summaryRowsByRunId.has(summaryRow.run_id)) summaryRowsByRunId.set(summaryRow.run_id, [])
    summaryRowsByRunId.get(summaryRow.run_id).push(summaryRow)
  }

  const detailRowsByRunId = new Map()
  for (const detailRow of runDetails) {
    if (!detailRowsByRunId.has(detailRow.run_id)) detailRowsByRunId.set(detailRow.run_id, [])
    detailRowsByRunId.get(detailRow.run_id).push(detailRow)
  }

  return [...summaryRowsByRunId.entries()].map(([runId, summaryRows]) => {
    const detailRows = detailRowsByRunId.get(runId)
    const companiesChecked = summaryRows.reduce((total, summaryRow) => total + summaryRow.companies_checked, 0)
    const companiesOk = summaryRows.reduce((total, summaryRow) => total + summaryRow.companies_ok, 0)
    return {
      runId,
      ranAt: summaryRows[summaryRows.length - 1].scraped_at, // oldest row = when the first scraper finished
      // Same order as SOURCES, so the detail view always lists Workday, Greenhouse, …
      sourceRows: detailRows
        ? [...detailRows].sort((firstRow, secondRow) => SOURCES.indexOf(firstRow.source) - SOURCES.indexOf(secondRow.source))
        : null,
      sourcesReported: summaryRows.length,
      companiesChecked,
      companiesOk,
      companiesFailed: companiesChecked - companiesOk,
      // Runs saved before new/updated tracking have no counts; they add up as 0
      newJobs: summaryRows.reduce((total, summaryRow) => total + summaryRow.new_jobs, 0),
      updatedJobs: summaryRows.reduce((total, summaryRow) => total + summaryRow.updated_jobs, 0),
    }
  })
}

/**
 * How often each company failed over the given summary rows, worst first.
 * - repeatFailures: companies that failed 2+ times, each with its error messages and how often each happened
 * - oneOffFailures: companies that failed just once, grouped by error (often one bad run hit many at once)
 *
 * Summary rows only list the companies that failed, so a company's "checks" is how many times
 * its source ran — the same thing, as long as the company was on that source's list all week.
 */
function summarizeFailures(runSummaries) {
  const runsBySource = new Map()
  const latestRowBySource = new Map()
  for (const summaryRow of runSummaries) {
    runsBySource.set(summaryRow.source, (runsBySource.get(summaryRow.source) ?? 0) + 1)
    const latestRow = latestRowBySource.get(summaryRow.source)
    if (!latestRow || summaryRow.scraped_at > latestRow.scraped_at) latestRowBySource.set(summaryRow.source, summaryRow)
  }

  const statsByCompany = new Map()
  for (const summaryRow of runSummaries) {
    for (const failure of summaryRow.failures) {
      const key = `${summaryRow.source}|${failure.company}`
      if (!statsByCompany.has(key)) {
        // The newest run of its source decides whether it's still failing now
        const latestFailures = latestRowBySource.get(summaryRow.source).failures
        statsByCompany.set(key, {
          company: failure.company,
          source: summaryRow.source,
          checks: runsBySource.get(summaryRow.source),
          failures: 0,
          errorCounts: new Map(),
          lastFailedAt: null,
          isFailingNow: latestFailures.some((latestFailure) => latestFailure.company === failure.company),
        })
      }
      const stats = statsByCompany.get(key)
      const error = failure.error || 'Unknown error'
      stats.failures += 1
      stats.errorCounts.set(error, (stats.errorCounts.get(error) ?? 0) + 1)
      if (!stats.lastFailedAt || summaryRow.scraped_at > stats.lastFailedAt) stats.lastFailedAt = summaryRow.scraped_at
    }
  }

  const failedCompanies = [...statsByCompany.values()]

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

  // Companies checked = the companies in each source's newest run
  const companiesChecked = [...latestRowBySource.values()].reduce((total, latestRow) => total + latestRow.companies_checked, 0)

  return { repeatFailures, oneOffFailures, companiesChecked }
}

/**
 * For the header: the newest run across all sources, and which sources haven't run in over 2 hours.
 * latestRuns = rows from fetchLatestRuns(), newest first.
 */
export function summarizeLatestRuns(latestRuns, now) {
  const latestRunTimeBySource = new Map()
  for (const run of latestRuns) {
    if (!latestRunTimeBySource.has(run.source)) latestRunTimeBySource.set(run.source, new Date(run.scraped_at).getTime())
  }
  const runTimes = [...latestRunTimeBySource.values()]
  return {
    lastScrapedAt: runTimes.length > 0 ? Math.max(...runTimes) : null,
    staleSources: SOURCES.filter((source) => {
      const latestRunTime = latestRunTimeBySource.get(source)
      return latestRunTime === undefined || now - latestRunTime > STALE_SOURCE_MS
    }),
  }
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
 * - dayGroups: one entry per day, newest first, each holding that day's run count and
 *   the runs from the last 48 hours that can be opened
 *
 * runs = { runSummaries, runDetails } from fetchRuns(): 7 days of totals, 48 hours of full rows.
 * New-job numbers come from the jobs themselves, not the run reports, so jobs deleted
 * from the database since (e.g. a bad first run) don't count.
 */
export function summarizeScraperHealth(runs, jobs, now) {
  const { runSummaries, runDetails } = runs
  const sourceSummaries = []
  let lastScrapedAt = null

  for (const source of SOURCES) {
    // Rows arrive newest first, so the first one is the latest run
    const latestRun = runSummaries.find((summaryRow) => summaryRow.source === source)
    const latestRunTime = latestRun ? new Date(latestRun.scraped_at).getTime() : null

    if (latestRunTime && (lastScrapedAt === null || latestRunTime > lastScrapedAt)) {
      lastScrapedAt = latestRunTime
    }

    sourceSummaries.push({
      source,
      lastRunAt: latestRun?.scraped_at ?? null,
      isStale: latestRunTime === null || now - latestRunTime > STALE_SOURCE_MS,
      companiesChecked: latestRun?.companies_checked ?? 0,
      companiesOk: latestRun?.companies_ok ?? 0,
      companiesFailed: latestRun ? latestRun.companies_checked - latestRun.companies_ok : 0,
    })
  }

  // Only whole calendar days: today + the 6 before it
  const runGroups = groupRunsByRunId(runSummaries, runDetails).filter((runGroup) => daysAgo(runGroup.ranAt, now) < HEALTH_DAYS)
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
      runCount: runsThatDay.length,
      runGroups: runsThatDay.filter((runGroup) => runGroup.sourceRows), // only these can be opened
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
    failureSummary: summarizeFailures(runSummaries.filter((summaryRow) => daysAgo(summaryRow.scraped_at, now) < HEALTH_DAYS)),
    staleSources: sourceSummaries.filter((summary) => summary.isStale),
    lastScrapedAt,
    weekStats,
    dayGroups,
  }
}

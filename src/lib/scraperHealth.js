import { SOURCES, STALE_SOURCE_MS } from './constants'

const EXPECTED_RUNS_PER_DAY = 24 // the workflow runs hourly

/**
 * Group the rows by run_id: one group = one hourly GitHub run = up to five source rows.
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
      jobsFound: allCompanyResults.reduce((total, entry) => total + (entry.count || 0), 0),
      // Runs saved before new/updated tracking have no counts; they add up as 0
      newJobs: allCompanyResults.reduce((total, entry) => total + (entry.newCount || 0), 0),
      updatedJobs: allCompanyResults.reduce((total, entry) => total + (entry.updatedCount || 0), 0),
    }
  })
}

/**
 * Turn scraper runs into what the "Scraper health" tab shows:
 * - sourceSummaries: one per source — last run time, stale or not, pass/fail counts
 * - failingCompanies: companies whose most recent result was a failure
 * - staleSources: sources that haven't run in over 2 hours
 * - lastScrapedAt: the newest run across all sources (for the header)
 * - runGroups: one entry per hourly GitHub run, newest first (for the run list)
 * - dayStats: totals across the last 24 hours (for the stats at the top)
 */
export function summarizeScraperHealth(runs, now) {
  const sourceSummaries = []
  const failingCompanies = []
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
      jobsFound: latestReport.reduce((total, entry) => total + (entry.count || 0), 0),
    })

    // A company's latest result is the first time it appears, going from newest run to oldest
    const companiesAlreadyChecked = new Set()
    for (const run of runsNewestFirst) {
      for (const entry of run.report) {
        if (companiesAlreadyChecked.has(entry.company)) continue
        companiesAlreadyChecked.add(entry.company)
        if (!entry.ok) {
          failingCompanies.push({
            company: entry.company,
            source,
            error: entry.error || 'Unknown error',
            failedAt: run.scraped_at,
          })
        }
      }
    }
  }

  failingCompanies.sort((firstFailure, secondFailure) => firstFailure.company.localeCompare(secondFailure.company))

  const runGroups = groupRunsByRunId(runs)
  const companiesChecked = runGroups.reduce((total, runGroup) => total + runGroup.companiesChecked, 0)
  const companiesOk = runGroups.reduce((total, runGroup) => total + runGroup.companiesOk, 0)
  const dayStats = {
    runCount: runGroups.length,
    expectedRuns: EXPECTED_RUNS_PER_DAY,
    companiesChecked,
    companiesOk,
    successPercent: companiesChecked > 0 ? Math.round((companiesOk / companiesChecked) * 100) : null,
    jobsFound: runGroups.reduce((total, runGroup) => total + runGroup.jobsFound, 0),
    newJobs: runGroups.reduce((total, runGroup) => total + runGroup.newJobs, 0),
    updatedJobs: runGroups.reduce((total, runGroup) => total + runGroup.updatedJobs, 0),
  }

  return {
    sourceSummaries,
    failingCompanies,
    staleSources: sourceSummaries.filter((summary) => summary.isStale),
    lastScrapedAt,
    runGroups,
    dayStats,
  }
}

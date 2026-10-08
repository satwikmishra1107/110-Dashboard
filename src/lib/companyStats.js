import { HEALTH_DAYS } from './constants'
import { daysAgo } from './time'

// 10+ jobs found and none passed your filters → the company is mostly noise
export const NOISY_MIN_JOBS = 10

/** A job that made it past the auto-hide words and your "always hide" titles. */
const passedFilters = (job) => !job.autoHideReason && !job.isTitleHidden

/** Why a job didn't pass: the auto-hide word ('senior'), or 'hidden title' for your "always hide" list. */
const hideReason = (job) => job.autoHideReason ?? (job.isTitleHidden ? 'hidden title' : null)

/**
 * One row per company for the Companies tab: is the scraper working for it, and are its jobs any use?
 *
 * runs = { runSummaries, runDetails } from fetchRuns(): the company list and each one's latest check come
 * from the newest full report of its source (last 48 hours); the 7-day success rate from the summaries.
 * jobs = every job loaded (last 30 days), already through prepareJobsForDisplay.
 *
 * Each row: { key, company, source, latestCheck, checks, failures, successPercent, jobsFound, jobsPassed,
 *             passPercent, lastPassedAt, topHideReasons, flags: { failing, silent, noisy, notScraped } }
 */
export function summarizeCompanies(runs, jobs, now) {
  const { runSummaries, runDetails } = runs

  // Newest full report per source (rows arrive newest first)
  const latestDetailBySource = new Map()
  for (const detailRow of runDetails) {
    if (!latestDetailBySource.has(detailRow.source)) latestDetailBySource.set(detailRow.source, detailRow)
  }

  const statsByKey = new Map()
  const getOrCreateStats = (source, company) => {
    const key = `${source}|${company}`
    if (!statsByKey.has(key)) {
      statsByKey.set(key, {
        key,
        company,
        source,
        latestCheck: null, // { ok, error, count, checkedAt } from the newest report, or null if no longer scraped
        checks: 0,
        failures: 0,
        jobsFound: 0,
        jobsPassed: 0,
        lastPassedAt: null,
        hideReasonCounts: new Map(),
      })
    }
    return statsByKey.get(key)
  }

  // 1. Every company each source checked in its newest run, even ones with no jobs at all
  for (const detailRow of latestDetailBySource.values()) {
    for (const entry of detailRow.report) {
      getOrCreateStats(detailRow.source, entry.company).latestCheck = {
        ok: Boolean(entry.ok),
        error: entry.error || null,
        count: entry.count ?? 0, // jobs the scraper matched on its careers page in that run
        checkedAt: detailRow.scraped_at,
      }
    }
  }

  // 2. 7-day success rate. Summary rows only list failures, so a company's checks = its source's runs.
  const weekSummaries = runSummaries.filter((summaryRow) => daysAgo(summaryRow.scraped_at, now) < HEALTH_DAYS)
  const runsBySource = new Map()
  for (const summaryRow of weekSummaries) {
    runsBySource.set(summaryRow.source, (runsBySource.get(summaryRow.source) ?? 0) + 1)
    for (const failure of summaryRow.failures) {
      const stats = statsByKey.get(`${summaryRow.source}|${failure.company}`)
      if (stats) stats.failures += 1
    }
  }

  // 3. Jobs found and how many passed your filters (a company that's no longer scraped still shows up here)
  for (const job of jobs) {
    const stats = getOrCreateStats(job.source, job.company)
    stats.jobsFound += 1
    if (passedFilters(job)) {
      stats.jobsPassed += 1
      const boardTime = job.reposted_at ?? job.first_seen_at
      if (!stats.lastPassedAt || boardTime > stats.lastPassedAt) stats.lastPassedAt = boardTime
    } else {
      const reason = hideReason(job)
      stats.hideReasonCounts.set(reason, (stats.hideReasonCounts.get(reason) ?? 0) + 1)
    }
  }

  return [...statsByKey.values()].map(({ hideReasonCounts, ...stats }) => {
    const checks = stats.latestCheck ? (runsBySource.get(stats.source) ?? 0) : 0
    return {
      ...stats,
      checks,
      successPercent: checks > 0 ? Math.round(((checks - stats.failures) / checks) * 100) : null,
      passPercent: stats.jobsFound > 0 ? Math.round((stats.jobsPassed / stats.jobsFound) * 100) : null,
      // The words that kept most of its jobs out, e.g. [{ reason: 'senior', count: 12 }, …]
      topHideReasons: [...hideReasonCounts]
        .map(([reason, count]) => ({ reason, count }))
        .sort((first, second) => second.count - first.count)
        .slice(0, 3),
      flags: {
        failing: Boolean(stats.latestCheck && !stats.latestCheck.ok),
        silent: Boolean(stats.latestCheck?.ok) && stats.jobsFound === 0,
        noisy: stats.jobsFound >= NOISY_MIN_JOBS && stats.jobsPassed === 0,
        notScraped: !stats.latestCheck,
      },
    }
  })
}

/** Totals for the tiles at the top of the Companies tab. */
export function countCompanyTotals(companies) {
  const jobsFound = companies.reduce((total, company) => total + company.jobsFound, 0)
  const jobsPassed = companies.reduce((total, company) => total + company.jobsPassed, 0)
  return {
    companies: companies.filter((company) => !company.flags.notScraped).length,
    jobsFound,
    jobsPassed,
    passPercent: jobsFound > 0 ? Math.round((jobsPassed / jobsFound) * 100) : null,
    failing: companies.filter((company) => company.flags.failing).length,
    silent: companies.filter((company) => company.flags.silent).length,
    noisy: companies.filter((company) => company.flags.noisy).length,
    notScraped: companies.filter((company) => company.flags.notScraped).length,
  }
}

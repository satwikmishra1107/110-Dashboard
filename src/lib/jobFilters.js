import {
  ARCHIVE_MAX_DAYS,
  AUTO_HIDE_WORDS,
  BOARD_DAYS,
  NEW_BADGE_MS,
  SOURCES,
  STATUSES,
  TIME_RANGES,
  findPersonBySlug,
  makeJobKey,
  normalizeTitle,
} from './constants'
import { daysAgo } from './time'

const AUTO_HIDE_PATTERN = new RegExp(`\\b(${AUTO_HIDE_WORDS.join('|')})\\b`, 'i')

/** "Senior Software Engineer" → "senior", "SDE II" → null */
function getAutoHideReason(title) {
  // "Engineer, Staff_CE" → "Engineer, Staff CE": "_" counts as part of a word, which would hide "Staff"
  const match = AUTO_HIDE_PATTERN.exec((title || '').replace(/_/g, ' '))
  return match ? match[1].toLowerCase() : null
}

/**
 * Combine each job with its saved status, and work out values the UI needs:
 * key, status, note, statusChangedAt, otherPeople, isTitleHidden, isArchived, daysAgo and badge.
 */
export function prepareJobsForDisplay(jobs, jobTracking, hiddenTitles, now) {
  return jobs.map((job) => {
    const key = makeJobKey(job.company, job.job_id)
    const savedTracking = jobTracking.get(key)
    // Where the job sits on the board: when it was reposted, or else when it was first seen
    const boardDate = new Date(job.reposted_at ?? job.first_seen_at)
    const isTitleHidden = hiddenTitles.has(normalizeTitle(job.title))
    const autoHideReason = getAutoHideReason(job.title)

    let badge = null
    if (job.is_update) badge = 'updated'
    else if (now - boardDate < NEW_BADGE_MS) badge = 'new'

    return {
      ...job,
      key,
      status: savedTracking?.status ?? 'new',
      note: savedTracking?.note ?? '',
      statusChangedAt: savedTracking?.statusChangedAt ?? null, // when YOU last changed the status
      otherPeople: savedTracking?.otherPeople ?? [], // the other person's status, read-only
      isTitleHidden, // its title is on your "always hide" list
      autoHideReason, // the word that keeps it off the Board, e.g. 'senior', or null
      isArchived: isTitleHidden || Boolean(autoHideReason) || (savedTracking?.archived ?? false), // hidden title, auto-hidden, or you archived this job
      daysAgo: daysAgo(boardDate, now),
      badge,
    }
  })
}

/** The four numbers in the header. */
export function countSummary(jobs) {
  const summary = { newToday: 0, thisWeek: 0, referralRequested: 0, applied: 0 }
  for (const job of jobs) {
    if (job.daysAgo === 0 && !job.isArchived) summary.newToday += 1
    if (job.daysAgo < BOARD_DAYS && !job.isArchived) summary.thisWeek += 1
    if (job.status === 'referral_requested') summary.referralRequested += 1
    if (job.status === 'applied') summary.applied += 1
  }
  return summary
}

function belongsToCurrentTab(job, filters) {
  // Archive = jobs you archived yourself + jobs older than 7 days + today's auto-hidden jobs
  if (filters.tab === 'archive') {
    if (job.autoHideReason) return job.daysAgo === 0
    return job.isArchived || (job.daysAgo >= BOARD_DAYS && job.daysAgo <= ARCHIVE_MAX_DAYS)
  }
  const selectedRange = TIME_RANGES.find((range) => range.id === filters.range)
  return !job.isArchived && job.daysAgo < selectedRange.days
}

function matchesSearch(job, searchWords) {
  const searchableText = `${job.company} ${job.title} ${job.location ?? ''}`.toLowerCase()
  return searchWords.every((word) => searchableText.includes(word))
}

/** e.g. countBy(jobs, job => job.company) → Map { 'Google' => 3, 'Stripe' => 1 } */
function countBy(items, getValue, valuesToAlwaysInclude = []) {
  const counts = new Map(valuesToAlwaysInclude.map((value) => [value, 0]))
  for (const item of items) {
    const value = getValue(item)
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

/**
 * Apply every filter and return:
 * - visibleJobs: what the list shows
 * - filterCounts: numbers next to each checkbox. Each group is counted with the
 *   OTHER filter applied, so a number tells you what ticking it would show.
 */
export function filterJobs(jobs, filters, currentUserEmail) {
  const searchWords = filters.search.toLowerCase().split(/\s+/).filter(Boolean)

  const jobsInTab = jobs.filter((job) => belongsToCurrentTab(job, filters) && matchesSearch(job, searchWords))

  // ?by=deepak → the Status filter (and its counts) use Deepak's status instead of yours.
  // With no status ticked, it shows every job they've touched (anything but "New").
  const byEmail = filters.by ? findPersonBySlug(filters.by) : null
  const isLookingAtSomeoneElse = Boolean(byEmail) && byEmail !== currentUserEmail
  const getStatus = isLookingAtSomeoneElse
    ? (job) => job.otherPeople.find((otherPerson) => otherPerson.person === byEmail)?.status ?? 'new'
    : (job) => job.status

  const passesSource = (job) => filters.sources.length === 0 || filters.sources.includes(job.source)
  const passesStatus = (job) => {
    if (filters.statuses.length > 0) return filters.statuses.includes(getStatus(job))
    return !isLookingAtSomeoneElse || getStatus(job) !== 'new'
  }

  const visibleJobs = jobsInTab.filter((job) => passesSource(job) && passesStatus(job))

  const sourceCounts = countBy(jobsInTab.filter(passesStatus), (job) => job.source, SOURCES)
  const statusCounts = countBy(jobsInTab.filter(passesSource), getStatus, STATUSES)

  return {
    visibleJobs,
    filterCounts: {
      sources: [...sourceCounts],
      statuses: [...statusCounts],
    },
  }
}
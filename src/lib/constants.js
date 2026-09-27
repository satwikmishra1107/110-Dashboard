export const SOURCES = ['workday', 'greenhouse', 'lever', 'ashby', 'smartrecruiters', 'custom']

export const SOURCE_LABELS = {
  workday: 'Workday',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  smartrecruiters: 'SmartRecruiters',
  custom: 'Custom'
}

export const STATUSES = ['new', 'interested', 'referral_requested', 'applied']

export const STATUS_DETAILS = {
  new: { label: 'New', dotClass: 'bg-zinc-300 dark:bg-zinc-600' },
  interested: { label: 'Interested', dotClass: 'bg-amber-400' },
  referral_requested: { label: 'Referral requested', dotClass: 'bg-sky-500' },
  applied: { label: 'Applied', dotClass: 'bg-emerald-500' },
}

export const TIME_RANGES = [
  { id: 'today', label: 'Today', days: 1 },
  { id: '3d', label: '3 days', days: 3 },
  { id: '7d', label: '7 days', days: 7 },
]

export const BOARD_DAYS = 7 // Board = today + the 6 days before it
export const ARCHIVE_MAX_DAYS = 30
export const AUTO_REFRESH_MS = 5 * 60 * 1000
export const STALE_SOURCE_MS = 2 * 60 * 60 * 1000
export const NEW_BADGE_MS = 24 * 60 * 60 * 1000

/** "  Talent  Acquisition Partner " → "talent acquisition partner", so small differences still match. */
export function normalizeTitle(title) {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** One string that identifies a job: company + job_id (they're unique together). */
export function makeJobKey(company, jobId) {
  return `${company}::${jobId}`
}
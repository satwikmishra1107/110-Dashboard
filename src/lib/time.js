const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function startOfDay(dateInput) {
  const midnight = new Date(dateInput)
  midnight.setHours(0, 0, 0, 0)
  return midnight
}

/** Calendar days between a date and now: 0 = today, 1 = yesterday, … */
export function daysAgo(dateInput, now) {
  return Math.round((startOfDay(now) - startOfDay(dateInput)) / MILLISECONDS_PER_DAY)
}

/** "23 Sep", or "Wed, 23 Sep" with the weekday. */
export function formatShortDate(dateInput, includeWeekday = false) {
  const date = new Date(dateInput)
  const dayAndMonth = `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`
  return includeWeekday ? `${WEEKDAY_NAMES[date.getDay()]}, ${dayAndMonth}` : dayAndMonth
}

/** "just now", "12 min ago", "3h ago", "2d ago" */
export function formatTimeAgo(timestamp, now) {
  const elapsedMinutes = Math.floor((now - new Date(timestamp)) / 60_000)
  if (elapsedMinutes < 1) return 'just now'
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours}h ago`
  return `${Math.max(1, daysAgo(timestamp, now))}d ago` // calendar days, to match the day headings
}

/** "10:30 am" */
export function formatClockTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** "Today", "Yesterday", or "Mon, 4 Oct" */
export function formatDayLabel(timestamp, now) {
  const daysBack = daysAgo(timestamp, now)
  if (daysBack === 0) return 'Today'
  if (daysBack === 1) return 'Yesterday'
  return formatShortDate(timestamp, true)
}

/** Full date and time, used in hover tooltips. */
export function formatFullDateTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/

/** The job site's own posted date, e.g. "Posted 24 Sep" or the raw label like "Posted Today". */
export function formatPostedDate(job) {
  if (job.posted_date) {
    // posted_date is a plain date ("2026-09-24"); build it in local time, not UTC
    const [year, month, day] = job.posted_date.split('-').map(Number)
    return `Posted ${formatShortDate(new Date(year, month - 1, day))}`
  }
  const label = job.posted_label?.trim()
  if (!label) return null
  if (ISO_DATE_PATTERN.test(label)) return `Posted ${formatShortDate(label)}`
  return label
}
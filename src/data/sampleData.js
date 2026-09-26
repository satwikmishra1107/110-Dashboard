/*
 * SAMPLE DATA — the only place data enters the app right now.
 *
 * Each object below has the same shape as a row in your Supabase tables,
 * so when we build the real data layer together, it only has to return
 * the same three lists: jobs, statuses and runs.
 *
 * Dates are built relative to "now" so the board always looks fresh.
 */

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000

function hoursAgo(hours) {
  return new Date(Date.now() - hours * MILLISECONDS_PER_HOUR).toISOString()
}

function dateOnlyDaysAgo(days) {
  return hoursAgo(days * 24).slice(0, 10) // "2026-09-24"
}

// [company, title, location, source, hours since first seen, is_update]
const SAMPLE_JOB_LIST = [
  ['Google', 'Software Engineer II, Cloud Platform', 'Bengaluru, Karnataka, India', 'workday', 0.4, false],
  ['Atlassian', 'Senior Backend Engineer, Jira', 'Bengaluru, India', 'greenhouse', 2, false],
  ['Razorpay', 'SDE 2, Payments Gateway', 'Bengaluru', 'lever', 5, false],
  ['Postman', 'Frontend Engineer', 'Remote - India', 'ashby', 7, true],
  ['Databricks', 'Software Engineer, Infrastructure', 'Bengaluru, India', 'greenhouse', 11, false],
  ['Visa', 'Software Engineer, Risk Platform', 'Bengaluru, India', 'smartrecruiters', 14, false],
  ['Stripe', 'Software Engineer, Billing', 'Bengaluru, India', 'greenhouse', 26, false],
  ['PhonePe', 'SDE II, Backend', 'Pune, India', 'lever', 30, false],
  ['Rippling', 'Software Engineer II', 'Bengaluru, India', 'ashby', 34, false],
  ['Salesforce', 'Member of Technical Staff', 'Hyderabad, India', 'workday', 46, false],
  ['Twilio', 'Software Engineer, Messaging', 'Remote - India', 'greenhouse', 52, false],
  ['CRED', 'Backend Engineer', 'Bengaluru', 'lever', 60, false],
  ['Walmart', 'Software Engineer III', 'Chennai, India', 'workday', 75, true],
  ['Groww', 'SDE 1, Platform', 'Bengaluru', 'lever', 80, false],
  ['Snowflake', 'Software Engineer, Query Engine', 'Pune, India', 'ashby', 98, false],
  ['Intuit', 'Software Engineer 2', 'Bengaluru, India', 'workday', 110, false],
  ['Zepto', 'SDE 2, Supply Chain', 'Mumbai, India', 'lever', 125, false],
  ['Mastercard', 'Software Engineer II', 'Pune, India', 'smartrecruiters', 140, false],
  ['Datadog', 'Software Engineer, APM', 'Remote - India', 'greenhouse', 150, false],
  // older than 7 days → Archive
  ['Adobe', 'Computer Scientist', 'Noida, India', 'workday', 200, false],
  ['Freshworks', 'Senior Software Engineer', 'Chennai, India', 'lever', 230, false],
  ['MongoDB', 'Software Engineer, Atlas', 'Gurugram, India', 'greenhouse', 290, false],
  ['Chargebee', 'SDE 2', 'Chennai, India', 'lever', 340, false],
  ['Cloudflare', 'Systems Engineer', 'Bengaluru, India', 'greenhouse', 400, false],
  ['NVIDIA', 'System Software Engineer', 'Pune, India', 'workday', 520, false],
  ['Coinbase', 'Software Engineer, Backend', 'Remote - India', 'greenhouse', 610, false],
]

export const SAMPLE_JOBS = SAMPLE_JOB_LIST.map(
  ([company, title, location, source, hoursSinceFirstSeen, isUpdate], position) => {
    const postedDaysBeforeFound = position % 3 // make the site's posted date vary a little
    // Some sites only give a text label (like Workday's "Posted 3 Days Ago") instead of a date
    const daysSinceFirstSeen = Math.floor(hoursSinceFirstSeen / 24)
    const textOnlyLabel = daysSinceFirstSeen === 0 ? 'Posted Today' : `Posted ${daysSinceFirstSeen} Days Ago`
    return {
      source,
      company,
      job_id: `JR-${10400 + position}`,
      title,
      location,
      url: `https://example.com/jobs/${company.toLowerCase()}/${10400 + position}`,
      posted_label: position % 4 === 0 ? textOnlyLabel : hoursAgo(hoursSinceFirstSeen + postedDaysBeforeFound * 24),
      posted_date: position % 4 === 0 ? null : dateOnlyDaysAgo(hoursSinceFirstSeen / 24 + postedDaysBeforeFound),
      first_seen_at: hoursAgo(hoursSinceFirstSeen),
      is_update: isUpdate,
    }
  },
)

export const SAMPLE_STATUSES = [
  { company: 'Atlassian', job_id: 'JR-10401', status: 'referral_requested', note: 'Asked Priya on LinkedIn', updated_at: hoursAgo(1) },
  { company: 'Razorpay', job_id: 'JR-10402', status: 'interested', note: null, updated_at: hoursAgo(3) },
  { company: 'Stripe', job_id: 'JR-10406', status: 'applied', note: 'Applied via careers page', updated_at: hoursAgo(20) },
  { company: 'Salesforce', job_id: 'JR-10409', status: 'applied', note: null, updated_at: hoursAgo(40) },
]

const TRACKED_COMPANIES_BY_SOURCE = {
  workday: ['Google', 'Salesforce', 'Walmart', 'Intuit', 'Adobe', 'NVIDIA'],
  greenhouse: ['Atlassian', 'Databricks', 'Stripe', 'Twilio', 'Datadog', 'MongoDB', 'Cloudflare', 'Coinbase'],
  lever: ['Razorpay', 'PhonePe', 'CRED', 'Groww', 'Zepto', 'Freshworks', 'Chargebee'],
  ashby: ['Postman', 'Rippling', 'Snowflake'],
  smartrecruiters: ['Visa', 'Mastercard'],
}

// One run per source. Ashby is 3 hours old so the "stale source" warning shows.
const HOURS_SINCE_LAST_RUN = { workday: 0.2, greenhouse: 0.2, lever: 0.25, ashby: 3, smartrecruiters: 0.3 }

const FAILING_COMPANIES = {
  Walmart: 'HTTP 429 Too Many Requests from walmart.wd5.myworkdayjobs.com',
  Coinbase: 'Timeout after 30000 ms fetching boards-api.greenhouse.io',
}

export const SAMPLE_RUNS = Object.entries(TRACKED_COMPANIES_BY_SOURCE).map(([source, companies], position) => ({
  id: position + 1,
  source,
  scraped_at: hoursAgo(HOURS_SINCE_LAST_RUN[source]),
  report: companies.map((company) => ({
    company,
    ok: !FAILING_COMPANIES[company],
    count: FAILING_COMPANIES[company] ? 0 : (company.length % 5) + 1,
    error: FAILING_COMPANIES[company] ?? null,
  })),
}))

/**
 * Pretends to be a network request: waits a moment, then returns copies of the data.
 * Later this is the one function to swap for a real call.
 */
export async function loadSampleData() {
  await new Promise((resolve) => setTimeout(resolve, 500))
  return {
    jobs: structuredClone(SAMPLE_JOBS),
    statuses: structuredClone(SAMPLE_STATUSES),
    runs: structuredClone(SAMPLE_RUNS),
  }
}
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

// Everyone allowed through Cloudflare Access: email → name shown on the board
export const PEOPLE = {
  'satwikmishra1107@gmail.com': 'Satwik',
  'nandushukla1204@gmail.com': 'Deepak',
}

export function getPersonName(email) {
  return PEOPLE[email] ?? email
}

export const REFERRAL_FOLLOW_UP_MS = 12 * 60 * 60 * 1000 // after 12h, a referral request is due for a follow-up

// Titles with these words never reach the Board. They sit in the Archive on the day they're found, then drop off.
// Whole words only: "lead" catches "Tech Lead" but not "Leading…", "ai" doesn't catch "Email".
// Keep in step with AUTO_HIDE_WORDS in the scraper's telegram.mjs.
export const AUTO_HIDE_WORDS = [
  // Too senior for ~2 years' experience
  'senior', 'sr', 'lead', 'leadership', 'staff', 'principal', 'director', 'manager', 'mgr', 'head', 'architect',
  'vp', 'vice president', 'distinguished', 'fellow', 'iv', // not 'iii': some SDE III roles ask for ~2 years
  'smts', 'lmts', 'pmts', // Salesforce's Senior / Lead / Principal Member of Technical Staff
  // Too junior
  'intern', 'internship', 'campus hire',
  // AI / ML
  'ai', 'ml', 'ai/ml', 'machine learning', 'llm', 'genai', 'gen ai', 'generative',
  'deep learning', 'data scientist', 'nlp', 'computer vision',
  // CRM / enterprise platform setup, support and consulting, not product engineering
  'salesforce', 'servicenow', 'sap', 'cpq', 'certinia', 'consultant', 'escalation',
  'professional services', 'technology operations', 'network security',
]

export const BOARD_DAYS = 7 // Board = today + the 6 days before it
export const ARCHIVE_MAX_DAYS = 30
export const HEALTH_DAYS = 7 // the Scraper health tab covers today + the 6 days before it
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
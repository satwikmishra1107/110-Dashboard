# 110 Dashboard
<img width="1919" height="1079" alt="image" src="https://github.com/user-attachments/assets/ad857189-c26e-461e-ac03-75fec42cbba2" />

A private job board that shows fresh software engineering openings from 120+ company career pages, scraped every hour. It's the front end of the **110** project: the scrapers ([110-Scraper](https://github.com/satwikmishra1107/110-Scraper)) find new postings and send Telegram alerts, and this dashboard is where those jobs get reviewed, tracked and acted on — asking for referrals and applying while a posting is still new.

## How it fits together

```
Cloudflare Worker (cron, hourly)
        │ dispatches
        ▼
GitHub Actions — 110-Scraper
  Workday · Greenhouse · Lever · Ashby · SmartRecruiters · custom scrapers
        │ writes jobs + one runs row per scraper
        ▼
Supabase (Postgres)
        │ read directly with supabase-js
        ▼
110 Dashboard (this repo) — Cloudflare Pages, behind Cloudflare Access
```

There's no custom backend. The dashboard talks to Supabase straight from the browser, and Cloudflare Access (email one-time PIN) decides who can open it.

## Features

**Board** — every job found or reposted in the last 7 days, newest first. Jobs carry a `NEW` badge for their first 24 hours and an `UPDATED` badge when a company reposts an existing opening. Filter by time window (today / 3 days / 7 days), status and source, or search by company, title or location.

**Per-person tracking** — the board is shared by two people. Each person sets their own status on a job (New → Interested → Referral requested → Applied) and can keep a private note. Everyone can see everyone else's status (e.g. "Deepak: Applied"), but only the owner can change it. A referral request shows when it was asked, so it's easy to follow up after ~12 hours.

**Archive & hidden titles** — shared between both users. Archiving moves a job off the board but keeps it viewable in the Archive tab for 30 days. "Always hide this title" removes a title everywhere (meant for roles like talent acquisition or management) and the scraper also stops sending Telegram alerts for it.

**Scraper health** — summarises the last 24 hours of automated runs: which sources ran, which are stale (no run in 2+ hours), which companies failed and why, and how many new and updated jobs each run found. Click a run to drill down to sources and individual companies.

**Quality of life**
- Filters live in the URL (`?tab=archive&status=applied&q=google`), so any view can be bookmarked or shared
- Keyboard shortcuts on desktop: `/` search, `j` / `k` move between jobs, `a` mark applied, `r` mark referral requested, `o` open the apply link, `Esc` clear selection
- Light, dark and system themes
- Auto-refreshes every 5 minutes
- Mobile layout with a bottom-sheet filter panel

## Tech stack

- **React 19** + **Vite**
- **Tailwind CSS v4**
- **Supabase** (`@supabase/supabase-js`) for data
- **Cloudflare Pages** for hosting, **Cloudflare Access** for login

## Project structure

```
src/
├── App.jsx                 # Page layout, tabs, wiring hooks to components
├── components/             # JobList, JobRow, FilterPanel, StatusSelect, HealthView, …
├── hooks/
│   ├── useJobData.js       # Loads jobs + tracking + hidden titles, auto-refresh
│   ├── useUrlFilters.js    # Keeps filters in sync with the URL
│   ├── useKeyboardShortcuts.js
│   └── useTheme.js, useIsDesktop.js, useCurrentTime.js
├── data/                   # Every Supabase read/write lives here
│   ├── fetchJobs.js        # Jobs from the last 30 days (paged, 1000 rows at a time)
│   ├── fetchRuns.js        # Scraper runs from the last 24 hours
│   ├── jobTracking.js      # Shared archive + per-person status/notes, current user
│   └── hiddenTitles.js     # "Always hide this title" list
└── lib/
    ├── supabaseClient.js   # The single Supabase connection
    ├── constants.js        # Sources, statuses, time windows, people, timings
    ├── jobFilters.js       # Board / archive filtering logic
    ├── scraperHealth.js    # Turns runs rows into the health tab's summaries
    └── time.js             # "Found 7h ago"-style formatting
```

## Data model

The dashboard reads and writes these Supabase tables:

| Table | Written by | What it holds |
| --- | --- | --- |
| `jobs` | scrapers | `source, company, job_id, title, location, url, posted_label, posted_date, first_seen_at, reposted_at, is_update` — unique on `company + job_id` |
| `runs` | scrapers | One row per scraper per run: `run_id` (GitHub Actions run ID), `source, scraped_at`, and a `report` array of per-company results |
| `job_tracking` | dashboard | Shared archive flag per job |
| `personal_tracking` | dashboard | `status, note, status_changed_at` per job **per person** |
| `hidden_titles` | dashboard | Normalised (lowercased, whitespace-collapsed) titles to hide |

Retention is handled inside Supabase by scheduled jobs: jobs are deleted after 30 days and runs rows after 7 days, which keeps the database within the free tier.

## Running locally

```bash
git clone https://github.com/satwikmishra1107/110-Dashboard.git
cd 110-Dashboard
npm install
```

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_DEV_USER_EMAIL=you@example.com
```

`VITE_DEV_USER_EMAIL` stands in for the signed-in user during local development. In production, the user's email comes from Cloudflare Access (`/cdn-cgi/access/get-identity`).

```bash
npm run dev       # start the dev server
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

## Deployment

The `main` branch deploys automatically to Cloudflare Pages:

- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

A Cloudflare Access application in front of the custom domain restricts the board to the allowed email addresses. To add a person, allow their email in Access and add them to `PEOPLE` in `src/lib/constants.js` so the board shows their name.

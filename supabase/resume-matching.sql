-- Resume matching: run once in the Supabase SQL editor.
-- The scraper (career-watcher/score/score-jobs.mjs) fills jobs.description and job_scores;
-- the dashboard's "Resume match" panel writes resumes and resume_settings.

-- 1. Each job's full description, as plain text. The board never selects it, so it doesn't slow loading.
alter table jobs
  add column if not exists description text,
  add column if not exists description_checked_at timestamptz; -- last fetch attempt; a failed one is retried after 6 hours

-- 2. Every resume each person has uploaded. The newest version is the one jobs get scored against.
create table if not exists resumes (
  person      text        not null, -- email, same as personal_tracking.person
  version     int         not null, -- 1, 2, 3… per person
  file_name   text,
  resume_text text        not null, -- the whole text, pulled out of the PDF in the browser
  created_at  timestamptz not null default now(),
  primary key (person, version)
);

-- 3. One row per person: their own Gemini key, where "weak" starts, and how scoring last went
create table if not exists resume_settings (
  person          text primary key,
  gemini_api_key  text,
  weak_cutoff     int not null default 60 check (weak_cutoff between 0 and 100),
  key_error       text,        -- set by the scraper when Gemini rejects the key, cleared when scoring works again
  last_scored_at  timestamptz, -- when the scraper last scored a job for this person
  updated_at      timestamptz not null default now()
);

-- 4. One score per job per person. Deleted along with the job (jobs are removed after 30 days).
create table if not exists job_scores (
  company         text not null,
  job_id          text not null,
  person          text not null,
  resume_version  int  not null, -- which resume version this score used
  score           int  not null check (score between 0 and 100),
  reason          text,
  skills_matched  text[] not null default '{}',
  skills_missing  text[] not null default '{}',
  scored_at       timestamptz not null default now(),
  primary key (company, job_id, person),
  foreign key (company, job_id) references jobs (company, job_id) on delete cascade
);
create index if not exists job_scores_person_idx on job_scores (person);

-- 5. The dashboard uses the anon key, like it does for personal_tracking. The scraper's secret key skips these rules.
alter table resumes enable row level security;
alter table resume_settings enable row level security;
alter table job_scores enable row level security;

drop policy if exists "dashboard reads and writes" on resumes;
create policy "dashboard reads and writes" on resumes for all to anon using (true) with check (true);
drop policy if exists "dashboard reads and writes" on resume_settings;
create policy "dashboard reads and writes" on resume_settings for all to anon using (true) with check (true);
drop policy if exists "dashboard reads and writes" on job_scores;
create policy "dashboard reads and writes" on job_scores for all to anon using (true) with check (true);

grant select, insert, update, delete on resumes, resume_settings, job_scores to anon;

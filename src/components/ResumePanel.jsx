import { useEffect, useRef, useState } from 'react'
import { formatFullDateTime, formatTimeAgo } from '../lib/time'
import { CheckIcon, CloseIcon } from './Icons'

const GEMINI_KEY_PAGE = 'https://aistudio.google.com/apikey'

const inputClass =
  'h-9 w-full rounded-md border border-zinc-200 bg-surface px-2.5 text-[13px] placeholder:text-zinc-400 disabled:opacity-60 dark:border-zinc-800'
const primaryButtonClass =
  'inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-accent-500 px-3 text-[13px] font-medium text-white hover:bg-accent-600 disabled:opacity-60'
const linkButtonClass = 'text-[12px] text-accent-600 hover:underline disabled:opacity-60 dark:text-accent-400'

function Step({ number, title, isDone, children }) {
  return (
    <section className="min-w-0 rounded-lg border border-zinc-200 bg-surface p-3 dark:border-zinc-800">
      <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
        <span
          className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] ${
            isDone ? 'bg-emerald-500 text-white' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
          }`}
          aria-hidden
        >
          {isDone ? <CheckIcon width={12} height={12} /> : number}
        </span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function Message({ tone, children }) {
  if (!children) return null
  const toneClass = tone === 'error' ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'
  return <p className={`mt-2 text-[12px] ${toneClass}`}>{children}</p>
}

/** Step 1: your own Gemini key, so scoring uses your free requests, not anyone else's. */
function KeyStep({ profile, saveKey }) {
  const [isEditing, setIsEditing] = useState(false)
  const [keyText, setKeyText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  const showInput = isEditing || !profile.hasKey

  const submit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      await saveKey(keyText)
      setKeyText('')
      setIsEditing(false)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Step number={1} title="Gemini API key" isDone={profile.hasKey && !profile.keyError}>
      {showInput ? (
        <form onSubmit={submit} className="flex gap-2">
          <input
            type="password"
            value={keyText}
            onChange={(event) => setKeyText(event.target.value)}
            placeholder="Paste your key"
            autoComplete="off"
            aria-label="Gemini API key"
            disabled={isSaving}
            className={inputClass}
          />
          <button type="submit" disabled={isSaving || !keyText.trim()} className={primaryButtonClass}>
            {isSaving ? 'Checking…' : 'Save'}
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-3 text-[13px]">
          <span className="font-mono text-zinc-600 dark:text-zinc-300">Saved {profile.keyEnding}</span>
          <button type="button" onClick={() => setIsEditing(true)} className={linkButtonClass}>
            Change
          </button>
        </div>
      )}
      <Message tone="error">{error ?? (!isEditing && profile.keyError)}</Message>
      {showInput && (
        <Message>
          Free from{' '}
          <a href={GEMINI_KEY_PAGE} target="_blank" rel="noopener noreferrer" className="text-accent-600 hover:underline dark:text-accent-400">
            Google AI Studio
          </a>
          . Scoring uses your key, so it never touches anyone else's free requests.
          {isEditing && (
            <>
              {' '}
              <button type="button" onClick={() => setIsEditing(false)} className={linkButtonClass}>
                Cancel
              </button>
            </>
          )}
        </Message>
      )}
    </Step>
  )
}

/** Step 2: the resume, PDF only. A new upload becomes the next version; older scores keep their version. */
function ResumeStep({ profile, uploadResume, outdatedScoreCount, rescoreOutdatedJobs, now }) {
  const fileInputRef = useRef(null)
  const [busyText, setBusyText] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const { latestResume } = profile

  const uploadFile = async (file) => {
    if (!file) return
    setError(null)
    setNotice(null)
    setBusyText('Reading PDF…')
    try {
      await uploadResume(file)
      setNotice(latestResume ? 'Saved as a new version. New jobs are scored with it from the next hourly run.' : null)
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setBusyText(null)
      if (fileInputRef.current) fileInputRef.current.value = '' // so picking the same file again still uploads it
    }
  }

  const rescore = async () => {
    setError(null)
    setBusyText('Clearing old scores…')
    try {
      await rescoreOutdatedJobs()
      setNotice('Done. Those jobs are scored again with your newest resume in the next hourly run.')
    } catch (rescoreError) {
      setError(rescoreError.message)
    } finally {
      setBusyText(null)
    }
  }

  return (
    <Step number={2} title="Resume" isDone={Boolean(latestResume)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => uploadFile(event.target.files?.[0])}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
        {latestResume && (
          <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-300" title={formatFullDateTime(latestResume.createdAt)}>
            <span className="font-medium">v{latestResume.version}</span> · {latestResume.fileName ?? 'resume.pdf'} · {formatTimeAgo(latestResume.createdAt, now)}
          </span>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={Boolean(busyText)}
          className={latestResume ? linkButtonClass : primaryButtonClass}
        >
          {busyText ?? (latestResume ? 'Upload a new version' : 'Upload PDF')}
        </button>
      </div>
      <Message tone="error">{error}</Message>
      <Message>{notice}</Message>
      {!error && !notice && !latestResume && <Message>PDF only. The whole text is read and saved; you only upload it once.</Message>}
      {outdatedScoreCount > 0 && latestResume && (
        <p className="mt-2 text-[12px] text-zinc-500 dark:text-zinc-400">
          {outdatedScoreCount} {outdatedScoreCount === 1 ? 'job was' : 'jobs were'} scored with an older resume.{' '}
          <button type="button" onClick={rescore} disabled={Boolean(busyText)} className={linkButtonClass}>
            Re-score with v{latestResume.version}
          </button>
        </p>
      )}
    </Step>
  )
}

/** Step 3: where "weak" starts, for the "Hide weak matches" filter. */
function CutoffStep({ weakCutoff, changeWeakCutoff }) {
  const [cutoffText, setCutoffText] = useState(String(weakCutoff))
  const [error, setError] = useState(null)

  const save = async () => {
    const cutoff = Number(cutoffText)
    if (!Number.isInteger(cutoff) || cutoff < 0 || cutoff > 100) {
      setError('Pick a whole number from 0 to 100.')
      return
    }
    setError(null)
    if (cutoff === weakCutoff) return
    try {
      await changeWeakCutoff(cutoff)
    } catch (saveError) {
      setError(saveError.message)
      setCutoffText(String(weakCutoff))
    }
  }

  return (
    <Step number={3} title="Weak match cutoff" isDone>
      <label className="flex items-center gap-2 text-[13px] text-zinc-600 dark:text-zinc-300">
        “Hide weak matches” hides scores below
        <input
          type="number"
          min={0}
          max={100}
          value={cutoffText}
          onChange={(event) => setCutoffText(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
          aria-label="Weak match cutoff"
          className={`${inputClass} w-16 text-center tabular-nums`}
        />
      </label>
      <Message tone="error">{error}</Message>
    </Step>
  )
}

/** Under the header: set up resume matching (key, resume, cutoff). Each person sets up their own. */
export default function ResumePanel({ isOpen, onClose, resumeMatching, outdatedScoreCount, now }) {
  const { profile, loadError, saveKey, uploadResume, changeWeakCutoff, rescoreOutdatedJobs, weakCutoff, reloadProfile } = resumeMatching

  // The scraper updates "last scored" and "key rejected" every hour, so check again each time the panel opens
  useEffect(() => {
    if (isOpen) reloadProfile()
  }, [isOpen, reloadProfile])

  if (!isOpen) return null

  let statusText = 'Loading…'
  if (loadError) statusText = loadError
  else if (profile && !(profile.hasKey && profile.latestResume)) statusText = 'Jobs on the Board get scored against your resume every hour'
  else if (profile?.lastScoredAt) statusText = `Last scored ${formatTimeAgo(profile.lastScoredAt, now)} · new jobs are scored every hour`
  else if (profile) statusText = 'All set. Your first scores arrive with the next hourly run (up to 40 jobs per run)'

  return (
    <section aria-label="Resume match" className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-[1600px] px-4 py-3 lg:px-6">
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-[13px] font-semibold">Resume match</h2>
          <span className={`min-w-0 truncate text-[12px] ${loadError ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
            {statusText}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close resume match"
            title="Close"
            className="ml-auto grid size-8 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <CloseIcon />
          </button>
        </div>

        {profile && (
          <div className="grid gap-3 md:grid-cols-3">
            <KeyStep profile={profile} saveKey={saveKey} />
            <ResumeStep
              profile={profile}
              uploadResume={uploadResume}
              outdatedScoreCount={outdatedScoreCount}
              rescoreOutdatedJobs={rescoreOutdatedJobs}
              now={now}
            />
            <CutoffStep key={weakCutoff} weakCutoff={weakCutoff} changeWeakCutoff={changeWeakCutoff} />
          </div>
        )}
      </div>
    </section>
  )
}

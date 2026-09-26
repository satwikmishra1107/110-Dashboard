import { memo, useState } from 'react'
import { BOARD_DAYS } from '../lib/constants'
import { formatFullDateTime, formatPostedDate, formatTimeAgo } from '../lib/time'
import { FreshnessBadge, SourceBadge } from './Badges'
import { ArchiveIcon, EyeIcon, EyeOffIcon, PencilIcon, RestoreIcon } from './Icons'
import StatusSelect from './StatusSelect'

function NoteInput({ initialNote, onSave, onClose }) {
  const [noteText, setNoteText] = useState(initialNote)

  const saveAndClose = () => {
    if (noteText.trim() !== initialNote) onSave(noteText.trim())
    onClose()
  }

  return (
    <input
      autoFocus
      value={noteText}
      maxLength={280}
      onChange={(event) => setNoteText(event.target.value)}
      onBlur={saveAndClose}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur() // blur → saveAndClose
        if (event.key === 'Escape') onClose() // close without saving
      }}
      placeholder="Add a note — who you asked, when…"
      aria-label="Note"
      className="mt-1.5 h-8 w-full rounded-md border border-zinc-200 bg-surface px-2.5 text-[13px] placeholder:text-zinc-400 dark:border-zinc-800"
    />
  )
}

/** The company name is the apply link: opens the job in a new tab. */
function CompanyLink({ job }) {
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()} // don't also select the row
      title={`Open ${job.company} job in a new tab`}
      className="block truncate text-[13px] font-semibold underline-offset-2 hover:text-accent-600 hover:underline dark:hover:text-accent-400"
    >
      {job.company}
    </a>
  )
}

function NoteButton({ hasNote, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      aria-label={hasNote ? 'Edit note' : 'Add note'}
      title={hasNote ? 'Edit note' : 'Add note'}
      className={`inline-flex shrink-0 items-center justify-center rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
        hasNote ? 'text-accent-500 dark:text-accent-400' : 'text-zinc-400'
      } ${className}`}
    >
      <PencilIcon />
    </button>
  )
}

/** Moves a job to the Archive tab, or back to the Board if it's already archived. */
function ArchiveButton({ isArchived, onClick, className = '' }) {
  const label = isArchived ? 'Restore to board' : 'Move to archive'
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation() // don't also select the row
        onClick()
      }}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${className}`}
    >
      {isArchived ? <RestoreIcon /> : <ArchiveIcon />}
    </button>
  )
}

/** "Always hide this title" — or, if the title is already hidden, "Stop hiding this title". */
function HideTitleButton({ isTitleHidden, onClick, className = '' }) {
  const label = isTitleHidden ? 'Stop hiding this title' : 'Always hide this title'
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation() // don't also select the row
        onClick()
      }}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${className}`}
    >
      {isTitleHidden ? <EyeIcon /> : <EyeOffIcon />}
    </button>
  )
}

/** One job: a dense row on desktop, a card on phones. */
function JobRow({ job, now, layout, isSelected, isMuted, onSelect, onUpdateJob, onToggleHiddenTitle }) {
  const [isEditingNote, setIsEditingNote] = useState(false)

  const postedDate = formatPostedDate(job)
  const foundText = `Found ${formatTimeAgo(job.first_seen_at, now)}`
  const fadedStyle = isMuted ? 'opacity-60' : ''

  const changeStatus = (newStatus) => onUpdateJob(job, { status: newStatus })
  const saveNote = (newNote) => onUpdateJob(job, { note: newNote })
  const openNoteInput = () => setIsEditingNote(true)
  const toggleArchived = () => onUpdateJob(job, { archived: !job.isArchived })
  const toggleHiddenTitle = () => onToggleHiddenTitle(job)
  // Hidden-title jobs are restored with the eye button instead.
  // Jobs older than 7 days are in the Archive anyway, so the button would do nothing for them.
  const canToggleArchive = !job.isTitleHidden && (job.isArchived || job.daysAgo < BOARD_DAYS)

  let noteArea = null
  if (isEditingNote) {
    noteArea = <NoteInput initialNote={job.note} onSave={saveNote} onClose={() => setIsEditingNote(false)} />
  } else if (job.note) {
    noteArea = (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          openNoteInput()
        }}
        className="mt-1 block max-w-full truncate text-left text-[12px] text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        “{job.note}”
      </button>
    )
  }

  const rowBackground = isSelected ? 'bg-accent-50 dark:bg-accent-950/60' : 'hover:bg-surface'

  return (
    <li
      data-job-key={job.key}
      onClick={() => onSelect(job.key)}
      aria-current={isSelected ? 'true' : undefined}
      className={`relative scroll-mt-12 transition-colors ${rowBackground}`}
    >
      {isSelected && <span className="absolute inset-y-0 left-0 w-0.5 bg-accent-500" aria-hidden />}

      {layout === 'row' ? (
        <div className={`grid grid-cols-[10rem_minmax(0,1fr)_10rem_auto] items-center gap-6 px-4 py-3 xl:grid-cols-[13rem_minmax(0,1fr)_11rem_auto] ${fadedStyle}`}>
          <div className="min-w-0">
            <CompanyLink job={job} />
            {job.location && (
              <div className="mt-0.5 truncate text-[12px] text-zinc-500 dark:text-zinc-400" title={job.location}>
                {job.location}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[14px]" title={job.title}>
                {job.title}
              </span>
              <FreshnessBadge badge={job.badge} />
            </div>
            {noteArea}
          </div>

          <div className="flex min-w-0 flex-col items-start gap-0.5">
            <span className="text-[12px] text-zinc-600 dark:text-zinc-300" title={formatFullDateTime(job.first_seen_at)}>
              {foundText}
            </span>
            <span className="flex max-w-full items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              <SourceBadge source={job.source} />
              <span className="truncate">{postedDate}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <StatusSelect value={job.status} onChange={changeStatus} size="compact" className="w-[11.5rem]" />
            <NoteButton hasNote={Boolean(job.note)} onClick={openNoteInput} className="size-8" />
            {canToggleArchive && <ArchiveButton isArchived={job.isArchived} onClick={toggleArchived} className="size-8" />}
            <HideTitleButton isTitleHidden={job.isTitleHidden} onClick={toggleHiddenTitle} className="size-8" />
          </div>
        </div>
      ) : (
        <div className={`px-4 py-4 ${fadedStyle}`}>
          <div className="flex items-center justify-between gap-3">
            <CompanyLink job={job} />
            <FreshnessBadge badge={job.badge} />
          </div>
          {job.location && <div className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">{job.location}</div>}
          <div className="mt-1.5 truncate text-[15px]">{job.title}</div>
          {noteArea}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
            <SourceBadge source={job.source} />
            <span className="text-zinc-600 dark:text-zinc-300">{foundText}</span>
            {postedDate && <span className="text-zinc-400 dark:text-zinc-500">· {postedDate}</span>}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <StatusSelect value={job.status} onChange={changeStatus} className="flex-1" />
            <NoteButton hasNote={Boolean(job.note)} onClick={openNoteInput} className="size-11" />
            {canToggleArchive && <ArchiveButton isArchived={job.isArchived} onClick={toggleArchived} className="size-11" />}
            <HideTitleButton isTitleHidden={job.isTitleHidden} onClick={toggleHiddenTitle} className="size-11" />
          </div>
        </div>
      )}
    </li>
  )
}

export default memo(JobRow)
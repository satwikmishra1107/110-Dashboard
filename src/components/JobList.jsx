import JobRow from './JobRow'

export default function JobList({ jobs, now, layout, selectedJobKey, isMuted, onSelectJob, onUpdateJob, onToggleHiddenTitle }) {
  return (
    <ul className="mt-3 divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-900 dark:border-zinc-900">
      {jobs.map((job) => (
        <JobRow
          key={job.key}
          job={job}
          now={now}
          layout={layout}
          isMuted={isMuted}
          isSelected={job.key === selectedJobKey}
          onSelect={onSelectJob}
          onUpdateJob={onUpdateJob}
          onToggleHiddenTitle={onToggleHiddenTitle}
        />
      ))}
    </ul>
  )
}

const SKELETON_TITLE_WIDTHS = ['55%', '70%', '45%', '62%', '50%', '75%', '58%', '40%']

export function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading jobs" className="animate-pulse">
      <div className="px-4 pt-5 pb-2">
        <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      {SKELETON_TITLE_WIDTHS.map((titleWidth) => (
        <div key={titleWidth} className="flex items-center gap-4 border-b border-zinc-100 px-4 py-4 dark:border-zinc-900">
          <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 flex-1 rounded bg-zinc-100 dark:bg-zinc-900" style={{ maxWidth: titleWidth }} />
          <div className="ml-auto hidden h-7 w-40 rounded bg-zinc-100 lg:block dark:bg-zinc-900" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-24 text-center">
      <div className="mb-4 size-10 rounded-full border border-dashed border-zinc-300 dark:border-zinc-700" aria-hidden />
      <h2 className="text-[15px] font-medium">{title}</h2>
      {description && <p className="mt-1 max-w-sm text-[13px] text-zinc-500 dark:text-zinc-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
import { SOURCE_LABELS } from '../lib/constants'

export function SourceBadge({ source }) {
  return (
    <span className="inline-flex items-center rounded border border-zinc-200 px-1.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      {SOURCE_LABELS[source] ?? source}
    </span>
  )
}

/** "NEW" for jobs under 24h old, "UPDATED" for jobs that came back after being removed. */
export function FreshnessBadge({ badge }) {
  if (badge === 'updated') {
    return (
      <span
        title="This job was removed and has reappeared"
        className="inline-flex shrink-0 items-center rounded px-1.5 text-[10px] font-semibold tracking-wide text-amber-700 ring-1 ring-amber-300 ring-inset dark:text-amber-300 dark:ring-amber-700/60"
      >
        UPDATED
      </span>
    )
  }
  if (badge === 'new') {
    return (
      <span className="inline-flex shrink-0 items-center rounded bg-accent-500 px-1.5 text-[10px] font-semibold tracking-wide text-white">
        NEW
      </span>
    )
  }
  return null
}

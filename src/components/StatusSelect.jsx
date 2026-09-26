import { STATUSES, STATUS_DETAILS } from '../lib/constants'
import { ChevronDownIcon } from './Icons'

export default function StatusSelect({ value, onChange, className = '', size = 'normal' }) {
  const currentStatus = STATUS_DETAILS[value] ?? STATUS_DETAILS.new
  const heightClass = size === 'compact' ? 'h-8' : 'h-11'

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <span className={`pointer-events-none absolute left-2.5 size-2 rounded-full ${currentStatus.dotClass}`} aria-hidden />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => event.stopPropagation()} // don't also select the row
        aria-label="Status"
        className={`w-full cursor-pointer rounded-md border border-zinc-200 bg-surface pr-7 pl-7 text-[13px] text-zinc-700 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 ${heightClass}`}
      >
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_DETAILS[status].label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2 text-zinc-400" width={14} height={14} />
    </div>
  )
}

import { PEOPLE, SOURCE_LABELS, STATUS_DETAILS, TIME_RANGES, getPersonName, getPersonSlug } from '../lib/constants'
import { CloseIcon, SearchIcon } from './Icons'

/** Add the value if it's missing, remove it if it's there. */
function toggleInList(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function FilterSection({ title, onClear, children }) {
  return (
    <section className="py-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">{title}</h3>
        {onClear && (
          <button type="button" onClick={onClear} className="text-[12px] text-accent-600 hover:underline dark:text-accent-400">
            Clear
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

function CheckboxRow({ label, count, isChecked, onToggle, dotClass }) {
  const isEmpty = count === 0 && !isChecked
  return (
    <label
      className={`flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
        isEmpty ? 'text-zinc-400 dark:text-zinc-600' : ''
      }`}
    >
      <input type="checkbox" checked={isChecked} onChange={onToggle} className="size-3.5 shrink-0 accent-accent-500" />
      {dotClass && <span className={`size-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-[12px] text-zinc-400 tabular-nums dark:text-zinc-500">{count}</span>
    </label>
  )
}

export function SearchBox({ value, onChange, inputRef }) {
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-zinc-400" />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && event.currentTarget.blur()}
        placeholder="Company, title or location"
        aria-label="Search company, title or location"
        className="h-10 w-full rounded-md border border-zinc-200 bg-surface pr-8 pl-8 text-[13px] placeholder:text-zinc-400 dark:border-zinc-800"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          <CloseIcon width={14} height={14} />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-zinc-200 px-1.5 font-mono text-[10px] text-zinc-400 lg:block dark:border-zinc-800">
          /
        </kbd>
      )}
    </div>
  )
}

/** A row of buttons where exactly one is picked, e.g. Today / 3 days / 7 days. */
function SegmentedControl({ label, options, value, onChange }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900"
    >
      {options.map((option) => {
        const isActive = value === option.value
        return (
          <button
            key={option.value ?? 'default'}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={`h-8 truncate rounded-md px-1 text-[13px] font-medium transition-colors ${
              isActive
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default function FilterPanel({ filters, updateFilters, filterCounts, currentUserEmail }) {
  // "Mine" (no ?by=) + everyone else. by = null also covers ?by=<your own name>.
  const otherEmails = Object.keys(PEOPLE).filter((email) => email !== currentUserEmail)
  const personOptions = [
    { value: null, label: 'Mine' },
    ...otherEmails.map((email) => ({ value: getPersonSlug(email), label: getPersonName(email) })),
  ]

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
      {filters.tab === 'board' && (
        <FilterSection title="Found within">
          <SegmentedControl
            label="Time range"
            options={TIME_RANGES.map((timeRange) => ({ value: timeRange.id, label: timeRange.label }))}
            value={filters.range}
            onChange={(range) => updateFilters({ range })}
          />
        </FilterSection>
      )}

      {/* {personOptions.length > 1 && (
        <FilterSection title="Whose status">
          <SegmentedControl
            label="Whose status"
            options={personOptions}
            value={filters.by}
            onChange={(by) => updateFilters({ by })}
          />
        </FilterSection>
      )} */}

      <FilterSection
        title="Status"
        onClear={filters.statuses.length > 0 ? () => updateFilters({ statuses: [] }) : null}
      >
        {filterCounts.statuses.map(([status, count]) => (
          <CheckboxRow
            key={status}
            label={STATUS_DETAILS[status].label}
            dotClass={STATUS_DETAILS[status].dotClass}
            count={count}
            isChecked={filters.statuses.includes(status)}
            onToggle={() => updateFilters((current) => ({ statuses: toggleInList(current.statuses, status) }))}
          />
        ))}
      </FilterSection>

      <FilterSection
        title="Source"
        onClear={filters.sources.length > 0 ? () => updateFilters({ sources: [] }) : null}
      >
        {filterCounts.sources.map(([source, count]) => (
          <CheckboxRow
            key={source}
            label={SOURCE_LABELS[source]}
            count={count}
            isChecked={filters.sources.includes(source)}
            onToggle={() => updateFilters((current) => ({ sources: toggleInList(current.sources, source) }))}
          />
        ))}
      </FilterSection>
    </div>
  )
}

import { formatFullDateTime, formatTimeAgo } from '../lib/time'
import { MonitorIcon, MoonIcon, NotebookIcon, RefreshIcon, SunIcon } from './Icons'

const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'archive', label: 'Archive' },
  { id: 'health', label: 'Scraper health' },
  { id: 'companies', label: 'Companies' },
]

const THEME_BUTTONS = {
  system: { icon: MonitorIcon, label: 'Theme: system (click for light)' },
  light: { icon: SunIcon, label: 'Theme: light (click for dark)' },
  dark: { icon: MoonIcon, label: 'Theme: dark (click for system)' },
}

function SummaryNumber({ label, shortLabel, value }) {
  return (
    <div className="min-w-0">
      <div className="text-[20px] leading-7 font-semibold tabular-nums sm:text-[22px]">{value ?? '–'}</div>
      <div className="truncate text-[12px] text-zinc-500 dark:text-zinc-400">
        <span className="sm:hidden">{shortLabel}</span>
        <span className="hidden sm:inline">{label}</span>
      </div>
    </div>
  )
}

const iconButtonClass =
  'grid size-9 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-60 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'

export default function Header({
  activeTab,
  onChangeTab,
  summary,
  lastScrapedAt,
  now,
  hasStaleSource,
  isRefreshing,
  onRefresh,
  theme,
  onCycleTheme,
  isNotepadOpen,
  onToggleNotepad,
}) {
  const ThemeIcon = THEME_BUTTONS[theme].icon

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 px-4 pt-3 lg:px-6">
        <div className="flex h-10 items-center gap-2.5">
          <span className="grid size-6 place-items-center rounded-md bg-accent-500 text-white" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 5 5 9-10" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Job board</span>
        </div>

        <div className="ml-auto flex items-center gap-1 text-[12px] text-zinc-500 sm:order-last dark:text-zinc-400">
          <span className={`mr-1 size-1.5 rounded-full ${hasStaleSource ? 'bg-amber-500' : 'bg-emerald-500'}`} aria-hidden />
          <span title={lastScrapedAt ? formatFullDateTime(lastScrapedAt) : undefined}>
            {lastScrapedAt ? (
              <>
                <span className="hidden sm:inline">Last scraped </span>
                {formatTimeAgo(lastScrapedAt, now)}
              </>
            ) : (
              'No runs yet'
            )}
          </span>
          <button type="button" onClick={onRefresh} disabled={isRefreshing} aria-label="Refresh now" title="Refresh now" className={`ml-1 ${iconButtonClass}`}>
            <RefreshIcon className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={onToggleNotepad}
            aria-label={isNotepadOpen ? 'Close notes' : 'Open notes'}
            aria-expanded={isNotepadOpen}
            title="Notes"
            className={`${iconButtonClass} ${isNotepadOpen ? 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200' : ''}`}
          >
            <NotebookIcon />
          </button>
          <button type="button" onClick={onCycleTheme} aria-label={THEME_BUTTONS[theme].label} title={THEME_BUTTONS[theme].label} className={iconButtonClass}>
            <ThemeIcon />
          </button>
        </div>

        <nav aria-label="Views" className="-mb-px flex w-full gap-5 sm:w-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex h-10 items-center gap-1.5 text-[13px] font-medium transition-colors ${
                  isActive ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {tab.label}
                {tab.id === 'health' && hasStaleSource && (
                  <span className="size-1.5 rounded-full bg-amber-500" aria-label="needs attention" />
                )}
                {isActive && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent-500" aria-hidden />}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="mx-auto grid max-w-[1600px] grid-cols-4 gap-4 border-t border-zinc-100 px-4 py-3 sm:flex sm:gap-14 lg:px-6 dark:border-zinc-900">
        <SummaryNumber label="Last 24 hours" shortLabel="Today" value={summary?.newToday} />
        <SummaryNumber label="This week" shortLabel="Week" value={summary?.thisWeek} />
        <SummaryNumber label="Referral requested" shortLabel="Referral" value={summary?.referralRequested} />
        <SummaryNumber label="Applied" shortLabel="Applied" value={summary?.applied} />
      </div>
    </header>
  )
}

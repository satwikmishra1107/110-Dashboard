const sharedIconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const SearchIcon = (props) => (
  <svg {...sharedIconProps} {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const RefreshIcon = (props) => (
  <svg {...sharedIconProps} {...props}><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
)
export const FilterIcon = (props) => (
  <svg {...sharedIconProps} {...props}><path d="M4 6h16M7 12h10M10 18h4" /></svg>
)
export const ExternalLinkIcon = (props) => (
  <svg {...sharedIconProps} {...props}><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
)
export const PencilIcon = (props) => (
  <svg {...sharedIconProps} {...props}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
)
export const ChevronDownIcon = (props) => (
  <svg {...sharedIconProps} {...props}><path d="m6 9 6 6 6-6" /></svg>
)
export const CloseIcon = (props) => (
  <svg {...sharedIconProps} {...props}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const WarningIcon = (props) => (
  <svg {...sharedIconProps} {...props}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17.5v.01" /></svg>
)
export const ArchiveIcon = (props) => (
  <svg {...sharedIconProps} {...props}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" /></svg>
)
export const RestoreIcon = (props) => (
  <svg {...sharedIconProps} {...props}><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>
)
export const EyeOffIcon = (props) => (
  <svg {...sharedIconProps} {...props}><path d="M3 3l18 18" /><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3.1 4.2M6.6 6.6C4.3 8 2.7 10.2 2 12c1 2.5 5 7 10 7 1.8 0 3.4-.6 4.8-1.4" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
)
export const EyeIcon = (props) => (
  <svg {...sharedIconProps} {...props}><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
)
export const CheckIcon = (props) => (
  <svg {...sharedIconProps} {...props}><path d="m5 12 5 5 9-10" /></svg>
)
export const SunIcon = (props) => (
  <svg {...sharedIconProps} {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
export const MoonIcon = (props) => (
  <svg {...sharedIconProps} {...props}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" /></svg>
)
export const NotebookIcon = (props) => (
  <svg {...sharedIconProps} {...props}><rect x="5" y="3" width="15" height="18" rx="2" /><path d="M9 8h7M9 12h7M9 16h4M3 7h3M3 12h3M3 17h3" /></svg>
)
export const MonitorIcon = (props) => (
  <svg {...sharedIconProps} {...props}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
)
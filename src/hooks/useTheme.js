import { useEffect, useState } from 'react'

const THEME_ORDER = ['light', 'dark']

function readSavedTheme() {
  try {
    return localStorage.getItem('theme') || 'dark'
  } catch {
    return 'system'
  }
}

/**
 * Light / dark mode. "system" follows your OS setting (the default).
 * Works by adding or removing the "dark" class on <html>.
 */
export function useTheme() {
  const [theme, setTheme] = useState(readSavedTheme)

  useEffect(() => {
    const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const useDark = theme === 'dark' || (theme === 'system' && systemDarkQuery.matches)
      document.documentElement.classList.toggle('dark', useDark)
    }

    applyTheme()
    try {
      localStorage.setItem('theme', theme)
    } catch {
      // storage can be blocked (private mode); the theme still works for this visit
    }

    // If you're on "system" and change your OS theme, follow it live
    systemDarkQuery.addEventListener('change', applyTheme)
    return () => systemDarkQuery.removeEventListener('change', applyTheme)
  }, [theme])

  const cycleTheme = () => {
    const nextIndex = (THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length
    setTheme(THEME_ORDER[nextIndex])
  }

  return { theme, cycleTheme }
}

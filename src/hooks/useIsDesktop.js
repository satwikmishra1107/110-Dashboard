import { useEffect, useState } from 'react'

const DESKTOP_QUERY = '(min-width: 1024px)'

/** true on screens 1024px and wider (sidebar + dense rows + shortcuts). */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches)
  useEffect(() => {
    const desktopQuery = window.matchMedia(DESKTOP_QUERY)
    const handleChange = () => setIsDesktop(desktopQuery.matches)
    desktopQuery.addEventListener('change', handleChange)
    return () => desktopQuery.removeEventListener('change', handleChange)
  }, [])
  return isDesktop
}

import { useEffect, useState } from 'react'

/** The current time, updated every 30 seconds so "3 min ago" labels stay correct. */
export function useCurrentTime(updateEveryMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), updateEveryMs)
    return () => clearInterval(timer)
  }, [updateEveryMs])
  return now
}

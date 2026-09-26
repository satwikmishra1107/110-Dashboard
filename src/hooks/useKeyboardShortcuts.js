import { useEffect, useRef } from 'react'

function isTypingInAField(element) {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable
}

/**
 * Desktop shortcuts:
 *   /  focus search      j / k  next / previous job
 *   a  applied           r      referral requested
 *   o  open the apply link
 *   Esc  clear selection
 */
export function useKeyboardShortcuts(actions, isEnabled) {
  // Keep the latest actions in a ref, so the listener doesn't need re-attaching on every render
  const latestActions = useRef(actions)
  useEffect(() => {
    latestActions.current = actions
  })

  useEffect(() => {
    if (!isEnabled) return

    const handleKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingInAField(event.target)) return

      const shortcutActions = {
        '/': () => {
          event.preventDefault() // otherwise "/" gets typed into the search box
          latestActions.current.focusSearch()
        },
        j: () => latestActions.current.moveSelection(1),
        k: () => latestActions.current.moveSelection(-1),
        a: () => latestActions.current.setSelectedStatus('applied'),
        r: () => latestActions.current.setSelectedStatus('referral_requested'),
        o: () => latestActions.current.openSelectedJob(),
        Escape: () => latestActions.current.clearSelection(),
      }
      shortcutActions[event.key]?.()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEnabled])
}
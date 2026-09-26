import { useEffect, useRef } from 'react'
import { CloseIcon } from './Icons'

/** A panel that slides up from the bottom on phones (used for filters). */
export default function BottomSheet({ isOpen, onClose, title, footer, children }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    // Stop the page behind from scrolling while the sheet is open
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-40">
      <div className="animate-fade-in absolute inset-0 bg-black/30 dark:bg-black/60" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-slide-up absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl bg-surface shadow-2xl outline-none dark:ring-1 dark:ring-zinc-800"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden />
        <div className="flex items-center justify-between px-4 pt-2 pb-1">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 place-items-center rounded-md text-zinc-500">
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-3">{children}</div>
        {footer && (
          <div className="border-t border-zinc-100 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-zinc-900">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { useNotepad } from '../hooks/useNotepad'
import { CloseIcon } from './Icons'

const SAVE_STATE_LABELS = {
  loading: 'Loading…',
  saved: 'Saved',
  unsaved: 'Editing…',
  saving: 'Saving…',
  error: 'Couldn’t save — check your connection',
}

/** Free-form notes under the header: who you know at each company, who said to ping them back. Only you see yours. */
export default function NotepadPanel({ isOpen, onClose }) {
  const { text, changeText, saveState, isLoaded, saveNow } = useNotepad(isOpen)
  const textareaRef = useRef(null)

  // The box is disabled while loading, so focus it once the text is in
  useEffect(() => {
    if (isOpen && isLoaded) textareaRef.current?.focus()
  }, [isOpen, isLoaded])

  if (!isOpen) return null

  const statusLabel = saveState === 'error' && !isLoaded ? 'Couldn’t load notes' : SAVE_STATE_LABELS[saveState]

  return (
    <section aria-label="Notes" className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-[1600px] px-4 py-3 lg:px-6">
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-[13px] font-semibold">Notes</h2>
          <span className={`text-[12px] ${saveState === 'error' ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
            {statusLabel}
          </span>
          <span className="hidden text-[12px] text-zinc-400 sm:inline">· only you can see these</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notes"
            title="Close notes"
            className="ml-auto grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <CloseIcon />
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={text}
          disabled={!isLoaded}
          onChange={(event) => changeText(event.target.value)}
          onBlur={saveNow}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose()
          }}
          rows={10}
          // placeholder={'Nike — Anaya (recruiter, LinkedIn): role closed, said ping her for other openings\nStripe — Rahul (SWE): referred me once, happy to again'}
          aria-label="Notes"
          className="block max-h-[60dvh] min-h-32 w-full resize-y rounded-md border border-zinc-200 bg-surface px-3 py-2 font-mono text-[13px] leading-5 placeholder:text-zinc-400 disabled:opacity-60 dark:border-zinc-800"
        />
      </div>
    </section>
  )
}

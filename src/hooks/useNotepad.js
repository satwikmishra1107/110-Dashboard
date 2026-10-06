import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCurrentUserEmail } from '../data/jobTracking'
import { fetchNotepad, saveNotepad } from '../data/notepad'

const SAVE_DELAY_MS = 800

export function useNotepad(isOpen) {
  const [text, setText] = useState('')
  const [saveState, setSaveState] = useState('loading')

  const currentUserEmail = useRef(null)
  const savedText = useRef(null)
  const latestText = useRef('')
  const saveTimer = useRef(null)

  const getEmail = async () => {
    if (!currentUserEmail.current) currentUserEmail.current = await fetchCurrentUserEmail()
    return currentUserEmail.current
  }

  const saveNow = useCallback(async () => {
    clearTimeout(saveTimer.current)
    const textToSave = latestText.current
    if (savedText.current === null || textToSave === savedText.current) return

    setSaveState('saving')
    try {
      await saveNotepad(textToSave, await getEmail())
      savedText.current = textToSave
      // You may have kept typing while this was saving
      setSaveState(latestText.current === textToSave ? 'saved' : 'unsaved')
    } catch (error) {
      console.error(error)
      setSaveState('error')
    }
  }, [])

  // Opening: load the latest text (unless you have edits that haven't saved yet). Closing: save.
  useEffect(() => {
    if (!isOpen) {
      saveNow()
      return
    }
    if (savedText.current !== null && latestText.current !== savedText.current) return

    let isCancelled = false
    if (savedText.current === null) setSaveState('loading')
    ;(async () => {
      try {
        const loadedText = await fetchNotepad(await getEmail())
        if (isCancelled) return
        savedText.current = loadedText
        latestText.current = loadedText
        setText(loadedText)
        setSaveState('saved')
      } catch (error) {
        console.error(error)
        if (!isCancelled && savedText.current === null) setSaveState('error')
      }
    })()
    return () => {
      isCancelled = true
    }
  }, [isOpen, saveNow])

  const changeText = (newText) => {
    latestText.current = newText
    setText(newText)
    setSaveState('unsaved')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(saveNow, SAVE_DELAY_MS)
  }

  const isLoaded = savedText.current !== null
  return { text, changeText, saveState, isLoaded, saveNow }
}

import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_WEAK_CUTOFF,
  checkGeminiKey,
  deleteOutdatedScores,
  fetchResumeProfile,
  saveGeminiKey,
  saveResume,
  saveWeakCutoff,
} from '../data/resumeMatching'
import { extractPdfText, isPdfFile } from '../lib/pdfText'

/**
 * Your resume-matching setup: latest resume version, Gemini key, weak-match cutoff.
 * The scores themselves load with the jobs (useJobData), so they refresh with the board.
 *
 * Actions (each returns nothing and throws a message that can be shown as is):
 *   saveKey(key)            → checks the key with Google, then saves it
 *   uploadResume(file)      → PDF only: reads its text in the browser, saves it as the next version
 *   changeWeakCutoff(n)     → 0–100
 *   rescoreOutdatedJobs()   → deletes scores made with an older resume; the next hourly run redoes them
 */
export function useResumeMatching(currentUserEmail, { onScoresChanged }) {
  const [profile, setProfile] = useState(null) // null until loaded
  const [loadError, setLoadError] = useState(null)

  const reloadProfile = useCallback(async () => {
    if (!currentUserEmail) return
    try {
      setProfile(await fetchResumeProfile(currentUserEmail))
      setLoadError(null)
    } catch (error) {
      setLoadError(error.message)
    }
  }, [currentUserEmail])

  useEffect(() => {
    reloadProfile()
  }, [reloadProfile])

  const saveKey = useCallback(
    async (key) => {
      const trimmedKey = key.trim()
      if (!trimmedKey) throw new Error('Paste your Gemini API key first.')
      if ((await checkGeminiKey(trimmedKey)) === 'invalid') {
        throw new Error('Google says this key isn’t valid. Copy it again from Google AI Studio.')
      }
      await saveGeminiKey(trimmedKey, currentUserEmail)
      await reloadProfile()
    },
    [currentUserEmail, reloadProfile],
  )

  const uploadResume = useCallback(
    async (file) => {
      if (!isPdfFile(file)) throw new Error('Please upload a PDF file. Other file types aren’t accepted.')
      const resumeText = await extractPdfText(file)
      await saveResume({ fileName: file.name, resumeText }, currentUserEmail)
      await reloadProfile()
    },
    [currentUserEmail, reloadProfile],
  )

  const changeWeakCutoff = useCallback(
    async (weakCutoff) => {
      const previousProfile = profile
      setProfile((currentProfile) => ({ ...currentProfile, weakCutoff })) // the list updates straight away
      try {
        await saveWeakCutoff(weakCutoff, currentUserEmail)
      } catch (error) {
        setProfile(previousProfile)
        throw error
      }
    },
    [currentUserEmail, profile],
  )

  const rescoreOutdatedJobs = useCallback(async () => {
    if (!profile?.latestResume) return
    await deleteOutdatedScores(profile.latestResume.version, currentUserEmail)
    onScoresChanged()
  }, [currentUserEmail, profile, onScoresChanged])

  return {
    profile,
    loadError,
    hasResume: Boolean(profile?.latestResume),
    weakCutoff: profile?.weakCutoff ?? DEFAULT_WEAK_CUTOFF,
    latestResumeVersion: profile?.latestResume?.version ?? null,
    saveKey,
    uploadResume,
    changeWeakCutoff,
    rescoreOutdatedJobs,
    reloadProfile,
  }
}

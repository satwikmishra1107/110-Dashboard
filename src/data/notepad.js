import { supabase } from '../lib/supabaseClient'

/*
 * Your free-form notepad (who you know where, who to ping back…).
 * It's one row in personal_tracking under a made-up job key, so like job notes it's per person:
 *   company = '__notepad__', job_id = '__notepad__', person = your email, note = the text
 */
export const NOTEPAD_COMPANY = '__notepad__'
const NOTEPAD_JOB_ID = '__notepad__'

export async function fetchNotepad(currentUserEmail) {
  const { data, error } = await supabase
    .from('personal_tracking')
    .select('note')
    .eq('company', NOTEPAD_COMPANY)
    .eq('job_id', NOTEPAD_JOB_ID)
    .eq('person', currentUserEmail)
    .maybeSingle()
  if (error) throw new Error(`Could not load notes: ${error.message}`)
  return data?.note ?? ''
}

export async function saveNotepad(text, currentUserEmail) {
  const { error } = await supabase.from('personal_tracking').upsert(
    {
      company: NOTEPAD_COMPANY,
      job_id: NOTEPAD_JOB_ID,
      person: currentUserEmail,
      status: 'new',
      note: text || null,
      status_changed_at: null,
    },
    { onConflict: 'company,job_id,person' },
  )
  if (error) throw new Error(`Could not save notes: ${error.message}`)
}

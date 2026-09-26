import { normalizeTitle } from '../lib/constants'
import { supabase } from '../lib/supabaseClient'

/*
 * Titles you never want to see ("Always hide this title").
 * Stored in the Supabase table `hidden_titles`, one row per title.
 */

/** Returns a Set of hidden titles, e.g. Set { 'talent acquisition partner', 'engineering manager' } */
export async function fetchHiddenTitles() {
  const { data: rows, error } = await supabase.from('hidden_titles').select('title')
  if (error) throw new Error(`Could not load hidden titles: ${error.message}`)
  return new Set(rows.map((row) => row.title))
}

/** Add a title to the list. If it's already there, nothing happens. */
export async function hideTitle(title) {
  const { error } = await supabase
    .from('hidden_titles')
    .upsert({ title: normalizeTitle(title) }, { onConflict: 'title', ignoreDuplicates: true })
  if (error) throw new Error(`Could not hide title: ${error.message}`)
}

/** Remove a title from the list. */
export async function unhideTitle(title) {
  const { error } = await supabase.from('hidden_titles').delete().eq('title', normalizeTitle(title))
  if (error) throw new Error(`Could not unhide title: ${error.message}`)
}
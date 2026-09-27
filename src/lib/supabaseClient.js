import { createClient } from '@supabase/supabase-js'

/*
 * The one connection to your Supabase database.
 * Every read and write in the app will import `supabase` from this file.
 *
 * The two values come from the .env file in the project root.
 * Vite only exposes variables whose names start with VITE_ to the browser.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env and restart `npm run dev`.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  // No login in this app, so there's no user session to save or refresh
  auth: { persistSession: false, autoRefreshToken: false },
})
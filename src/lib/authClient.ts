import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY is not set in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Base URL for Supabase PostgREST API (e.g. .../rest/v1). */
export const supabaseRestBaseUrl = (): string => {
  return `${supabaseUrl.replace(/\/$/, '')}/rest/v1`;
};

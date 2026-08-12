import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js';

export const createSupabaseClient = (authToken: string): SupabaseClient => {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    }
  );
};

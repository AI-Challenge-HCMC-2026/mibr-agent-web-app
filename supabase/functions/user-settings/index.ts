import { createClient } from 'jsr:@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface UserSettingsPayload {
  provider?: string;
  apikey?: string;
  settings?: {
    model?: string;
    enableMcp?: boolean;
    enableReasoning?: boolean;
    [key: string]: unknown;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const userId = user.id;

    // GET / — fetch the user's settings row
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('user_settings')
        .select('user_id, provider, apikey, settings')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      return json(data ?? null);
    }

    // POST / — upsert the user's settings row
    if (req.method === 'POST') {
      let body: UserSettingsPayload;
      try {
        body = await req.json();
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }

      const { provider, apikey, settings } = body;

      const { data, error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: userId,
            provider: provider ?? 'gemini',
            apikey: apikey ?? '',
            settings: settings ?? {},
          },
          { onConflict: 'user_id' }
        )
        .select('user_id, provider, apikey, settings')
        .single();

      if (error) return json({ error: error.message }, 500);
      return json(data, 201);
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    console.error('user-settings error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

import { extractUser, AuthError } from './_auth.ts';

// CORS headers must be present on ALL responses for browser requests to succeed
const corsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
});

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });

const badRequest = (message: string): Response => json({ error: message }, 400);
const notFound = (message: string): Response => json({ error: message }, 404);

interface CreateMessagePayload {
  session_id: string;
  user_id?: string | null;
  role: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  title?: string | null;
}

Deno.serve(async (req: Request) => {
  const method = req.method;
  const url = new URL(req.url);
  const path = url.pathname.replace(/^(\/functions\/v1)?\/chat-api/, '').replace(/^\/+/, '');

  try {
    // Handle OPTIONS preflight — no auth required
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // GET /openapi — proxy the Management API OpenAPI spec (it has no CORS)
    if (method === 'GET' && path === 'openapi') {
      const origin = `${Deno.env.get('SUPABASE_URL')}/api/v1/openapi.json`;
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const upstream = await fetch(origin, {
        headers: { Authorization: `Bearer ${serviceRoleKey}` },
      });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...corsHeaders(),
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    const { userId, supabase } = await extractUser(req);

    // GET /chat/sessions?user_id=&limit=&offset=
    if (method === 'GET' && path === 'chat/sessions') {
      const limit = Number(url.searchParams.get('limit') || '50');
      const offset = Number(url.searchParams.get('offset') || '0');
      const userIdParam = url.searchParams.get('user_id');

      if (userIdParam && userIdParam !== userId) {
        return json({ error: 'Forbidden' }, 403);
      }

      const { data: sessions, error } = await supabase
        .from('chat_sessions')
        .select('session_id, user_id, title, created_at, updated_at, message_count:chat_messages(count)')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) return json({ error: error.message }, 500);

      const result = (sessions ?? []).map((s) => ({
        session_id: s.session_id,
        user_id: s.user_id,
        title: s.title,
        created_at: s.created_at,
        updated_at: s.updated_at,
        message_count: s.message_count?.count ?? 0,
      }));

      return json(result);
    }

    // GET /chat/sessions/:sessionId/messages?user_id=&limit=
    const sessionMessagesMatch = path.match(/^chat\/sessions\/([^/]+)\/messages$/);
    if (method === 'GET' && sessionMessagesMatch) {
      const sessionId = decodeURIComponent(sessionMessagesMatch[1]);
      const limit = Number(url.searchParams.get('limit') || '200');

      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('message_id, session_id, user_id, role, content, metadata, created_at')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) return json({ error: error.message }, 500);
      return json(messages ?? []);
    }

    // DELETE /chat/sessions/:sessionId?user_id=
    const sessionDeleteMatch = path.match(/^chat\/sessions\/([^/]+)$/);
    if (method === 'DELETE' && sessionDeleteMatch) {
      const sessionId = decodeURIComponent(sessionDeleteMatch[1]);

      const { error: msgError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId);
      if (msgError) return json({ error: msgError.message }, 500);

      const { data: deleted, error: sessError } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .select('session_id');
      if (sessError) return json({ error: sessError.message }, 500);

      return json({ status: 'ok', message: 'Deleted chat session', deleted_count: deleted?.length ?? 0 });
    }

    // POST /chat/messages — auto-creates the session if it doesn't exist
    if (method === 'POST' && path === 'chat/messages') {
      let body: CreateMessagePayload;
      try {
        body = (await req.json()) as CreateMessagePayload;
      } catch {
        return badRequest('Invalid JSON body');
      }

      const { session_id, user_id, role, content, metadata, title } = body;
      if (!session_id || !content || !role) {
        return badRequest('Missing required fields: session_id, role, content');
      }
      if (user_id && user_id !== userId) {
        return json({ error: 'Forbidden' }, 403);
      }

      // ensure the session exists
      const { data: existing } = await supabase
        .from('chat_sessions')
        .select('session_id')
        .eq('session_id', session_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existing) {
        const { error: upsertError } = await supabase.from('chat_sessions').insert({
          session_id,
          user_id: userId,
          title: title ?? 'Untitled chat',
        });
        if (upsertError) return json({ error: upsertError.message }, 500);
      } else if (title) {
        const { error: titleError } = await supabase
          .from('chat_sessions')
          .update({ title })
          .eq('session_id', session_id)
          .eq('user_id', userId);
        if (titleError) return json({ error: titleError.message }, 500);
      }

      const { data: message, error } = await supabase
        .from('chat_messages')
        .insert({
          session_id,
          user_id: userId,
          role,
          content,
          metadata: metadata ?? null,
        })
        .select('message_id, session_id, user_id, role, content, metadata, created_at')
        .single();

      if (error) return json({ error: error.message }, 500);
      return json(message, 201);
    }

    // DELETE /chat/history?user_id=
    if (method === 'DELETE' && path === 'chat/history') {
      const { data: messages, error: msgError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('user_id', userId)
        .select('message_id');
      if (msgError) return json({ error: msgError.message }, 500);

      const { data: sessions, error: sessError } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('user_id', userId)
        .select('session_id');
      if (sessError) return json({ error: sessError.message }, 500);

      return json({
        status: 'ok',
        message: 'Deleted all chat history',
        deleted_count: (messages?.length ?? 0) + (sessions?.length ?? 0),
      });
    }

    // DELETE /chat/messages/:messageId?user_id=
    const messageDeleteMatch = path.match(/^chat\/messages\/(\d+)$/);
    if (method === 'DELETE' && messageDeleteMatch) {
      const messageId = Number(messageDeleteMatch[1]);

      const { data: deleted, error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .select('message_id');
      if (error) return json({ error: error.message }, 500);

      return json({
        status: 'ok',
        message: 'Deleted chat message',
        deleted_count: deleted?.length ?? 0,
      });
    }

    return notFound(`No route for ${method} /${path}`);
  } catch (err) {
    if (err instanceof AuthError) {
      return json({ error: err.message }, 401);
    }
    console.error('chat-api error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

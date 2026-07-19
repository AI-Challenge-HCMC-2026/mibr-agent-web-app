/* =============================================================
   Vercel Edge Function — ckey.vn proxy (production)

   Mirrors the Vite dev proxy (see vite.config.ts) so the client's
   /api/ckey/* calls work identically in local dev and on Vercel.

   - Injects the auth cookie server-side (from the CKEY_COOKIE env var),
     so it never reaches the browser.
   - Gates access behind ADMIN_PASSWORD: the client must send a matching
     `x-admin-key` header, obtained by logging in. This stops anyone from
     hitting /api/ckey/* directly without signing in.
   ============================================================= */

export const config = { runtime: 'edge' };

// Only these ckey.vn ajax endpoints may be proxied.
const ALLOWED_PATHS = new Set(['apiai-stream', 'apiai-usage-breakdown']);

const CKEY_ORIGIN = 'https://ckey.vn';

export default async function handler(req: Request): Promise<Response> {
  const cookie = process.env.CKEY_COOKIE ?? '';
  const adminPassword = process.env.ADMIN_PASSWORD ?? '';

  // ---- Auth gate ----
  if (!adminPassword) {
    return json({ error: 'Server chưa cấu hình ADMIN_PASSWORD.' }, 500);
  }
  const key = req.headers.get('x-admin-key') ?? '';
  if (key !== adminPassword) {
    return json({ error: 'Không có quyền truy cập.' }, 401);
  }
  if (!cookie) {
    return json({ error: 'Server chưa cấu hình CKEY_COOKIE.' }, 500);
  }

  // ---- Resolve the target path from /api/ckey/<path> ----
  const url = new URL(req.url);
  const sub = url.pathname.replace(/^\/api\/ckey\//, '').replace(/^\/+|\/+$/g, '');
  if (!ALLOWED_PATHS.has(sub)) {
    return json({ error: `Endpoint không được phép: ${sub}` }, 404);
  }

  const target = `${CKEY_ORIGIN}/ajax/${sub}${url.search}`;

  // ---- Forward to ckey.vn with the auth cookie ----
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: 'GET',
      headers: {
        cookie,
        accept: 'application/json',
        referer: `${CKEY_ORIGIN}/api-ai-dashboard`,
        origin: CKEY_ORIGIN,
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      },
    });
  } catch {
    return json({ error: 'Không kết nối được tới ckey.vn.' }, 502);
  }

  const ct = upstream.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    // A login redirect / HTML error page means the cookie has expired.
    return json(
      { error: 'Cookie ckey.vn có thể đã hết hạn. Cập nhật CKEY_COOKIE rồi redeploy.' },
      502,
    );
  }

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/* =============================================================
   Vercel Edge Function — ckey.vn proxy (production)

   Mirrors the Vite dev proxy (see vite.config.ts) so the client's
   /api/ckey/* calls work identically in local dev and on Vercel.

   - Injects the API key server-side (from CKEY_APIKEY env var),
     so it never reaches the browser.
   - Gates access behind ADMIN_PASSWORD: the client must send a matching
     `x-admin-key` header, obtained by logging in.
   ============================================================= */

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

const CKEY_ORIGIN = 'https://ckey.vn';

export default async function handler(req: Request): Promise<Response> {
  const apiKey = process.env.CKEY_APIKEY ?? '';
  const adminPassword = process.env.ADMIN_PASSWORD ?? '';

  // ---- Auth gate ----
  if (!adminPassword) {
    return json({ error: 'Server chưa cấu hình ADMIN_PASSWORD.' }, 500);
  }
  const key = req.headers.get('x-admin-key') ?? '';
  if (key !== adminPassword) {
    return json({ error: 'Không có quyền truy cập.' }, 401);
  }
  if (!apiKey) {
    return json({ error: 'Server chưa cấu hình CKEY_APIKEY.' }, 500);
  }

  // ---- Resolve the target path from /api/ckey/<path> ----
  const url = new URL(req.url);
  const sub = url.pathname.replace(/^\/api\/ckey\//, '').replace(/^\/+|\/+$/g, '');

  if (!sub) {
    return json({ error: 'Path không hợp lệ.' }, 400);
  }

  const targetUrl = new URL(`${CKEY_ORIGIN}/api/${sub}`);
  url.searchParams.forEach((val, name) => {
    targetUrl.searchParams.set(name, val);
  });
  targetUrl.searchParams.set('key', apiKey);

  // ---- Forward to ckey.vn ----
  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      },
    });
  } catch {
    return json({ error: 'Không kết nối được tới ckey.vn.' }, 502);
  }

  const ct = upstream.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return json(
      { error: 'Phản hồi từ ckey.vn không phải JSON. Vui lòng kiểm tra lại CKEY_APIKEY.' },
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


/* =============================================================
   Admin allowlist check (Supabase)
   Calls the `is_admin_email` RPC — a SECURITY DEFINER function that
   returns yes/no for a single email without exposing the full admin
   list. The publishable/anon key is public by design, so it's safe
   to ship in the client bundle. See supabase migrations.
   ============================================================= */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Ask Supabase whether `email` is an active admin. Returns true only for
 * an email present in `admin_users` with `is_active = true` (matched
 * case-insensitively and trimmed server-side).
 */
export async function isAdminEmail(email: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase chưa được cấu hình (thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin_email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ check_email: email }),
  });

  if (!res.ok) {
    throw new Error(`Không thể xác thực email quản trị (HTTP ${res.status}).`);
  }

  // The RPC returns a bare JSON boolean.
  return (await res.json()) === true;
}

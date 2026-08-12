import { createSupabaseClient } from './_supabase.ts';

export interface AuthResult {
  userId: string;
  supabase: ReturnType<typeof createSupabaseClient>;
}

/**
 * Extract the Bearer token, validate it with Supabase Auth,
 * and return the authenticated user's ID + a Supabase client bound to that user.
 */
export const extractUser = async (req: Request): Promise<AuthResult> => {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    throw new AuthError('Missing or invalid Authorization header');
  }

  const supabase = createSupabaseClient(token);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError('Unauthorized');
  }

  return { userId: user.id, supabase };
};

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

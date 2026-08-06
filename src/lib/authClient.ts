import { createAuthClient } from '@neondatabase/neon-js/auth';

const rawNeonAuthUrl = (import.meta.env.VITE_NEON_AUTH_URL as string | undefined) || '';

// Automatically remove trailing slashes or trailing '/auth' if present, 
// as createAuthClient internally appends '/auth' to the base URL.
const neonAuthUrl = rawNeonAuthUrl.trim().replace(/\/+$/, '').replace(/\/auth$/, '');

if (!neonAuthUrl) {
  console.warn('VITE_NEON_AUTH_URL is not set in environment variables.');
}

export const authClient = createAuthClient(neonAuthUrl);


import React, { createContext, useContext, useEffect, useState } from 'react';
import { authClient } from '../lib/authClient';

export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getCookieToken = (): string | null => {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';');
  for (let c of cookies) {
    const [name, val] = c.trim().split('=');
    if (
      name === 'better-auth.session_token' ||
      name === 'session_token' ||
      name === 'auth_token' ||
      name === 'jwt' ||
      name === 'token'
    ) {
      return decodeURIComponent(val || '');
    }
  }
  return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchSession = async () => {
    try {
      setIsLoading(true);

      const urlParams = new URLSearchParams(window.location.search);
      const urlError = urlParams.get('error') || urlParams.get('error_description');

      if (urlError) {
        console.warn('[AuthContext] OAuth URL Error detected:', urlError);
        setAuthError('Tài khoản không được cấp quyền truy cập vào hệ thống');
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const res = await authClient.getSession();

      if (res?.data?.user) {
        const currentUser = res.data.user as User;
        const sessionData = res.data.session as any;
        const currentToken =
          sessionData?.token ||
          sessionData?.sessionToken ||
          sessionData?.id ||
          (res.data as any)?.token ||
          getCookieToken();

        const email = (currentUser.email || '').toLowerCase().trim();
        const domain = email.split('@')[1] || '';

        const allowedDomainsRaw = import.meta.env.VITE_ALLOWED_DOMAINS as string | undefined;
        const allowedEmailsRaw = import.meta.env.VITE_ALLOWED_EMAILS as string | undefined;

        const allowedDomains = allowedDomainsRaw
          ? allowedDomainsRaw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
          : [];
        const allowedEmails = allowedEmailsRaw
          ? allowedEmailsRaw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
          : [];

        let isWhitelisted = true;
        const hasDomainFilter = allowedDomains.length > 0;
        const hasEmailFilter = allowedEmails.length > 0;

        if (hasDomainFilter || hasEmailFilter) {
          const domainMatches = hasDomainFilter && allowedDomains.includes(domain);
          const emailMatches = hasEmailFilter && allowedEmails.includes(email);

          if (hasDomainFilter && hasEmailFilter) {
            isWhitelisted = domainMatches || emailMatches;
          } else if (hasDomainFilter) {
            isWhitelisted = domainMatches;
          } else if (hasEmailFilter) {
            isWhitelisted = emailMatches;
          }
        }

        if (!isWhitelisted) {
          console.warn('[AuthContext] User email is not whitelisted in env:', email);
          await authClient.signOut();
          setUser(null);
          setToken(null);
          setAuthError('Tài khoản không được cấp quyền truy cập vào hệ thống');
          return;
        }

        setUser(currentUser);
        setToken(currentToken);
        setAuthError(null);
      } else {
        setUser(null);
        setToken(null);
      }
    } catch (err) {
      console.error('Failed to retrieve session from Neon Auth:', err);
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const getToken = async (): Promise<string | null> => {
    try {
      const res = await authClient.getSession();
      const sessionData = res?.data?.session as any;
      const t =
        sessionData?.token ||
        sessionData?.sessionToken ||
        sessionData?.id ||
        (res?.data as any)?.token ||
        getCookieToken() ||
        token;

      if (t && t !== token) {
        setToken(t);
      }
      return t;
    } catch (err) {
      console.error('Failed to get token:', err);
      return token || getCookieToken();
    }
  };

  const signInWithGoogle = async () => {
    try {
      setAuthError(null);
      const res = await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}/chat`,
      });

      if (res?.error) {
        setAuthError('Tài khoản không được cấp quyền truy cập vào hệ thống');
      }
    } catch (err) {
      console.error('Google Sign-in error:', err);
      setAuthError('Tài khoản không được cấp quyền truy cập vào hệ thống');
    }
  };

  const signOut = async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      console.error('Sign-out error:', err);
    } finally {
      setUser(null);
      setToken(null);
      setAuthError(null);
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, authError, signInWithGoogle, signOut, clearAuthError, getToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


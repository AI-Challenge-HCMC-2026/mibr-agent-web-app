import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/authClient';

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

const NOT_ALLOWED_MESSAGE = 'Tài khoản không được cấp quyền truy cập vào hệ thống';

const toUser = (u: { id: string; email?: string | null; user_metadata?: Record<string, any> }): User => ({
  id: u.id,
  email: u.email || '',
  name: u.user_metadata?.name || u.user_metadata?.full_name || '',
  image: u.user_metadata?.avatar_url || u.user_metadata?.picture || '',
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const checkUserAllowed = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('check_user_allowed', { p_email: email });
      if (error) {
        console.error('[AuthContext] check_user_allowed failed:', error);
        return false;
      }
      return Boolean(data);
    } catch (err) {
      console.error('[AuthContext] check_user_allowed error:', err);
      return false;
    }
  };

  const fetchSession = async () => {
    try {
      setIsLoading(true);

      const urlParams = new URLSearchParams(window.location.search);
      const urlError = urlParams.get('error') || urlParams.get('error_description');

      if (urlError) {
        console.warn('[AuthContext] OAuth URL Error detected:', urlError);
        setAuthError(NOT_ALLOWED_MESSAGE);
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (session?.user) {
        const currentUser = toUser(session.user);
        const email = (currentUser.email || '').toLowerCase().trim();

        const isAllowed = await checkUserAllowed(email);

        if (!isAllowed) {
          console.warn('[AuthContext] User email is not in allowed_users:', email);
          await supabase.auth.signOut();
          setUser(null);
          setToken(null);
          setAuthError(NOT_ALLOWED_MESSAGE);
          return;
        }

        setUser(currentUser);
        setToken(session.access_token);
        setAuthError(null);
      } else {
        setUser(null);
        setToken(null);
      }
    } catch (err) {
      console.error('Failed to retrieve session from Supabase Auth:', err);
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const currentUser = toUser(session.user);
        setUser(currentUser);
        setToken(session.access_token);
        setAuthError(null);
      } else {
        setUser(null);
        setToken(null);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const getToken = async (): Promise<string | null> => {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return null;

      const expiresAt = session.expires_at;
      const nowSec = Math.floor(Date.now() / 1000);
      if (expiresAt && expiresAt - nowSec < 60) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed.session?.access_token) {
          setToken(refreshed.session.access_token);
          return refreshed.session.access_token;
        }
      }

      if (session.access_token !== token) {
        setToken(session.access_token);
      }
      return session.access_token;
    } catch (err) {
      console.error('Failed to get token:', err);
      return token;
    }
  };

  const signInWithGoogle = async () => {
    try {
      setAuthError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/chat`,
        },
      });

      if (error) {
        setAuthError(NOT_ALLOWED_MESSAGE);
      }
    } catch (err) {
      console.error('Google Sign-in error:', err);
      setAuthError(NOT_ALLOWED_MESSAGE);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
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

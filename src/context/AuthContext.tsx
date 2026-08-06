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
  isLoading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchSession = async () => {
    try {
      setIsLoading(true);
      setAuthError(null);
      const res = await authClient.getSession();

      if (res?.data?.user) {
        const currentUser = res.data.user as User;
        const email = (currentUser.email || '').toLowerCase().trim();
        const domain = email.split('@')[1] || '';

        // Check Whitelist if environment variables VITE_ALLOWED_DOMAINS or VITE_ALLOWED_EMAILS are defined
        const allowedDomainsRaw = import.meta.env.VITE_ALLOWED_DOMAINS as string | undefined;
        const allowedEmailsRaw = import.meta.env.VITE_ALLOWED_EMAILS as string | undefined;

        const allowedDomains = allowedDomainsRaw
          ? allowedDomainsRaw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
          : [];
        const allowedEmails = allowedEmailsRaw
          ? allowedEmailsRaw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
          : [];

        let isWhitelisted = true;

        if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
          isWhitelisted = false;
        }

        if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
          isWhitelisted = false;
        }

        if (!isWhitelisted) {
          await authClient.signOut();
          setUser(null);
          setAuthError(`Truy cập bị từ chối: Email (${email}) không nằm trong danh sách nội bộ được phép.`);
          return;
        }

        setUser(currentUser);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to retrieve session from Neon Auth:', err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setAuthError(null);
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}/chat`,
      });
    } catch (err) {
      console.error('Google Sign-in error:', err);
    }
  };

  const signOut = async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      console.error('Sign-out error:', err);
    } finally {
      setUser(null);
      setAuthError(null);
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, authError, signInWithGoogle, signOut, clearAuthError }}>
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


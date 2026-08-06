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
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = async () => {
    try {
      setIsLoading(true);
      const res = await authClient.getSession();
      if (res?.data?.user) {
        setUser(res.data.user as User);
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
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signInWithGoogle, signOut }}>
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

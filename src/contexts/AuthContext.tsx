import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api, { type LoginResponse } from '@/lib/api';

type AppRole = 'admin' | 'patient';
type AccountStatus = 'pending' | 'approved' | 'suspended';

interface UserData {
  id: string;
  email: string;
}

interface Profile {
  fullName: string;
  status: AccountStatus;
}

interface AuthContextType {
  user: UserData | null;
  session: unknown;
  role: AppRole | null;
  profile: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, fullName: string, phoneNumber?: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const statusPollRef = useRef<ReturnType<typeof setInterval>>();

  // Restore session from localStorage
  useEffect(() => {
    const storedUser = api.auth.getStoredUser();
    if (storedUser) {
      setUser({ id: storedUser.id, email: storedUser.email });
      setRole(storedUser.role);
      setProfile({ fullName: storedUser.fullName, status: storedUser.status as AccountStatus });
    }
    setLoading(false);
  }, []);

  // Poll for status updates (e.g. pending → approved) so patient doesn't need to re-login
  useEffect(() => {
    if (user && profile?.status === 'pending') {
      statusPollRef.current = setInterval(async () => {
        const refreshed = await api.auth.refreshProfile();
        if (refreshed && refreshed.status !== 'pending') {
          setProfile({ fullName: refreshed.fullName, status: refreshed.status as AccountStatus });
          setRole(refreshed.role);
        }
      }, 10000);
    }
    return () => {
      if (statusPollRef.current) clearInterval(statusPollRef.current);
    };
  }, [user, profile?.status]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const data: LoginResponse = await api.auth.login(email, password);
      setUser({ id: data.user.id, email: data.user.email });
      setRole(data.user.role);
      setProfile({ fullName: data.user.fullName, status: data.user.status as AccountStatus });
      api.auth.storeUser(data.user);
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Login failed' };
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, fullName: string, phoneNumber?: string) => {
    try {
      await api.auth.register(email, password, fullName, phoneNumber);
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Registration failed' };
    }
  }, []);

  const logout = useCallback(async () => {
    api.auth.logout();
    api.auth.clearUser();
    setUser(null);
    setRole(null);
    setProfile(null);
  }, []);

  const resetPassword = useCallback(async (_email: string) => {
    return { error: 'Password reset requires the backend reset-password endpoint.' };
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      session: user,
      role,
      profile,
      loading,
      login,
      signup,
      logout,
      resetPassword,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

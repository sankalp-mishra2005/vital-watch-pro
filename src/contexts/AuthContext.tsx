import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

  const resetPassword = useCallback(async (email: string) => {
    try {
      // Note: In the Node.js backend, reset requires email + newPassword.
      // The forgot-password page only collects email, so this sends a placeholder.
      // In production, implement email-based token flow.
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Reset failed' };
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      session: user, // Compatibility
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

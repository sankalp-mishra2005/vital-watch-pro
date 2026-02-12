import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

type AppRole = 'admin' | 'patient';
type AccountStatus = 'pending' | 'approved' | 'suspended';

interface Profile {
  fullName: string;
  status: AccountStatus;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserMeta = useCallback(async (userId: string) => {
    try {
      // Fetch role using security definer function
      const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: userId });
      setRole((roleData as AppRole) || null);

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, status')
        .eq('id', userId)
        .single();

      if (profileData) {
        setProfile({
          fullName: profileData.full_name,
          status: profileData.status as AccountStatus,
        });
      }

      // Update last_seen
      await supabase.rpc('update_last_seen', { _user_id: userId });
    } catch (err) {
      console.error('Error fetching user metadata:', err);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to prevent Supabase client deadlock
          setTimeout(() => fetchUserMeta(newSession.user.id), 0);
        } else {
          setRole(null);
          setProfile(null);
        }

        if (event === 'INITIAL_SESSION') {
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (existingSession?.user) {
        setSession(existingSession);
        setUser(existingSession.user);
        fetchUserMeta(existingSession.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserMeta]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Email not confirmed')) {
        return { error: 'Please verify your email before logging in.' };
      }
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const signup = useCallback(async (email: string, password: string, fullName: string, phoneNumber?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone_number: phoneNumber || '' },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      role,
      profile,
      loading,
      login,
      signup,
      logout,
      resetPassword,
      isAuthenticated: !!session,
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

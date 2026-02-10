import React, { createContext, useContext, useState, useCallback } from 'react';
import { DEMO_USERS } from '@/lib/mockData';

interface User {
  username: string;
  role: 'admin' | 'patient';
  name: string;
  patientId?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback((username: string, password: string): boolean => {
    const found = DEMO_USERS.find(u => u.username === username && u.password === password);
    if (found) {
      setUser({ username: found.username, role: found.role, name: found.name, patientId: found.patientId });
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => setUser(null), []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

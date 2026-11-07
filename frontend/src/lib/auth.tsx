'use client';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, loginRequest, tokens } from './api';
import type { Role, User } from './types';

interface Ctx {
  user: User | null; loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: Record<string, unknown>) => Promise<User>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens.get()) { setLoading(false); return; }
    api<User>('/auth/me')
      .then((r) => setUser(r.data))
      .catch(() => {
        tokens.set(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => { const u = await loginRequest('login', { email, password }); setUser(u); return u; }, []);
  const register = useCallback(async (body: Record<string, unknown>) => { const u = await loginRequest('register', body); setUser(u); return u; }, []);
  const logout = useCallback(async () => {
    const t = tokens.get();
    if (t) await api('/auth/logout', { body: { refreshToken: t.refreshToken }, auth: false }).catch(() => undefined);
    tokens.set(null); setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Redirects to /login (or /dashboard for the wrong role). Returns the user once it is safe to render. */
export function useRequireAuth(roles?: Role[]): User | null {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (roles && !roles.includes(user.role)) router.replace('/dashboard');
  }, [user, loading, roles, router]);
  return user && (!roles || roles.includes(user.role)) ? user : null;
}

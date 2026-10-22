import { ROLE_LABEL, type Role } from '@shortform/shared';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from './api';

export interface SessionUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  companyId: string | null;
  companyName: string | null;
  certStatus: string | null;
}

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (input: { email: string; password: string; name: string; companyName: string }) => Promise<SessionUser>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const refresh = async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    const me = await api<SessionUser>('/auth/me');
    setUser(me);
    setLoading(false);
  };

  useEffect(() => {
    refresh().catch(() => {
      setToken(null);
      setUser(null);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    refresh,
    login: async (email, password) => {
      const res = await api<{ accessToken: string; user: SessionUser }>('/auth/login', { method: 'POST', json: { email, password } });
      setToken(res.accessToken);
      setUser(res.user);
      return res.user;
    },
    register: async (input) => {
      const res = await api<{ accessToken: string; user: SessionUser }>('/auth/register', { method: 'POST', json: input });
      setToken(res.accessToken);
      setUser(res.user);
      return res.user;
    },
    logout: () => {
      setToken(null);
      setUser(null);
    },
  }), [user, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('AuthProvider 缺失');
  return ctx;
}

export function homeFor(role: Role) {
  return role === 'CLIENT' ? '/' : '/workbench';
}

export function roleLabel(role: Role) {
  return ROLE_LABEL[role];
}

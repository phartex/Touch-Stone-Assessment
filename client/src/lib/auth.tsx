import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { ApiError, api } from './api';
import type { User } from './types';

export const meKey = ['auth', 'me'] as const;

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  /** True after the user deliberately signed out (vs. a session expiring mid-visit). */
  signedOutByUser: boolean;
  login: (input: { email: string; password: string }) => Promise<User>;
  register: (input: { name: string; email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Resolves the current session. A 401 means "signed out", not an error. */
async function fetchMe(): Promise<User | null> {
  try {
    return (await api.get<{ user: User }>('/auth/me')).user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: meKey, queryFn: fetchMe, staleTime: Infinity, retry: false });

  const signedOutByUser = useRef(false);

  /**
   * Switch the session to `user` (or signed-out) and drop every other cached query so no data from
   * a previous session is shown. The session query itself is updated in place rather than cleared:
   * clearing the whole cache would detach mounted observers (including this provider's), leaving the
   * UI showing the old user while visible pages refetch with a dead cookie.
   */
  const setSession = (user: User | null) => {
    // Update the session first so route guards redirect before anything else re-renders.
    qc.setQueryData(meKey, user);
    void qc.cancelQueries({ predicate: (q) => q.queryKey[0] !== meKey[0] });
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== meKey[0] });
  };

  const onSignedIn = (user: User) => {
    signedOutByUser.current = false;
    setSession(user);
    return user;
  };

  const loginMutation = useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.post<{ user: User }>('/auth/login', input).then((r) => onSignedIn(r.user)),
  });
  const registerMutation = useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      api.post<{ user: User }>('/auth/register', input).then((r) => onSignedIn(r.user)),
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: me.data ?? null,
      signedOutByUser: signedOutByUser.current,
      isLoading: me.isPending,
      login: loginMutation.mutateAsync,
      register: registerMutation.mutateAsync,
      logout: async () => {
        await api.post('/auth/logout').catch(() => undefined);
        signedOutByUser.current = true;
        setSession(null);
      },
    }),
    [me.data, me.isPending, loginMutation.mutateAsync, registerMutation.mutateAsync, qc],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

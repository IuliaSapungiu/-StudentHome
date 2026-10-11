import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { becomeProvider, createUser, normalizeEmail, sessionReducer, switchMode as switchUserMode } from './sessionLogic';
import { loadAccounts, loadSessionUserId, saveAccounts, saveSessionUserId } from './sessionStorage';
import type { MockUser, Mode, RegistrationIntent, SessionState } from './types';

type AuthResult = { ok: true; user: MockUser } | { ok: false; error: string };

type SessionContextValue = {
  status: SessionState['status'];
  user: MockUser | null;
  isSignedIn: boolean;
  /** Creates a mock account on this device. Passwords are validated in the UI and never reach here. */
  register: (input: { email: string; intent: RegistrationIntent }) => Promise<AuthResult>;
  /** Signs in to an existing mock account on this device. */
  login: (email: string) => Promise<AuthResult>;
  /** Signs in as a fully formed mock user (used by the demo shortcuts). */
  signInAsMockUser: (user: MockUser) => Promise<MockUser>;
  logout: () => Promise<void>;
  switchMode: (mode: Mode) => Promise<void>;
  becomeProvider: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

type Props = {
  children: ReactNode;
  /** When false, preview accounts are ignored and cleaned up on start. See src/config/demo.ts. */
  allowDemoAccounts: boolean;
};

export function SessionProvider({ children, allowDemoAccounts }: Props) {
  const [state, dispatch] = useReducer(sessionReducer, { status: 'loading' });
  const accounts = useRef<MockUser[]>([]);
  const stateRef = useRef<SessionState>(state);
  stateRef.current = state;

  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await loadAccounts();
      const usable = stored.filter((a) => allowDemoAccounts || !a.isDemo);
      if (usable.length !== stored.length) await saveAccounts(usable);
      const id = await loadSessionUserId();
      if (!alive) return;
      accounts.current = usable;
      const user = usable.find((a) => a.id === id);
      dispatch(user ? { type: 'signed_in', user } : { type: 'guest' });
    })();
    return () => {
      alive = false;
    };
  }, [allowDemoAccounts]);

  const commit = useCallback(async (user: MockUser) => {
    accounts.current = [...accounts.current.filter((a) => a.id !== user.id), user];
    dispatch({ type: 'signed_in', user });
    await saveAccounts(accounts.current);
    await saveSessionUserId(user.id);
    return user;
  }, []);

  const value = useMemo<SessionContextValue>(() => {
    const currentUser = () => (stateRef.current.status === 'signed_in' ? stateRef.current.user : null);
    return {
      status: state.status,
      user: state.status === 'signed_in' ? state.user : null,
      isSignedIn: state.status === 'signed_in',
      async register({ email, intent }) {
        const normalized = normalizeEmail(email);
        if (accounts.current.some((a) => a.email === normalized)) {
          return { ok: false, error: 'An account with this email already exists on this device. Try logging in.' };
        }
        return { ok: true, user: await commit(createUser(normalized, intent)) };
      },
      async login(email) {
        const normalized = normalizeEmail(email);
        const found = accounts.current.find((a) => a.email === normalized);
        if (!found) {
          return { ok: false, error: 'No account with this email on this device yet. Create one first (prototype accounts are stored locally).' };
        }
        return { ok: true, user: await commit(found) };
      },
      signInAsMockUser: (user) => commit(user),
      async logout() {
        dispatch({ type: 'guest' });
        await saveSessionUserId(null);
      },
      async switchMode(mode) {
        const u = currentUser();
        if (u) await commit(switchUserMode(u, mode));
      },
      async becomeProvider() {
        const u = currentUser();
        if (u) await commit(becomeProvider(u));
      },
    };
  }, [state, commit]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>.');
  return ctx;
}

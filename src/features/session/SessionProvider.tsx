import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { accountRepository as defaultRepository } from '@/services';
import type { AccountRepository } from './accountRepository';
import {
  becomeProvider, createUser, normalizeEmail, normalizeUser, sessionReducer, switchMode as switchUserMode, TERMS_VERSION,
} from './sessionLogic';
import { newId } from '../../lib/id';
import { normalizePhone, validatePhone } from '../validation/phone';
import type { MockUser, Mode, RegistrationIntent, SessionState } from './types';

type AuthResult = { ok: true; user: MockUser } | { ok: false; error: string };

type RegisterInput = {
  email: string;
  intent: RegistrationIntent;
  fullName: string;
  phone: string;
  termsAccepted: boolean;
};

type SessionContextValue = {
  status: SessionState['status'];
  user: MockUser | null;
  isSignedIn: boolean;
  /** Creates a mock account on this device. Passwords are validated in the UI and never reach here. */
  register: (input: RegisterInput) => Promise<AuthResult>;
  /** Signs in to an existing mock account on this device. */
  login: (email: string) => Promise<AuthResult>;
  /** Signs in as a fully formed mock user (used by the demo shortcuts). */
  signInAsMockUser: (user: MockUser) => Promise<MockUser>;
  logout: () => Promise<void>;
  switchMode: (mode: Mode) => Promise<void>;
  becomeProvider: () => Promise<void>;
  /** Changes the account phone number. The new number must be verified again before it counts. */
  updatePhone: (phone: string) => Promise<AuthResult>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

type Props = {
  children: ReactNode;
  /** When false, preview accounts are ignored and cleaned up on start. See src/config/demo.ts. */
  allowDemoAccounts: boolean;
  repository?: AccountRepository;
};

export function SessionProvider({ children, allowDemoAccounts, repository = defaultRepository }: Props) {
  const [state, dispatch] = useReducer(sessionReducer, { status: 'loading' });
  const accounts = useRef<MockUser[]>([]);
  const stateRef = useRef<SessionState>(state);
  stateRef.current = state;

  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await repository.list();
      const usable = stored.filter((a) => allowDemoAccounts || !a.isDemo);
      if (usable.length !== stored.length) await repository.replaceAll(usable);
      const id = await repository.getSessionUserId();
      if (!alive) return;
      accounts.current = usable;
      const user = usable.find((a) => a.id === id);
      dispatch(user ? { type: 'signed_in', user } : { type: 'guest' });
    })();
    return () => {
      alive = false;
    };
  }, [allowDemoAccounts, repository]);

  const commit = useCallback(
    async (input: MockUser) => {
      const user = normalizeUser(input); // activeMode always matches a profile the account really has
      accounts.current = [...accounts.current.filter((a) => a.id !== user.id), user];
      dispatch({ type: 'signed_in', user });
      await repository.save(user);
      await repository.setSessionUserId(user.id);
      return user;
    },
    [repository],
  );

  const value = useMemo<SessionContextValue>(() => {
    const currentUser = () => (stateRef.current.status === 'signed_in' ? stateRef.current.user : null);
    return {
      status: state.status,
      user: state.status === 'signed_in' ? state.user : null,
      isSignedIn: state.status === 'signed_in',
      async register({ email, intent, fullName, phone, termsAccepted }) {
        if (!termsAccepted) return { ok: false, error: 'Please accept the Terms and the Privacy Policy to continue.' };
        const e164 = normalizePhone(phone);
        if (!e164) return { ok: false, error: validatePhone(phone) ?? 'Enter a valid phone number.' };
        const normalized = normalizeEmail(email);
        if (accounts.current.some((a) => a.email === normalized)) {
          return { ok: false, error: 'An account with this email already exists on this device. Try logging in.' };
        }
        const user = createUser(normalized, intent, newId(), {
          fullName,
          phone: e164,
          termsAcceptedAt: new Date().toISOString(),
          termsVersion: TERMS_VERSION,
        });
        return { ok: true, user: await commit(user) };
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
        await repository.setSessionUserId(null);
      },
      async switchMode(mode) {
        const u = currentUser();
        if (u) await commit(switchUserMode(u, mode));
      },
      async becomeProvider() {
        const u = currentUser();
        if (u) await commit(becomeProvider(u));
      },
      async updatePhone(phone) {
        const u = currentUser();
        if (!u) return { ok: false, error: 'Sign in first.' };
        const e164 = normalizePhone(phone);
        if (!e164) return { ok: false, error: validatePhone(phone) ?? 'Enter a valid phone number.' };
        return { ok: true, user: await commit({ ...u, phone: e164 }) };
      },
    };
  }, [state, commit, repository]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>.');
  return ctx;
}

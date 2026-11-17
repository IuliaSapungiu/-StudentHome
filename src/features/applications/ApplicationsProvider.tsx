import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applicationRepository as defaultRepository } from '@/services';
import { useSession } from '../session/SessionProvider';
import type { RepoResult } from '../shared/result';
import { applicationDefaults, isActiveApplication } from './applicationRules';
import type { ApplicationRepository } from './applicationRepository';
import type { ApplicationInput, RentalApplication } from './types';

type ApplicationsContextValue = {
  applications: RentalApplication[];
  ready: boolean;
  /** Submitted, under review or accepted (for the Profile row). */
  activeCount: number;
  /** The student's most recent common answers, offered as a starting point on the next application. */
  defaults: ReturnType<typeof applicationDefaults>;
  refresh: () => Promise<void>;
  submit: (input: ApplicationInput) => Promise<RepoResult<RentalApplication>>;
  withdraw: (id: string) => Promise<RepoResult<RentalApplication>>;
};

const ApplicationsContext = createContext<ApplicationsContextValue | null>(null);
const notSignedIn = (): RepoResult<RentalApplication> => ({ ok: false, error: { code: 'not_found', message: 'Sign in to manage applications.' } });

export function ApplicationsProvider({ children, repository = defaultRepository }: { children: ReactNode; repository?: ApplicationRepository }) {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [applications, setApplications] = useState<RentalApplication[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setApplications([]);
      setReady(false);
      return;
    }
    setApplications(await repository.listForStudent(userId));
    setReady(true);
  }, [repository, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = useCallback(
    async (input: ApplicationInput) => {
      if (!userId) return notSignedIn();
      const r = await repository.submit(userId, input);
      if (r.ok) await refresh();
      return r;
    },
    [repository, userId, refresh],
  );
  const withdraw = useCallback(
    async (id: string) => {
      if (!userId) return notSignedIn();
      const r = await repository.withdraw(id, userId);
      if (r.ok) await refresh();
      return r;
    },
    [repository, userId, refresh],
  );

  const value = useMemo<ApplicationsContextValue>(
    () => ({ applications, ready, activeCount: applications.filter(isActiveApplication).length, defaults: applicationDefaults(applications), refresh, submit, withdraw }),
    [applications, ready, refresh, submit, withdraw],
  );
  return <ApplicationsContext.Provider value={value}>{children}</ApplicationsContext.Provider>;
}

export function useApplications(): ApplicationsContextValue {
  const ctx = useContext(ApplicationsContext);
  if (!ctx) throw new Error('useApplications must be used inside <ApplicationsProvider>');
  return ctx;
}

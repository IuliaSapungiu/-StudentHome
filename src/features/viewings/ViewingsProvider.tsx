import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { viewingRepository as defaultRepository } from '@/services';
import { toLocalDateTime, type LocalDateTime } from '../../lib/dateTime';
import { useSession } from '../session/SessionProvider';
import type { ContactOrigin } from '../shared/attribution';
import type { RepoResult } from '../shared/result';
import type { ViewingRepository } from './viewingRepository';
import { bucketOf } from './viewingRules';
import type { ViewingRequest } from './types';

type ViewingsContextValue = {
  viewings: ViewingRequest[];
  ready: boolean;
  /** Confirmed viewings that have not happened yet (for the Profile row). */
  upcomingCount: number;
  refresh: () => Promise<void>;
  requestViewing: (propertyId: string, start: LocalDateTime, note?: string | null, origin?: ContactOrigin) => Promise<RepoResult<ViewingRequest>>;
  cancel: (id: string) => Promise<RepoResult<ViewingRequest>>;
  reschedule: (id: string, start: LocalDateTime) => Promise<RepoResult<ViewingRequest>>;
  acceptAlternative: (id: string) => Promise<RepoResult<ViewingRequest>>;
  rejectAlternative: (id: string) => Promise<RepoResult<ViewingRequest>>;
  /** The exact address, only for a confirmed viewing; otherwise null. */
  getConfirmedAddress: (id: string) => Promise<string | null>;
};

const ViewingsContext = createContext<ViewingsContextValue | null>(null);
const notSignedIn = <T,>(): RepoResult<T> => ({ ok: false, error: { code: 'not_found', message: 'Sign in to manage viewings.' } });

export function ViewingsProvider({ children, repository = defaultRepository }: { children: ReactNode; repository?: ViewingRepository }) {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [viewings, setViewings] = useState<ViewingRequest[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setViewings([]);
      setReady(false);
      return;
    }
    setViewings(await repository.listForStudent(userId));
    setReady(true);
  }, [repository, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const after = useCallback(
    async <T,>(r: RepoResult<T>) => {
      if (r.ok) await refresh();
      return r;
    },
    [refresh],
  );

  const requestViewing = useCallback(
    async (propertyId: string, start: LocalDateTime, note?: string | null, origin?: ContactOrigin) =>
      userId ? after(await repository.requestViewing({ studentId: userId, propertyId, start, note, origin })) : notSignedIn<ViewingRequest>(),
    [repository, userId, after],
  );
  const cancel = useCallback(async (id: string) => (userId ? after(await repository.cancel(id, userId)) : notSignedIn<ViewingRequest>()), [repository, userId, after]);
  const reschedule = useCallback(async (id: string, start: LocalDateTime) => (userId ? after(await repository.reschedule(id, userId, start)) : notSignedIn<ViewingRequest>()), [repository, userId, after]);
  const acceptAlternative = useCallback(async (id: string) => (userId ? after(await repository.acceptAlternative(id, userId)) : notSignedIn<ViewingRequest>()), [repository, userId, after]);
  const rejectAlternative = useCallback(async (id: string) => (userId ? after(await repository.rejectAlternative(id, userId)) : notSignedIn<ViewingRequest>()), [repository, userId, after]);
  const getConfirmedAddress = useCallback(async (id: string) => (userId ? repository.getConfirmedAddress(id, userId) : null), [repository, userId]);

  const value = useMemo<ViewingsContextValue>(() => {
    const nowLocal = toLocalDateTime(new Date());
    return {
      viewings,
      ready,
      upcomingCount: viewings.filter((v) => bucketOf(v, nowLocal) === 'upcoming').length,
      refresh, requestViewing, cancel, reschedule, acceptAlternative, rejectAlternative, getConfirmedAddress,
    };
  }, [viewings, ready, refresh, requestViewing, cancel, reschedule, acceptAlternative, rejectAlternative, getConfirmedAddress]);
  return <ViewingsContext.Provider value={value}>{children}</ViewingsContext.Provider>;
}

export function useViewings(): ViewingsContextValue {
  const ctx = useContext(ViewingsContext);
  if (!ctx) throw new Error('useViewings must be used inside <ViewingsProvider>');
  return ctx;
}

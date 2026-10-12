import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { verificationRepository as defaultRepository, verificationService as defaultService } from '@/services';
import { useSession } from '../session/SessionProvider';
import type { MockUser } from '../session/types';
import type { ServiceResult, VerificationRecord, VerificationStatus } from './types';
import type { VerificationRepository } from './verificationRepository';
import type { VerificationService } from './verificationService';
import { effectiveContactStatus, statusOf } from './verificationRules';

type Value = {
  /** True when outcomes are simulated and are not real-world verification. */
  simulated: boolean;
  records: VerificationRecord[];
  emailStatus: VerificationStatus;
  phoneStatus: VerificationStatus;
  statusFor: (kind: VerificationRecord['kind'], subjectId?: string | null) => VerificationStatus;
  refresh: () => Promise<void>;
  requestEmailVerification: () => Promise<ServiceResult>;
  /** Pass the updated user when the phone number was just changed. */
  startPhoneVerification: (user?: MockUser) => Promise<ServiceResult<{ expiresAt: number; demoHint?: string }>>;
  confirmPhoneCode: (code: string) => Promise<ServiceResult>;
};

const VerificationContext = createContext<Value | null>(null);

type Props = { children: ReactNode; repository?: VerificationRepository; service?: VerificationService };

export function VerificationProvider({ children, repository = defaultRepository, service = defaultService }: Props) {
  const { user } = useSession();
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    setRecords(userId ? await repository.listForUser(userId) : []);
  }, [repository, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<Value>(() => {
    const needUser = (u?: MockUser) => u ?? user;
    const run = async <T,>(fn: (u: MockUser) => Promise<ServiceResult<T>>, u?: MockUser): Promise<ServiceResult<T>> => {
      const target = needUser(u);
      if (!target) return { ok: false, error: { code: 'unavailable', message: 'Sign in first.' } };
      const result = await fn(target);
      await refresh();
      return result;
    };
    return {
      simulated: service.simulated,
      records,
      emailStatus: user ? effectiveContactStatus(records, user, 'email') : 'not_started',
      phoneStatus: user ? effectiveContactStatus(records, user, 'phone') : 'not_started',
      statusFor: (kind, subjectId = null) => (user ? statusOf(records, user.id, kind, subjectId) : 'not_started'),
      refresh,
      requestEmailVerification: () => run((u) => service.requestEmailVerification(u)),
      startPhoneVerification: (u) => run((target) => service.startPhoneVerification(target), u),
      confirmPhoneCode: (code) => run((u) => service.confirmPhoneCode(u, code)),
    };
  }, [records, user, service, refresh]);

  return <VerificationContext.Provider value={value}>{children}</VerificationContext.Provider>;
}

export function useVerification(): Value {
  const ctx = useContext(VerificationContext);
  if (!ctx) throw new Error('useVerification must be used inside <VerificationProvider>.');
  return ctx;
}

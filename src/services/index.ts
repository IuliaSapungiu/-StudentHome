import { dataSourceMode, type DataSourceMode } from '../config/dataSource';
import { demoVerificationEnabled } from '../config/demo';
import { createMockFormConfigRepository } from '../features/forms/mockFormConfigRepository';
import { createMockPlanCatalogRepository } from '../features/plans/mockPlanCatalogRepository';
import { createMockAccountRepository } from '../features/session/mockAccountRepository';
import { createMockVerificationService, type MockVerificationOutcomes } from '../features/verification/mockVerificationService';
import { createMockVerificationStore } from '../features/verification/mockVerificationStore';
import { mockStorage } from '../storage/mockStorage';

// Composition root for everything except properties (see src/data/index.ts). Screens reach these
// only through providers and hooks. Switching to Supabase means adding a 'supabase' branch here.
function createServices(mode: DataSourceMode) {
  if (mode === 'supabase') throw new Error('The Supabase services are not implemented yet.');

  const verificationStore = createMockVerificationStore(mockStorage);
  const verificationOutcomes: MockVerificationOutcomes = { smsDelivery: 'ok' };
  return {
    accountRepository: createMockAccountRepository(mockStorage),
    /** Read-only view: the app can never write verification statuses. */
    verificationRepository: { listForUser: verificationStore.listForUser },
    verificationService: createMockVerificationService({ store: verificationStore, enabled: () => demoVerificationEnabled, outcomes: verificationOutcomes }),
    planCatalogRepository: createMockPlanCatalogRepository(),
    formConfigRepository: createMockFormConfigRepository(),
    // Demo-only handles (used by src/demo, never by screens):
    verificationStore,
    verificationOutcomes,
  };
}

export const services = createServices(dataSourceMode);
export const { accountRepository, verificationRepository, verificationService, planCatalogRepository, formConfigRepository } = services;

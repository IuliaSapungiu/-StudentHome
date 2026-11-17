import { dataSourceMode, type DataSourceMode } from '../config/dataSource';
import { demoVerificationEnabled } from '../config/demo';
import { demoDataEnabled } from '../config/dataSource';
import { DEMO_PROPERTY_ADDRESSES } from '../data/mockAddresses';
import { propertyRepository } from '../data';
import { createApplicationStore, createMockApplicationRepository } from '../features/applications/mockApplicationRepository';
import { createMessagingStores, createMockConversationRepository } from '../features/messaging/mockConversationRepository';
import { createMockNotificationRepository, createNotificationStore } from '../features/notifications/mockNotificationRepository';
import { createMockSavedRepository } from '../features/saved/mockSavedRepository';
import { createAccessChecker } from '../features/verification/accessChecker';
import { createMockViewingRepository, createViewingStore } from '../features/viewings/mockViewingRepository';
import { createMockFormConfigRepository } from '../features/forms/mockFormConfigRepository';
import { createMockPlanCatalogRepository } from '../features/plans/mockPlanCatalogRepository';
import { createMockAccountRepository } from '../features/session/mockAccountRepository';
import { createMockVerificationService, type MockVerificationOutcomes } from '../features/verification/mockVerificationService';
import { createMockVerificationStore } from '../features/verification/mockVerificationStore';
import { createDemoVerificationControls } from '../demo/demoVerificationControls';
import { mockStorage } from '../storage/mockStorage';

// Composition root for everything except properties (see src/data/index.ts). Screens reach these
// only through providers and hooks. Switching to Supabase means adding a 'supabase' branch here.
function createServices(mode: DataSourceMode) {
  if (mode === 'supabase') throw new Error('The Supabase services are not implemented yet.');

  const verificationStore = createMockVerificationStore(mockStorage);
  const verificationOutcomes: MockVerificationOutcomes = { smsDelivery: 'ok' };
  const verificationService = createMockVerificationService({ 
    store: verificationStore, 
    enabled: () => demoVerificationEnabled, 
    outcomes: verificationOutcomes 
  });

  const demoVerificationControls = createDemoVerificationControls({
    store: verificationStore,
    enabled: () => demoVerificationEnabled,
    verificationService: verificationService as any, // <-- Pass verificationService here!
  });

  // Step 3c: saved homes, conversations, viewing requests and rental applications. The repositories enforce the
  // verification gates themselves, using the same rules the screens use.
  const accountRepository = createMockAccountRepository(mockStorage);
  const accessChecker = createAccessChecker({
    getUser: async (id) => (await accountRepository.list()).find((u) => u.id === id) ?? null,
    listRecords: verificationStore.listForUser,
  });
  const messagingStores = createMessagingStores(mockStorage);
  const notificationStore = createNotificationStore(mockStorage);
  const notificationRepository = createMockNotificationRepository({ store: notificationStore });
  const conversationRepository = createMockConversationRepository({ stores: messagingStores, properties: propertyRepository, access: accessChecker });
  const viewingStore = createViewingStore(mockStorage);
  const viewingRepository = createMockViewingRepository({
    store: viewingStore,
    properties: propertyRepository,
    access: accessChecker,
    events: conversationRepository,
    notifications: notificationRepository,
    addresses: (propertyId) => (demoDataEnabled ? DEMO_PROPERTY_ADDRESSES[propertyId] ?? null : null),
  });
  const applicationStore = createApplicationStore(mockStorage);
  const applicationRepository = createMockApplicationRepository({
    store: applicationStore,
    properties: propertyRepository,
    access: accessChecker,
    getUser: async (id) => (await accountRepository.list()).find((u) => u.id === id) ?? null,
    notifications: notificationRepository,
  });

  return {
    accountRepository,
    savedRepository: createMockSavedRepository(mockStorage),
    conversationRepository,
    viewingRepository,
    applicationRepository,
    notificationRepository,
    notificationStore,
    /** Read-only view: the app can never write verification statuses. */
    verificationRepository: { listForUser: verificationStore.listForUser },
    verificationService,
    planCatalogRepository: createMockPlanCatalogRepository(),
    formConfigRepository: createMockFormConfigRepository(),
    // Demo-only handles:
    verificationStore,
    messagingStores,
    viewingStore,
    applicationStore,
    verificationOutcomes,
    demoVerificationControls,
  };
}

export const services = createServices(dataSourceMode);
export const { accountRepository, verificationRepository, verificationService, planCatalogRepository, formConfigRepository, demoVerificationControls, savedRepository, conversationRepository, viewingRepository, applicationRepository, notificationRepository } = services;

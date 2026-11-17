import { demoLandlordEnabled } from '@/config/demo';
import { services } from '@/services';
import { clearDemoCommunication, seedDemoCommunication } from './demoCommunication';
import { createDemoLandlord } from './demoLandlord';

export const demoLandlord = createDemoLandlord({
  conversations: services.conversationRepository,
  viewings: services.viewingRepository,
  applications: services.applicationRepository,
  enabled: () => demoLandlordEnabled,
});

const handles = () => ({ messaging: services.messagingStores, viewings: services.viewingStore, applications: services.applicationStore, notifications: services.notificationStore });
export const seedSamples = (user: Parameters<typeof seedDemoCommunication>[1]) => (demoLandlordEnabled ? seedDemoCommunication(handles(), user) : Promise.resolve({ added: false }));
export const clearSamples = (userId: string) => (demoLandlordEnabled ? clearDemoCommunication(handles(), userId) : Promise.resolve());

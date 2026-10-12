import { demoVerificationEnabled } from '@/config/demo';
import { services } from '@/services';
import { createDemoVerificationControls } from './demoVerificationControls';

export const demoControls = createDemoVerificationControls({
  store: services.verificationStore,
  enabled: () => demoVerificationEnabled,
});

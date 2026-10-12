import type { FormConfigRepository } from './formConfigRepository';
import { PROVIDER_FORMS } from './providerForms';
import { REGISTRATION_FORM } from './registrationForm';

export const createMockFormConfigRepository = (): FormConfigRepository => ({
  getRegistrationForm: async () => REGISTRATION_FORM,
  getProviderForm: async (type) => PROVIDER_FORMS[type],
});

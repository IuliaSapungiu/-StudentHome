import type { FormDefinition } from './types';

// Common account details, collected once at registration for every account type.
// Provider type and provider-specific fields come afterwards (onboarding); property details live in Add Property.
export const REGISTRATION_FORM: FormDefinition = {
  id: 'registration',
  title: 'Create account',
  fields: [
    { key: 'fullName', label: 'Full name', type: 'name', placeholder: 'Ana Popescu', required: true },
    { key: 'email', label: 'Email address', type: 'email', placeholder: 'you@email.com', required: true },
    {
      key: 'phone', label: 'Phone number', type: 'phone', placeholder: '07xx xxx xxx or +44 …', required: true,
      hint: 'We only check the format here. We verify your number by SMS later, and only if you request a viewing.',
    },
    { key: 'password', label: 'Create password', type: 'password', placeholder: 'At least 8 characters', required: true },
    { key: 'acceptTerms', label: 'I accept the Terms and Conditions and the Privacy Policy', type: 'boolean', required: true },
  ],
};

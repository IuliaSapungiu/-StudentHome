import type { MockUser } from '../features/session/types';

// DEMO ONLY. Fictional preview accounts for trying the guest / student / landlord journeys.
export type DemoAccount = { key: 'student' | 'landlord' | 'both'; label: string; user: MockUser };

// Fictional phone numbers and simulated state only. Nothing here is a real person or a real verification.
const base = { fullName: 'Ana Popescu', isDemo: true as const, termsAcceptedAt: null, termsVersion: null };

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: 'student',
    label: 'Student account',
    user: { ...base, id: 'demo-student', email: 'demo.student@example.com', phone: '+40700000001', profiles: { student: true, provider: null }, activeMode: 'student' },
  },
  {
    key: 'landlord',
    label: 'Landlord account',
    user: { ...base, id: 'demo-landlord', email: 'demo.landlord@example.com', phone: '+40700000002', profiles: { student: false, provider: { onboardingComplete: false } }, activeMode: 'provider' },
  },
  {
    key: 'both',
    label: 'Student + Landlord account',
    user: { ...base, id: 'demo-both', email: 'demo.both@example.com', phone: '+40700000003', profiles: { student: true, provider: { onboardingComplete: false } }, activeMode: 'student' },
  },
];

import type { MockUser } from '../features/session/types';

// DEMO ONLY. Fictional preview accounts for trying the guest / student / landlord journeys.
export type DemoAccount = { key: 'student' | 'landlord' | 'both'; label: string; user: MockUser };

const base = { displayName: 'Ana Popescu', isDemo: true as const };

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: 'student',
    label: 'Student account',
    user: { ...base, id: 'demo-student', email: 'demo.student@example.com', profiles: { student: true, provider: null }, activeMode: 'student' },
  },
  {
    key: 'landlord',
    label: 'Landlord account',
    user: { ...base, id: 'demo-landlord', email: 'demo.landlord@example.com', profiles: { student: false, provider: { onboardingComplete: false } }, activeMode: 'provider' },
  },
  {
    key: 'both',
    label: 'Student + Landlord account',
    user: { ...base, id: 'demo-both', email: 'demo.both@example.com', profiles: { student: true, provider: { onboardingComplete: false } }, activeMode: 'student' },
  },
];

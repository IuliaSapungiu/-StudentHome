export type Mode = 'student' | 'provider';

/** What the user picked on the register screen. */
export type RegistrationIntent = 'student' | 'provider' | 'both';

/** Provider details (type, portfolio, ...) arrive with provider onboarding in a later step. */
export type ProviderProfile = { onboardingComplete: boolean };

/** A mock account kept on this device only. It never contains a password. */
export type MockUser = {
  id: string;
  email: string;
  displayName?: string;
  /** True for preview accounts created by the demo shortcuts (see src/demo). */
  isDemo?: boolean;
  profiles: { student: boolean; provider: ProviderProfile | null };
  activeMode: Mode;
};

export type SessionState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'signed_in'; user: MockUser };

export type SessionAction =
  | { type: 'guest' }
  | { type: 'signed_in'; user: MockUser };

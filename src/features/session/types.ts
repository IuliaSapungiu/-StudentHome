export type Mode = 'student' | 'provider';

/** What the user picked on the register screen. */
export type RegistrationIntent = 'student' | 'provider' | 'both';

/** Provider details (type, portfolio, ...) arrive with provider onboarding in a later step. */
export type ProviderProfile = { onboardingComplete: boolean };

/** A mock account kept on this device only. It never contains a password. */
export type MockUser = {
  id: string;
  email: string;
  /** Full name given at registration. Older accounts only have `displayName`. */
  fullName?: string;
  /** Legacy name field from earlier steps; read through fullNameOf(). */
  displayName?: string;
  /** E.164 phone number (format-checked only, never proof of ownership). null = not provided yet. */
  phone: string | null;
  /** When the Terms and Privacy Policy were accepted (ISO UTC), and which version. null = not recorded. */
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  /** True for preview accounts created by the demo shortcuts (see src/demo). */
  isDemo?: boolean;
  profiles: { student: boolean; provider: ProviderProfile | null };
  /** A local UI preference. Always resolved against the profiles the account really has. */
  activeMode: Mode;
};

export type SessionState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'signed_in'; user: MockUser };

export type SessionAction =
  | { type: 'guest' }
  | { type: 'signed_in'; user: MockUser };

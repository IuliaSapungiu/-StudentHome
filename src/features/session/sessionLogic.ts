import { newId } from '../../lib/id';
import type { MockUser, Mode, ProviderProfile, RegistrationIntent, SessionAction, SessionState } from './types';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const generateId = newId;

/** Version label recorded with terms acceptance. The real legal texts replace the demo placeholders later. */
export const TERMS_VERSION = 'demo-0';

export type NewUserDetails = {
  fullName?: string;
  phone?: string | null;
  termsAcceptedAt?: string | null;
  termsVersion?: string | null;
};

export function createUser(
  email: string,
  intent: RegistrationIntent,
  id: string = generateId(),
  details: NewUserDetails = {},
): MockUser {
  return {
    id,
    email: normalizeEmail(email),
    ...(details.fullName ? { fullName: details.fullName.trim() } : {}),
    phone: details.phone ?? null,
    termsAcceptedAt: details.termsAcceptedAt ?? null,
    termsVersion: details.termsVersion ?? null,
    profiles: {
      student: intent === 'student' || intent === 'both',
      provider: intent === 'provider' || intent === 'both' ? { onboardingComplete: false } : null,
    },
    // "Both" starts in student mode.
    activeMode: intent === 'provider' ? 'provider' : 'student',
  };
}

export const hasProviderProfile = (u: MockUser) => u.profiles.provider !== null;
export const canSwitchModes = (u: MockUser) => u.profiles.student && hasProviderProfile(u);

export function isModeAvailable(u: MockUser, mode: Mode): boolean {
  return mode === 'student' ? u.profiles.student : hasProviderProfile(u);
}

export function switchMode(u: MockUser, mode: Mode): MockUser {
  return isModeAvailable(u, mode) ? { ...u, activeMode: mode } : u;
}

/** Student-only accounts can add a provider profile. Provider onboarding comes in a later step. */
export function becomeProvider(u: MockUser): MockUser {
  const provider: ProviderProfile = u.profiles.provider ?? { onboardingComplete: false };
  return { ...u, profiles: { ...u.profiles, provider }, activeMode: 'provider' };
}

export type ModeAction =
  | { kind: 'switch'; to: Mode; label: string }
  | { kind: 'become_provider'; label: string };

/** Which mode button (if any) the profile screen shows. Provider-only accounts get none. */
export function getModeAction(u: MockUser, current: Mode): ModeAction | null {
  if (current === 'student') {
    return hasProviderProfile(u)
      ? { kind: 'switch', to: 'provider', label: 'Switch to landlord mode' }
      : { kind: 'become_provider', label: 'Become a landlord' };
  }
  return u.profiles.student ? { kind: 'switch', to: 'student', label: 'Switch to student mode' } : null;
}

export function homeRouteFor(mode: Mode) {
  return mode === 'provider' ? ('/(landlord)' as const) : ('/(student)' as const);
}

/** Full name, falling back to the legacy `displayName` of older accounts. */
export const fullNameOf = (u: MockUser): string | undefined => u.fullName?.trim() || u.displayName?.trim() || undefined;

const firstName = (u: MockUser) => fullNameOf(u)?.split(/\s+/)[0] ?? '';

/** The mode to use: the stored preference if the account has that profile, otherwise one it has. */
export function resolveActiveMode(u: Pick<MockUser, 'profiles' | 'activeMode'>): Mode {
  const has = (m: Mode) => (m === 'student' ? u.profiles.student : u.profiles.provider !== null);
  if (has(u.activeMode)) return u.activeMode;
  return u.profiles.student ? 'student' : 'provider';
}

/** Repairs a user's active mode. Safe to apply repeatedly. */
export const normalizeUser = (u: MockUser): MockUser =>
  resolveActiveMode(u) === u.activeMode ? u : { ...u, activeMode: resolveActiveMode(u) };

/** Guests: "Welcome to StudentHouse". Signed-in users: "Welcome back". */
export function greetingFor(user: MockUser | null): string {
  if (!user) return 'Welcome to StudentHouse';
  const name = firstName(user);
  return name ? `Welcome back, ${name}` : 'Welcome back';
}

export function initialsFor(u: MockUser): string {
  const words = fullNameOf(u)?.split(/\s+/).filter(Boolean) ?? [];
  if (words.length) return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return (u.email[0] ?? '?').toUpperCase();
}

/**
 * Validates and upgrades data read from storage. Accounts written by earlier steps (no phone,
 * terms or full name) are upgraded with null defaults. A stored activeMode that the account does
 * not actually have is repaired, not rejected. Only genuinely corrupt records return null.
 */
export function parseUser(value: unknown): MockUser | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const profiles = v.profiles as Record<string, unknown> | undefined;
  if (typeof v.id !== 'string' || typeof v.email !== 'string' || !profiles) return null;
  if (typeof profiles.student !== 'boolean') return null;
  const provider = profiles.provider;
  if (provider !== null && (typeof provider !== 'object' || typeof (provider as ProviderProfile).onboardingComplete !== 'boolean')) {
    return null;
  }
  if (!profiles.student && provider === null) return null; // an account must have at least one profile
  const str = (x: unknown) => (typeof x === 'string' ? x : null);
  const user: MockUser = {
    id: v.id,
    email: v.email,
    ...(typeof v.fullName === 'string' ? { fullName: v.fullName } : {}),
    ...(typeof v.displayName === 'string' ? { displayName: v.displayName } : {}),
    ...(v.isDemo === true ? { isDemo: true } : {}),
    phone: str(v.phone),
    termsAcceptedAt: str(v.termsAcceptedAt),
    termsVersion: str(v.termsVersion),
    profiles: { student: profiles.student, provider: provider as ProviderProfile | null },
    activeMode: v.activeMode === 'student' || v.activeMode === 'provider' ? v.activeMode : 'student',
  };
  return normalizeUser(user);
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'guest':
      return { status: 'guest' };
    case 'signed_in':
      return { status: 'signed_in', user: action.user };
  }
}

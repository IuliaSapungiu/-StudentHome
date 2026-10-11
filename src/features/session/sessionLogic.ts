import type { MockUser, Mode, ProviderProfile, RegistrationIntent, SessionAction, SessionState } from './types';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const generateId = () => `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function createUser(email: string, intent: RegistrationIntent, id: string = generateId()): MockUser {
  return {
    id,
    email: normalizeEmail(email),
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

const firstName = (u: MockUser) => u.displayName?.trim().split(/\s+/)[0] ?? '';

/** Guests: "Welcome to StudentHouse". Signed-in users: "Welcome back". */
export function greetingFor(user: MockUser | null): string {
  if (!user) return 'Welcome to StudentHouse';
  const name = firstName(user);
  return name ? `Welcome back, ${name}` : 'Welcome back';
}

export function initialsFor(u: MockUser): string {
  const words = u.displayName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length) return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return (u.email[0] ?? '?').toUpperCase();
}

/** Validates data read from storage. Anything unexpected is rejected rather than trusted. */
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
  if (v.activeMode !== 'student' && v.activeMode !== 'provider') return null;
  const user: MockUser = {
    id: v.id,
    email: v.email,
    ...(typeof v.displayName === 'string' ? { displayName: v.displayName } : {}),
    ...(v.isDemo === true ? { isDemo: true } : {}),
    profiles: { student: profiles.student, provider: provider as ProviderProfile | null },
    activeMode: v.activeMode,
  };
  // A user must have at least one profile, and the active mode must exist.
  if (!user.profiles.student && !user.profiles.provider) return null;
  return isModeAvailable(user, user.activeMode) ? user : null;
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'guest':
      return { status: 'guest' };
    case 'signed_in':
      return { status: 'signed_in', user: action.user };
  }
}

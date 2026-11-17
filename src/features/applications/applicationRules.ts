import { parseLocalDateTime } from '../../lib/dateTime';
import { dateRange } from '../../lib/dateRange';
import type { ApplicationHistoryEntry, ApplicationInput, ApplicationStatus, OwnerApplicationCommand, RentalApplication, StudentApplicationCommand, StudyStatus } from './types';

export const LEASE_MONTH_OPTIONS = [3, 6, 9, 12, 24] as const;
export const LEASE_MONTHS_RANGE = { min: 1, max: 36 } as const;
export const OCCUPANTS_RANGE = { min: 1, max: 6 } as const;
export const UNIVERSITY_LENGTH = { min: 2, max: 100 } as const;
export const MESSAGE_MAX_LENGTH = 1000;

export const STUDY_STATUS_LABEL: Record<StudyStatus, string> = {
  bachelor: 'Bachelor’s', master: 'Master’s', phd: 'PhD', exchange: 'Exchange student', other: 'Other',
};

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  submitted: 'Submitted', under_review: 'Under review', accepted: 'Accepted', rejected: 'Rejected', withdrawn: 'Withdrawn',
};

/** Shown on the form, the confirmation screen and the details screen. */
export const APPLICATION_NOTICE = [
  'An application tells the landlord you are interested. It is not a booking.',
  'If the landlord accepts, it only means they are interested in going ahead with you.',
  'It does not reserve the home or hold a room, create a contract, require payment or guarantee a rental.',
  'The home stays available to others, and you can apply to other homes too.',
];

export type FieldErrors = Partial<Record<'preferredMoveIn' | 'leaseMonths' | 'occupants' | 'university' | 'studyStatus' | 'message' | 'consent', string>>;
export type Validated = { ok: true; value: Omit<ApplicationInput, 'origin' | 'studyStatus'> & { studyStatus: StudyStatus; message: string | null; university: string } } | { ok: false; fields: FieldErrors };

/** `todayIso` is today's local date as YYYY-MM-DD. */
export function validateApplication(input: ApplicationInput, todayIso: string): Validated {
  const fields: FieldErrors = {};
  const university = input.university.trim();
  const message = (input.message ?? '').trim();

  if (!parseLocalDateTime(`${input.preferredMoveIn}T00:00`)) fields.preferredMoveIn = 'Choose your preferred move-in date.';
  else if (input.preferredMoveIn < todayIso) fields.preferredMoveIn = 'The move-in date cannot be in the past.';
  else if (input.preferredMoveIn > dateRange(todayIso).max) fields.preferredMoveIn = 'Choose a date within the next two years.';

  if (!Number.isInteger(input.leaseMonths) || input.leaseMonths < LEASE_MONTHS_RANGE.min || input.leaseMonths > LEASE_MONTHS_RANGE.max) fields.leaseMonths = 'Choose a lease length.';
  if (!Number.isInteger(input.occupants) || input.occupants < OCCUPANTS_RANGE.min || input.occupants > OCCUPANTS_RANGE.max) fields.occupants = `Occupants must be between ${OCCUPANTS_RANGE.min} and ${OCCUPANTS_RANGE.max}.`;
  if (university.length < UNIVERSITY_LENGTH.min) fields.university = 'Enter your university.';
  else if (university.length > UNIVERSITY_LENGTH.max) fields.university = `Keep this under ${UNIVERSITY_LENGTH.max} characters.`;
  if (!input.studyStatus || !STUDY_STATUS_LABEL[input.studyStatus]) fields.studyStatus = 'Choose your study status.';
  if (message.length > MESSAGE_MAX_LENGTH) fields.message = `Keep the message under ${MESSAGE_MAX_LENGTH} characters.`;
  if (!input.consent) fields.consent = 'Please agree to share your details with the landlord.';

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, value: { propertyId: input.propertyId, preferredMoveIn: input.preferredMoveIn, leaseMonths: input.leaseMonths, occupants: input.occupants, university, studyStatus: input.studyStatus as StudyStatus, message: message || null, consent: true } };
}

/** Still in play: submitted, under review or accepted. */
export const isActiveApplication = (a: RentalApplication): boolean => a.status === 'submitted' || a.status === 'under_review' || a.status === 'accepted';

/** Reuses the common answers from the student's most recent application so they need not retype them. */
export function applicationDefaults(previous: RentalApplication[]): Pick<ApplicationInput, 'university' | 'studyStatus' | 'occupants' | 'leaseMonths'> | null {
  const latest = [...previous].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  return latest ? { university: latest.university, studyStatus: latest.studyStatus, occupants: latest.occupants, leaseMonths: latest.leaseMonths } : null;
}

type Context = { actorId: string; nowIso: string; simulated: boolean };
export type TransitionResult = { ok: true; value: RentalApplication } | { ok: false; message: string };

const move = (a: RentalApplication, status: ApplicationStatus, role: 'student' | 'owner', c: Context): TransitionResult => {
  const entry: ApplicationHistoryEntry = { id: `${a.id}:s${a.history.length + 1}`, status, at: c.nowIso, actorId: c.actorId, actorRole: role, simulated: role === 'owner' && c.simulated };
  return { ok: true, value: { ...a, status, updatedAt: c.nowIso, history: [...a.history, entry] } };
};

export function applyStudentCommand(a: RentalApplication, cmd: StudentApplicationCommand, c: Context): TransitionResult {
  if (cmd.type === 'withdraw') {
    return isActiveApplication(a) ? move(a, 'withdrawn', 'student', c) : { ok: false, message: 'This application can no longer be withdrawn.' };
  }
  return { ok: false, message: 'Unknown action.' };
}

/** Landlord side. Nothing here ever touches the listing: accepting never reduces availability or books anything. */
export function applyOwnerCommand(a: RentalApplication, cmd: OwnerApplicationCommand, c: Context): TransitionResult {
  const open = a.status === 'submitted' || a.status === 'under_review';
  switch (cmd.type) {
    case 'start_review':
      return a.status === 'submitted' ? move(a, 'under_review', 'owner', c) : { ok: false, message: 'Only a submitted application can be put under review.' };
    case 'accept':
      return open ? move(a, 'accepted', 'owner', c) : { ok: false, message: 'This application can no longer be accepted.' };
    case 'reject':
      return open ? move(a, 'rejected', 'owner', c) : { ok: false, message: 'This application can no longer be rejected.' };
  }
}

/**
 * How the Applications list groups them. Purely presentational: it changes no status and no workflow.
 * Active = still waiting on the landlord (submitted, under review). Completed = an outcome was reached (accepted,
 * rejected) or the student withdrew.
 */
export type ApplicationGroup = 'active' | 'completed';
export const applicationGroup = (status: ApplicationStatus): ApplicationGroup => (status === 'submitted' || status === 'under_review' ? 'active' : 'completed');

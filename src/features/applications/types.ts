import type { Attribution } from '../shared/attribution';

/**
 * A rental application is a structured EXPRESSION OF INTEREST, not a booking or a rental. Accepting one only
 * means the landlord is interested in going ahead: it reserves nothing, holds no room, creates no contract,
 * takes no payment and never changes a listing's availability.
 */
export type ApplicationStatus = 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'withdrawn';
export const APPLICATION_STATUSES: ApplicationStatus[] = ['submitted', 'under_review', 'accepted', 'rejected', 'withdrawn'];

export type StudyStatus = 'bachelor' | 'master' | 'phd' | 'exchange' | 'other';
export const STUDY_STATUSES: StudyStatus[] = ['bachelor', 'master', 'phd', 'exchange', 'other'];

export type ApplicationHistoryEntry = {
  /** Stable id: `<applicationId>:s<n>`. Used to avoid duplicate notifications. */
  id: string;
  status: ApplicationStatus;
  at: string; // ISO UTC
  actorId: string;
  actorRole: 'student' | 'owner';
  /** True when a demo responder acted as the landlord. Never real landlord behaviour. */
  simulated: boolean;
};

export type RentalApplication = Attribution & {
  id: string;
  propertyId: string;
  studentId: string;
  /** The provider account that owns the property (copied from the property at submission). */
  ownerId: string;
  // What the landlord receives, copied at submission so later profile edits do not rewrite history.
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  preferredMoveIn: string; // YYYY-MM-DD
  leaseMonths: number;
  occupants: number;
  university: string;
  studyStatus: StudyStatus;
  message: string | null;
  /** When the student ticked the consent to share these details with this landlord. */
  consentAcceptedAt: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  history: ApplicationHistoryEntry[];
};

/** What the student fills in. Name, email and phone come from the verified account, not from the form. */
export type ApplicationInput = {
  propertyId: string;
  preferredMoveIn: string;
  leaseMonths: number;
  occupants: number;
  university: string;
  studyStatus: StudyStatus | null;
  message: string | null;
  consent: boolean;
  origin?: Attribution['origin'];
};

export type StudentApplicationCommand = { type: 'withdraw' };
export type OwnerApplicationCommand = { type: 'start_review' } | { type: 'accept' } | { type: 'reject' };

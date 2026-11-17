import type { Attribution } from '../shared/attribution';
import type { LocalDateTime } from '../../lib/dateTime';

export type ViewingStatus = 'pending' | 'alternative_proposed' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
export const VIEWING_STATUSES: ViewingStatus[] = ['pending', 'alternative_proposed', 'confirmed', 'declined', 'cancelled', 'completed'];

/** What happened. Also the kind of status card posted into a related conversation. */
export type ViewingEventCode =
  | 'requested'
  | 'rescheduled'
  | 'alternative_proposed'
  | 'alternative_accepted'
  | 'alternative_rejected'
  | 'confirmed'
  | 'declined'
  | 'cancelled'
  | 'completed';
export const VIEWING_EVENT_CODES: ViewingEventCode[] = ['requested', 'rescheduled', 'alternative_proposed', 'alternative_accepted', 'alternative_rejected', 'confirmed', 'declined', 'cancelled', 'completed'];

/**
 * Every date-time ever put forward for this viewing, in order. A proposal is NEVER removed or edited: it is
 * only given an outcome once. The original request and every alternative therefore stay visible.
 *  - request:     the student's first requested time
 *  - reschedule:  a new time the student asked for later
 *  - alternative: a time the landlord suggested
 *  - retained:    the student turned down an alternative, so their last own time is open again
 */
export type ProposalKind = 'request' | 'reschedule' | 'alternative' | 'retained';
/** active = waiting for an answer; accepted = agreed; rejected = turned down; superseded = replaced by a newer proposal; withdrawn = taken back (request cancelled) */
export type ProposalOutcome = 'active' | 'accepted' | 'rejected' | 'superseded' | 'withdrawn';
export const PROPOSAL_KINDS: ProposalKind[] = ['request', 'reschedule', 'alternative', 'retained'];
export const PROPOSAL_OUTCOMES: ProposalOutcome[] = ['active', 'accepted', 'rejected', 'superseded', 'withdrawn'];

export type ViewingProposal = {
  id: string;
  /** The exact date and time, minutes included. A preference, never verified landlord availability. */
  start: LocalDateTime;
  proposedBy: 'student' | 'owner';
  kind: ProposalKind;
  proposedAt: string; // ISO UTC
  outcome: ProposalOutcome;
  resolvedAt: string | null;
  resolvedBy: 'student' | 'owner' | null;
  /** True when a demo responder acted as the landlord. Never real landlord behaviour. */
  simulated: boolean;
};

/** One row of the append-only event log (a future `viewing_request_events` table). */
export type ViewingHistoryEntry = {
  /** Stable id: `<viewingId>:e<n>`. Used to avoid duplicate cards and notifications. */
  id: string;
  event: ViewingEventCode;
  status: ViewingStatus;
  at: string; // ISO UTC
  actorId: string;
  actorRole: 'student' | 'owner';
  /** The date-time the event is about, when it has one. A snapshot: it never changes afterwards. */
  start: LocalDateTime | null;
  /**
   * The other time involved, so each event tells its own story: the time an alternative or a new request REPLACES,
   * or (for a rejected alternative) the student's own time that is open again. Null when there is none.
   */
  relatedStart: LocalDateTime | null;
  proposalId: string | null;
  simulated: boolean;
};

/**
 * A FORMAL viewing request. Arranging a viewing by chatting in Messages is separate and creates none of this.
 * The exact address is deliberately NOT part of this record; it is looked up only once the viewing is confirmed.
 */
export type ViewingRequest = Attribution & {
  id: string;
  propertyId: string;
  studentId: string;
  /** The provider account that owns the property (copied from the property when requested). */
  ownerId: string;
  status: ViewingStatus;
  /** The proposal that defines the viewing right now (waiting for an answer, or the agreed one). */
  currentProposalId: string;
  proposals: ViewingProposal[];
  studentNote: string | null;
  createdAt: string;
  updatedAt: string;
  history: ViewingHistoryEntry[];
};

export type ViewingTab = 'upcoming' | 'pending' | 'past';

/** Actions the student can take. */
export type StudentViewingCommand =
  | { type: 'cancel' }
  | { type: 'reschedule'; start: LocalDateTime }
  | { type: 'accept_alternative' }
  | { type: 'reject_alternative' };

/** Actions a landlord can take (no landlord screens yet; the demo responder uses them). */
export type OwnerViewingCommand =
  | { type: 'confirm' }
  | { type: 'decline' }
  | { type: 'propose_alternative'; start: LocalDateTime }
  | { type: 'complete' };

import type { ContactOrigin } from '../shared/attribution';
import type { RepoResult } from '../shared/result';
import type { LocalDateTime } from '../../lib/dateTime';
import type { OwnerViewingCommand, ViewingRequest } from './types';

/**
 * FORMAL viewing requests, shared by both sides: the student's list and (Step 7) the landlord's list read the
 * same rows. Requesting or rescheduling needs a verified email and (first time) a verified phone; that is
 * checked HERE, not only in the UI. Arranging a viewing by chatting in Messages never touches this.
 * Supabase: `viewing_requests` + `viewing_time_proposals` + `viewing_request_events`, RLS "student or owner only", and the exact address
 * served by a function that returns it only while status = 'confirmed'.
 */
export interface ViewingRepository {
  listForStudent(studentId: string): Promise<ViewingRequest[]>;
  /** For the future landlord side. */
  listForOwner(ownerId: string): Promise<ViewingRequest[]>;
  getById(id: string, userId: string): Promise<RepoResult<ViewingRequest>>;

  requestViewing(input: { studentId: string; propertyId: string; start: LocalDateTime; note?: string | null; origin?: ContactOrigin }): Promise<RepoResult<ViewingRequest>>;
  cancel(id: string, studentId: string): Promise<RepoResult<ViewingRequest>>;
  /** The student asks for a different time: the request goes back to pending. */
  reschedule(id: string, studentId: string, start: LocalDateTime): Promise<RepoResult<ViewingRequest>>;
  /** The student explicitly accepts the landlord's proposed time; only then is the viewing confirmed. */
  acceptAlternative(id: string, studentId: string): Promise<RepoResult<ViewingRequest>>;
  /** The student turns the landlord's proposed time down; their own earlier time is open again (history is kept). */
  rejectAlternative(id: string, studentId: string): Promise<RepoResult<ViewingRequest>>;

  /** Landlord actions (no landlord screens yet; a clearly labelled demo responder calls these). */
  respond(id: string, ownerId: string, command: OwnerViewingCommand): Promise<RepoResult<ViewingRequest>>;

  /** The exact address, only for the student or owner of a CONFIRMED viewing; otherwise null. */
  getConfirmedAddress(id: string, userId: string): Promise<string | null>;
}

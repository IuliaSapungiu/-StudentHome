import type { RepoResult } from '../shared/result';
import type { ApplicationInput, OwnerApplicationCommand, RentalApplication } from './types';

/**
 * Rental applications, shared by both sides (student list now, landlord list in Step 7). Available on every
 * plan tier. Submitting needs a verified email and (first time) a verified phone, checked HERE as well as in
 * the UI. Nothing here changes a listing: accepting an application never reduces availability or creates a booking.
 * Supabase: `rental_applications` + `rental_application_events`, RLS "student or owner only".
 */
export interface ApplicationRepository {
  listForStudent(studentId: string): Promise<RentalApplication[]>;
  /** For the future landlord side. */
  listForOwner(ownerId: string): Promise<RentalApplication[]>;
  getById(id: string, userId: string): Promise<RepoResult<RentalApplication>>;
  submit(studentId: string, input: ApplicationInput): Promise<RepoResult<RentalApplication>>;
  withdraw(id: string, studentId: string): Promise<RepoResult<RentalApplication>>;
  /** Landlord actions (no landlord screens yet; a clearly labelled demo responder calls these). */
  respond(id: string, ownerId: string, command: OwnerApplicationCommand): Promise<RepoResult<RentalApplication>>;
}

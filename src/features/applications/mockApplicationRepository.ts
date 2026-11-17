import type { MockStorage } from '../../storage/keyValue';
import type { PropertyRepository } from '../../data/repository';
import { newId as defaultNewId } from '../../lib/id';
import { localDate } from '../../lib/dateTime';
import { createCollectionStore, type CollectionStore } from '../shared/collectionStore';
import { CONTACT_ORIGINS } from '../shared/attribution';
import { asInt, asIsoTimestamp, asString, asStringOrNull, isRecord, oneOf } from '../shared/parse';
import { fail, ok, type RepoResult } from '../shared/result';
import type { MockUser } from '../session/types';
import { fullNameOf } from '../session/sessionLogic';
import type { AccessChecker } from '../verification/accessChecker';
import { applicationNotification } from '../notifications/notificationLogic';
import type { NotificationSink } from '../notifications/notificationRepository';
import { applyOwnerCommand, applyStudentCommand, isActiveApplication, validateApplication, type TransitionResult } from './applicationRules';
import type { ApplicationRepository } from './applicationRepository';
import { APPLICATION_STATUSES, STUDY_STATUSES, type ApplicationHistoryEntry, type RentalApplication } from './types';

export type ApplicationStore = CollectionStore<RentalApplication>;

const parseHistory = (raw: unknown, index: number, applicationId: string | null): ApplicationHistoryEntry | null => {
  if (!isRecord(raw)) return null;
  const status = oneOf(APPLICATION_STATUSES, raw.status), at = asIsoTimestamp(raw.at), actorId = asString(raw.actorId), actorRole = oneOf(['student', 'owner'] as const, raw.actorRole);
  return status && at && actorId && actorRole ? { id: asString(raw.id) ?? `${applicationId}:s${index + 1}`, status, at, actorId, actorRole, simulated: raw.simulated === true } : null;
};

const parseApplication = (raw: unknown): RentalApplication | null => {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id), propertyId = asString(raw.propertyId), studentId = asString(raw.studentId), ownerId = asString(raw.ownerId);
  const applicantName = asString(raw.applicantName), applicantEmail = asString(raw.applicantEmail), applicantPhone = asString(raw.applicantPhone);
  const preferredMoveIn = asString(raw.preferredMoveIn), university = asString(raw.university);
  const leaseMonths = asInt(raw.leaseMonths), occupants = asInt(raw.occupants);
  const studyStatus = oneOf(STUDY_STATUSES, raw.studyStatus), status = oneOf(APPLICATION_STATUSES, raw.status);
  const consentAcceptedAt = asIsoTimestamp(raw.consentAcceptedAt), createdAt = asIsoTimestamp(raw.createdAt), updatedAt = asIsoTimestamp(raw.updatedAt);
  if (!id || !propertyId || !studentId || !ownerId || !applicantName || !applicantEmail || !applicantPhone || !preferredMoveIn || !university) return null;
  if (leaseMonths === null || occupants === null || !studyStatus || !status || !consentAcceptedAt || !createdAt || !updatedAt) return null;
  return {
    id, propertyId, studentId, ownerId, applicantName, applicantEmail, applicantPhone, preferredMoveIn, leaseMonths, occupants, university, studyStatus, status, consentAcceptedAt, createdAt, updatedAt,
    message: asStringOrNull(raw.message),
    origin: oneOf(CONTACT_ORIGINS, raw.origin) ?? 'other',
    listingPlanId: (asStringOrNull(raw.listingPlanId) as RentalApplication['listingPlanId']) ?? null,
    history: Array.isArray(raw.history) ? raw.history.map((h, i) => parseHistory(h, i, id)).filter((h): h is ApplicationHistoryEntry => h !== null) : [],
  };
};

export const createApplicationStore = (storage: MockStorage): ApplicationStore => createCollectionStore(storage, 'applications', parseApplication);

type Deps = {
  store: ApplicationStore;
  properties: Pick<PropertyRepository, 'getById'>;
  access: AccessChecker;
  getUser: (userId: string) => Promise<MockUser | null>;
  /** Where landlord decisions are announced to the student (in-app only). */
  notifications: NotificationSink;
  now?: () => Date;
  newId?: () => string;
  /** True while landlords are not real accounts: owner actions are demo responses and are marked simulated. */
  ownerActionsSimulated?: boolean;
};

export function createMockApplicationRepository(deps: Deps): ApplicationRepository {
  const { store, properties, access, getUser, notifications } = deps;
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? defaultNewId;
  const ownerSimulated = deps.ownerActionsSimulated ?? true;

  async function transition(id: string, actorId: string, role: 'student' | 'owner', run: (a: RentalApplication, c: { actorId: string; nowIso: string; simulated: boolean }) => TransitionResult): Promise<RepoResult<RentalApplication>> {
    return store.update<RepoResult<RentalApplication>>((rows) => {
      const current = rows.find((a) => a.id === id);
      const mine = current && (role === 'student' ? current.studentId === actorId : current.ownerId === actorId);
      if (!current || !mine) return { rows, result: fail('not_found', 'This application is not available.') };
      const r = run(current, { actorId, nowIso: now().toISOString(), simulated: ownerSimulated });
      if (!r.ok) return { rows, result: fail('conflict', r.message) };
      return { rows: rows.map((a) => (a.id === id ? r.value : a)), result: ok(r.value) };
    });
  }

  return {
    async listForStudent(studentId) {
      return (await store.all()).filter((a) => a.studentId === studentId);
    },
    async listForOwner(ownerId) {
      return (await store.all()).filter((a) => a.ownerId === ownerId);
    },
    async getById(id, userId) {
      const a = (await store.all()).find((x) => x.id === id);
      return a && (a.studentId === userId || a.ownerId === userId) ? ok(a) : fail('not_found', 'This application is not available.');
    },

    async submit(studentId, input) {
      const decision = await access(studentId, 'rental_application');
      if (!decision.allowed) return fail('not_allowed', 'Verify your details to apply.', { access: decision });
      const user = await getUser(studentId);
      const name = user ? fullNameOf(user) : undefined;
      if (!user || !name || !user.phone) return fail('invalid', 'Add your full name and phone number to your profile first.');
      const checked = validateApplication(input, localDate(now()));
      if (!checked.ok) return fail('invalid', 'Please check the highlighted fields.', { fields: checked.fields });
      const property = await properties.getById(input.propertyId);
      if (!property) return fail('unavailable', 'This home is no longer listed.');
      if (property.ownerId === studentId) return fail('forbidden', 'You cannot apply to your own listing.');

      const nowIso = now().toISOString();
      const created = await store.update<RentalApplication | null>((rows) => {
        if (rows.some((a) => a.studentId === studentId && a.propertyId === property.id && isActiveApplication(a))) return { rows, result: null };
        const applicationId = newId();
        const a: RentalApplication = {
          id: applicationId, propertyId: property.id, studentId, ownerId: property.ownerId,
          applicantName: name, applicantEmail: user.email, applicantPhone: user.phone as string,
          preferredMoveIn: checked.value.preferredMoveIn, leaseMonths: checked.value.leaseMonths, occupants: checked.value.occupants,
          university: checked.value.university, studyStatus: checked.value.studyStatus, message: checked.value.message,
          consentAcceptedAt: nowIso, status: 'submitted', createdAt: nowIso, updatedAt: nowIso,
          origin: input.origin ?? 'property_detail', listingPlanId: property.planId,
          history: [{ id: `${applicationId}:s1`, status: 'submitted', at: nowIso, actorId: studentId, actorRole: 'student', simulated: false }],
        };
        return { rows: [...rows, a], result: a };
      });
      return created ? ok(created) : fail('conflict', 'You already have an open application for this home.');
    },

    withdraw: (id, studentId) => transition(id, studentId, 'student', (a, c) => applyStudentCommand(a, { type: 'withdraw' }, c)),
    async respond(id, ownerId, command) {
      const result = await transition(id, ownerId, 'owner', (a, c) => applyOwnerCommand(a, command, c));
      if (result.ok) {
        const entry = result.value.history[result.value.history.length - 1];
        const title = (await properties.getById(result.value.propertyId))?.title ?? 'a home';
        const n = applicationNotification(result.value, entry, title);
        if (n) await notifications.record(n); // idempotent: the same status change never notifies twice
      }
      return result;
    },
  };
}

import type { MockStorage } from '../../storage/keyValue';
import type { PropertyRepository } from '../../data/repository';
import { newId as defaultNewId } from '../../lib/id';
import { isLocalDateTime, toLocalDateTime, type LocalDateTime } from '../../lib/dateTime';
import { createCollectionStore, type CollectionStore } from '../shared/collectionStore';
import { CONTACT_ORIGINS } from '../shared/attribution';
import { asIsoTimestamp, asString, asStringOrNull, isRecord, oneOf } from '../shared/parse';
import { fail, ok, type RepoResult } from '../shared/result';
import type { AccessChecker } from '../verification/accessChecker';
import type { ViewingEventSink } from '../messaging/conversationRepository';
import { viewingNotification } from '../notifications/notificationLogic';
import type { NotificationSink } from '../notifications/notificationRepository';
import { applyOwnerCommand, applyStudentCommand, canRevealAddress, createViewing, isActive, validateNote, validateViewingTime, type TransitionResult } from './viewingRules';
import type { ViewingRepository } from './viewingRepository';
import {
  PROPOSAL_KINDS, PROPOSAL_OUTCOMES, VIEWING_EVENT_CODES, VIEWING_STATUSES,
  type ProposalOutcome, type StudentViewingCommand, type ViewingEventCode, type ViewingHistoryEntry, type ViewingProposal, type ViewingRequest, type ViewingStatus,
} from './types';

export type ViewingStore = CollectionStore<ViewingRequest>;

const localOrNull = (v: unknown): LocalDateTime | null => (isLocalDateTime(v) ? v : null);

const parseHistory = (raw: unknown, index: number, viewingId: string): ViewingHistoryEntry | null => {
  if (!isRecord(raw)) return null;
  const event = oneOf(VIEWING_EVENT_CODES, raw.event), status = oneOf(VIEWING_STATUSES, raw.status), at = asIsoTimestamp(raw.at), actorId = asString(raw.actorId), actorRole = oneOf(['student', 'owner'] as const, raw.actorRole);
  if (!event || !status || !at || !actorId || !actorRole) return null;
  return { id: asString(raw.id) ?? `${viewingId}:e${index + 1}`, event, status, at, actorId, actorRole, start: localOrNull(raw.start), relatedStart: localOrNull(raw.relatedStart), proposalId: asStringOrNull(raw.proposalId), simulated: raw.simulated === true };
};

const parseProposal = (raw: unknown): ViewingProposal | null => {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id), start = localOrNull(raw.start), proposedBy = oneOf(['student', 'owner'] as const, raw.proposedBy), kind = oneOf(PROPOSAL_KINDS, raw.kind);
  const proposedAt = asIsoTimestamp(raw.proposedAt), outcome = oneOf(PROPOSAL_OUTCOMES, raw.outcome);
  if (!id || !start || !proposedBy || !kind || !proposedAt || !outcome) return null;
  return { id, start, proposedBy, kind, proposedAt, outcome, resolvedAt: asIsoTimestamp(raw.resolvedAt), resolvedBy: oneOf(['student', 'owner'] as const, raw.resolvedBy), simulated: raw.simulated === true };
};

/**
 * Records saved by the first Step 3c build kept three loose times (requested / proposed / confirmed) instead of a
 * list of proposals. They are converted once, on read, so nothing a tester already saved is lost.
 */
function migrateLegacyProposals(raw: Record<string, unknown>, id: string, status: ViewingStatus, createdAt: string): { proposals: ViewingProposal[]; currentProposalId: string } | null {
  const requested = localOrNull(raw.requestedStart);
  if (!requested) return null;
  const proposed = localOrNull(raw.proposedStart), confirmed = localOrNull(raw.confirmedStart);
  const mk = (n: number, start: LocalDateTime, by: 'student' | 'owner', outcome: ProposalOutcome): ViewingProposal => ({
    id: `${id}:p${n}`, start, proposedBy: by, kind: by === 'student' ? 'request' : 'alternative', proposedAt: createdAt, outcome, resolvedAt: outcome === 'active' ? null : createdAt, resolvedBy: null, simulated: false,
  });
  const first = (outcome: ProposalOutcome) => mk(1, requested, 'student', outcome);
  if (status === 'alternative_proposed' && proposed) return { proposals: [first('superseded'), mk(2, proposed, 'owner', 'active')], currentProposalId: `${id}:p2` };
  if ((status === 'confirmed' || status === 'completed') && confirmed && confirmed !== requested) return { proposals: [first('superseded'), mk(2, confirmed, 'owner', 'accepted')], currentProposalId: `${id}:p2` };
  const outcome: ProposalOutcome = status === 'pending' ? 'active' : status === 'declined' ? 'rejected' : status === 'cancelled' ? 'withdrawn' : 'accepted';
  return { proposals: [first(outcome)], currentProposalId: `${id}:p1` };
}

const parseViewing = (raw: unknown): ViewingRequest | null => {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id), propertyId = asString(raw.propertyId), studentId = asString(raw.studentId), ownerId = asString(raw.ownerId);
  const status = oneOf(VIEWING_STATUSES, raw.status), createdAt = asIsoTimestamp(raw.createdAt), updatedAt = asIsoTimestamp(raw.updatedAt);
  if (!id || !propertyId || !studentId || !ownerId || !status || !createdAt || !updatedAt) return null;

  let proposals = Array.isArray(raw.proposals) ? raw.proposals.map(parseProposal).filter((p): p is ViewingProposal => p !== null) : [];
  let currentProposalId = asString(raw.currentProposalId) ?? '';
  if (proposals.length === 0) {
    const migrated = migrateLegacyProposals(raw, id, status, createdAt);
    if (!migrated) return null;
    proposals = migrated.proposals;
    currentProposalId = migrated.currentProposalId;
  }
  if (!proposals.some((p) => p.id === currentProposalId)) currentProposalId = proposals[proposals.length - 1].id;

  return {
    id, propertyId, studentId, ownerId, status, createdAt, updatedAt, proposals, currentProposalId,
    studentNote: asStringOrNull(raw.studentNote),
    origin: oneOf(CONTACT_ORIGINS, raw.origin) ?? 'other',
    listingPlanId: (asStringOrNull(raw.listingPlanId) as ViewingRequest['listingPlanId']) ?? null,
    history: Array.isArray(raw.history) ? raw.history.map((h, i) => parseHistory(h, i, id)).filter((h): h is ViewingHistoryEntry => h !== null) : [],
  };
};

export const createViewingStore = (storage: MockStorage): ViewingStore => createCollectionStore(storage, 'viewings', parseViewing);

/** Only landlord-initiated events may create a conversation. A student's own request never does. */
const CREATES_CONVERSATION: ViewingEventCode[] = ['confirmed', 'alternative_proposed'];

type Deps = {
  store: ViewingStore;
  properties: Pick<PropertyRepository, 'getById'>;
  access: AccessChecker;
  /** Records each event in the student's conversation for the same home (creating it for landlord-initiated events). */
  events: ViewingEventSink;
  /** Tells the student about landlord actions (in-app only). */
  notifications: NotificationSink;
  /** Exact addresses, kept apart from public listing data. Only ever returned for confirmed viewings. */
  addresses: (propertyId: string) => string | null;
  now?: () => Date;
  newId?: () => string;
  /** True while landlords are not real accounts: owner actions are demo responses and are marked simulated. */
  ownerActionsSimulated?: boolean;
};

export function createMockViewingRepository(deps: Deps): ViewingRepository {
  const { store, properties, access, events, notifications, addresses } = deps;
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? defaultNewId;
  const ownerSimulated = deps.ownerActionsSimulated ?? true;
  const ctx = (actorId: string, simulated: boolean) => ({ actorId, nowIso: now().toISOString(), nowLocal: toLocalDateTime(now()), simulated });

  const get = async (id: string) => (await store.all()).find((v) => v.id === id) ?? null;

  /** After a saved change: record the event in the conversation, and tell the student about landlord actions. */
  async function announce(v: ViewingRequest, entry: ViewingHistoryEntry) {
    await events.recordViewingEvent({
      studentId: v.studentId, ownerId: v.ownerId, propertyId: v.propertyId, listingPlanId: v.listingPlanId, viewingRequestId: v.id,
      eventId: entry.id, eventStart: entry.start, relatedStart: entry.relatedStart, status: entry.status, actorId: entry.actorId, code: entry.event, simulated: entry.simulated,
      createIfMissing: entry.actorRole === 'owner' && CREATES_CONVERSATION.includes(entry.event),
    });
    if (entry.actorRole === 'owner') {
      const title = (await properties.getById(v.propertyId))?.title ?? 'a home';
      const n = viewingNotification(v, entry, title);
      if (n) await notifications.record(n); // idempotent per event
    }
  }

  async function transition(id: string, actorId: string, role: 'student' | 'owner', run: (v: ViewingRequest) => TransitionResult): Promise<RepoResult<ViewingRequest>> {
    type Outcome = { failed: RepoResult<ViewingRequest> } | { value: ViewingRequest; entry: ViewingHistoryEntry };
    const outcome = await store.update<Outcome>((rows) => {
      const current = rows.find((v) => v.id === id);
      const mine = current && (role === 'student' ? current.studentId === actorId : current.ownerId === actorId);
      if (!current || !mine) return { rows, result: { failed: fail('not_found', 'This viewing is not available.') } };
      const r = run(current);
      if (!r.ok) return { rows, result: { failed: fail('conflict', r.message) } };
      return { rows: rows.map((v) => (v.id === id ? r.value : v)), result: { value: r.value, entry: r.entry } };
    });
    if ('failed' in outcome) return outcome.failed;
    await announce(outcome.value, outcome.entry);
    return ok(outcome.value);
  }

  const studentCommand = async (id: string, studentId: string, cmd: StudentViewingCommand) =>
    transition(id, studentId, 'student', (v) => applyStudentCommand(v, cmd, ctx(studentId, false)));

  return {
    async listForStudent(studentId) {
      return (await store.all()).filter((v) => v.studentId === studentId);
    },
    async listForOwner(ownerId) {
      return (await store.all()).filter((v) => v.ownerId === ownerId);
    },
    async getById(id, userId) {
      const v = await get(id);
      return v && (v.studentId === userId || v.ownerId === userId) ? ok(v) : fail('not_found', 'This viewing is not available.');
    },

    async requestViewing({ studentId, propertyId, start, note, origin = 'property_detail' }) {
      const decision = await access(studentId, 'request_viewing');
      if (!decision.allowed) return fail('not_allowed', 'Verify your details to request a viewing.', { access: decision });
      const property = await properties.getById(propertyId);
      if (!property) return fail('unavailable', 'This home is no longer listed.');
      if (property.ownerId === studentId) return fail('forbidden', 'You cannot request a viewing of your own listing.');
      const c = ctx(studentId, false);
      const time = validateViewingTime(start, c.nowLocal);
      if (!time.ok) return fail('invalid', time.message);
      const text = validateNote(note);
      if (!text.ok) return fail('invalid', text.message);

      const created = await store.update<ViewingRequest | null>((rows) => {
        if (rows.some((v) => v.studentId === studentId && v.propertyId === propertyId && isActive(v, c.nowLocal))) return { rows, result: null };
        const v = createViewing({ id: newId(), propertyId, studentId, ownerId: property.ownerId, start, note: text.value, origin, listingPlanId: property.planId, nowIso: c.nowIso });
        return { rows: [...rows, v], result: v };
      });
      if (!created) return fail('conflict', 'You already have an open viewing request for this home. Reschedule it instead.');
      await announce(created, created.history[0]); // posts a card only if a conversation already exists
      return ok(created);
    },

    cancel: (id, studentId) => studentCommand(id, studentId, { type: 'cancel' }),

    async reschedule(id, studentId, start) {
      const decision = await access(studentId, 'request_viewing');
      if (!decision.allowed) return fail('not_allowed', 'Verify your details to request a viewing.', { access: decision });
      return studentCommand(id, studentId, { type: 'reschedule', start });
    },

    acceptAlternative: (id, studentId) => studentCommand(id, studentId, { type: 'accept_alternative' }),
    rejectAlternative: (id, studentId) => studentCommand(id, studentId, { type: 'reject_alternative' }),

    respond: (id, ownerId, command) => transition(id, ownerId, 'owner', (v) => applyOwnerCommand(v, command, ctx(ownerId, ownerSimulated))),

    async getConfirmedAddress(id, userId) {
      const v = await get(id);
      if (!v || (v.studentId !== userId && v.ownerId !== userId) || !canRevealAddress(v)) return null;
      return addresses(v.propertyId);
    },
  };
}

import type { MockStorage } from '../../storage/keyValue';
import type { PropertyRepository } from '../../data/repository';
import { newId as defaultNewId } from '../../lib/id';
import { createCollectionStore, type CollectionStore } from '../shared/collectionStore';
import { CONTACT_ORIGINS, type ContactOrigin } from '../shared/attribution';
import { asIsoTimestamp, asString, asStringOrNull, isRecord, oneOf } from '../shared/parse';
import { fail, ok } from '../shared/result';
import type { AccessChecker } from '../verification/accessChecker';
import { VIEWING_EVENT_CODES, VIEWING_STATUSES } from '../viewings/types';
import type { ConversationRepository, ViewingEventSink } from './conversationRepository';
import { byTime, counterpartOf, isParticipant, isWithinChangeWindow, MESSAGE_CHANGE_WINDOW_MINUTES, sortSummaries, summarize, validateMessageBody } from './messagingLogic';
import type { Conversation, Message, ParticipantRead } from './types';

export type MessagingStores = {
  conversations: CollectionStore<Conversation>;
  messages: CollectionStore<Message>;
  reads: CollectionStore<ParticipantRead>;
};

const parseConversation = (raw: unknown): Conversation | null => {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id), propertyId = asString(raw.propertyId), studentId = asString(raw.studentId), ownerId = asString(raw.ownerId), createdAt = asIsoTimestamp(raw.createdAt);
  if (!id || !propertyId || !studentId || !ownerId || !createdAt) return null;
  return {
    id, propertyId, studentId, ownerId, createdAt,
    lastMessageAt: asIsoTimestamp(raw.lastMessageAt),
    origin: oneOf(CONTACT_ORIGINS, raw.origin) ?? 'other',
    listingPlanId: (asStringOrNull(raw.listingPlanId) as Conversation['listingPlanId']) ?? null,
  };
};

const parseMessage = (raw: unknown): Message | null => {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id), conversationId = asString(raw.conversationId), senderId = asString(raw.senderId), createdAt = asIsoTimestamp(raw.createdAt);
  const kind = oneOf(['text', 'viewing_event'] as const, raw.kind);
  if (!id || !conversationId || !senderId || !createdAt || !kind) return null;
  const eventCode = oneOf(VIEWING_EVENT_CODES, raw.eventCode);
  if (kind === 'viewing_event' && (!eventCode || !asString(raw.viewingRequestId))) return null;
  if (asIsoTimestamp(raw.deletedAt)) return null; // saved by an earlier build as a soft delete: deleting is now a hard delete
  if (kind === 'text' && !asString(raw.body)) return null;
  return {
    id, conversationId, senderId, kind, createdAt,
    body: asStringOrNull(raw.body) ?? '',
    viewingRequestId: asStringOrNull(raw.viewingRequestId),
    eventCode: kind === 'viewing_event' ? eventCode : null,
    eventId: asStringOrNull(raw.eventId),
    eventStart: asStringOrNull(raw.eventStart),
    eventRelatedStart: asStringOrNull(raw.eventRelatedStart),
    eventStatus: oneOf(VIEWING_STATUSES, raw.eventStatus),
    editedAt: asIsoTimestamp(raw.editedAt),
    simulated: raw.simulated === true,
  };
};

const parseRead = (raw: unknown): ParticipantRead | null => {
  if (!isRecord(raw)) return null;
  const conversationId = asString(raw.conversationId), userId = asString(raw.userId);
  return conversationId && userId ? { conversationId, userId, lastReadAt: asIsoTimestamp(raw.lastReadAt), hiddenAt: asIsoTimestamp(raw.hiddenAt), deletedAt: asIsoTimestamp(raw.deletedAt) } : null;
};

export function createMessagingStores(storage: MockStorage): MessagingStores {
  return {
    conversations: createCollectionStore(storage, 'messaging.conversations', parseConversation),
    messages: createCollectionStore(storage, 'messaging.messages', parseMessage),
    reads: createCollectionStore(storage, 'messaging.reads', parseRead),
  };
}

type Deps = {
  stores: MessagingStores;
  /** Public listings only: a conversation can only start about a home that is listed. */
  properties: Pick<PropertyRepository, 'getById'>;
  access: AccessChecker;
  now?: () => Date;
  newId?: () => string;
  /**
   * True while landlords are not real accounts: anything done as the owner is a demo responder and is
   * marked `simulated`. Set to false when real landlord accounts exist (Step 7).
   */
  ownerActionsSimulated?: boolean;
};

export function createMockConversationRepository(deps: Deps): ConversationRepository & ViewingEventSink {
  const { stores, properties, access } = deps;
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? defaultNewId;
  const ownerSimulated = deps.ownerActionsSimulated ?? true;

  async function appendMessage(m: Omit<Message, 'id' | 'createdAt' | 'editedAt'>): Promise<Message> {
    const message: Message = { ...m, id: newId(), createdAt: now().toISOString(), editedAt: null };
    await stores.messages.update((rows) => ({ rows: [...rows, message], result: undefined }));
    await stores.conversations.update((rows) => ({ rows: rows.map((c) => (c.id === m.conversationId ? { ...c, lastMessageAt: message.createdAt } : c)), result: undefined }));
    // Whoever sends has, by definition, read the conversation up to their own message.
    await setRead(m.conversationId, m.senderId, message.createdAt);
    // New activity brings a hidden OR deleted conversation back into the normal inbox of the people it reaches:
    // everyone except the sender, and the sender too when they wrote a message themselves. (A viewing card caused by
    // someone's own action does not bring the conversation back for that same person.)
    await stores.reads.update((rows) => ({
      rows: rows.map((r) => (r.conversationId === m.conversationId && (r.userId !== m.senderId || m.kind === 'text') && (r.hiddenAt || r.deletedAt) ? { ...r, hiddenAt: null, deletedAt: null } : r)),
      result: undefined,
    }));
    return message;
  }

  async function setRead(conversationId: string, userId: string, at: string) {
    await stores.reads.update((rows) => {
      const existing = rows.find((r) => r.conversationId === conversationId && r.userId === userId);
      if (existing && existing.lastReadAt !== null && existing.lastReadAt >= at) return { rows, result: undefined }; // never moves backwards
      const others = rows.filter((r) => r !== existing);
      return { rows: [...others, { conversationId, userId, lastReadAt: at, hiddenAt: existing?.hiddenAt ?? null, deletedAt: existing?.deletedAt ?? null }], result: undefined };
    });
  }

  const findConversation = async (studentId: string, propertyId: string) =>
    (await stores.conversations.all()).find((c) => c.studentId === studentId && c.propertyId === propertyId) ?? null;

  return {
    async listForParticipant(userId, options) {
      const [conversations, messages, reads] = await Promise.all([stores.conversations.all(), stores.messages.all(), stores.reads.all()]);
      return sortSummaries(
        conversations
          .filter((c) => isParticipant(c, userId))
          .map((c) => summarize(c, messages, reads, userId))
          .filter((x) => x.lastMessage !== null && (options?.includeDeleted || !x.deleted)), // an emptied conversation has nothing to show
      );
    },

    async getThread(conversationId, userId) {
      const conversation = (await stores.conversations.all()).find((c) => c.id === conversationId);
      if (!conversation || !isParticipant(conversation, userId)) return fail('not_found', 'This conversation is not available.');
      const [messages, reads] = await Promise.all([stores.messages.all(), stores.reads.all()]);
      const other = counterpartOf(conversation, userId);
      return ok({
        conversation,
        messages: messages.filter((m) => m.conversationId === conversationId).sort(byTime),
        counterpartLastReadAt: reads.find((r) => r.conversationId === conversationId && r.userId === other)?.lastReadAt ?? null,
      });
    },

    findForProperty: findConversation,

    async startConversation({ studentId, propertyId, body, origin = 'property_detail' }) {
      const decision = await access(studentId, 'message');
      if (!decision.allowed) return fail('not_allowed', 'Verify your email to send messages.', { access: decision });
      const text = validateMessageBody(body);
      if (!text.ok) return fail('invalid', text.message);
      const property = await properties.getById(propertyId);
      if (!property) return fail('unavailable', 'This home is no longer listed.');
      if (property.ownerId === studentId) return fail('forbidden', 'You cannot message yourself about your own listing.');

      const created = now().toISOString();
      const conversation = await stores.conversations.update((rows) => {
        const existing = rows.find((c) => c.studentId === studentId && c.propertyId === propertyId);
        if (existing) return { rows, result: existing };
        const c: Conversation = { id: newId(), propertyId, studentId, ownerId: property.ownerId, origin: origin as ContactOrigin, listingPlanId: property.planId, createdAt: created, lastMessageAt: null };
        return { rows: [...rows, c], result: c };
      });
      const message = await appendMessage({ conversationId: conversation.id, senderId: studentId, kind: 'text', body: text.body, viewingRequestId: null, eventCode: null, eventId: null, eventStart: null, eventRelatedStart: null, eventStatus: null, simulated: false });
      return ok({ conversation: { ...conversation, lastMessageAt: message.createdAt }, message });
    },

    async sendMessage({ conversationId, senderId, body }) {
      const conversation = (await stores.conversations.all()).find((c) => c.id === conversationId);
      if (!conversation || !isParticipant(conversation, senderId)) return fail('not_found', 'This conversation is not available.');
      const asStudent = senderId === conversation.studentId;
      if (asStudent) {
        const decision = await access(senderId, 'message');
        if (!decision.allowed) return fail('not_allowed', 'Verify your email to send messages.', { access: decision });
      }
      const text = validateMessageBody(body);
      if (!text.ok) return fail('invalid', text.message);
      const message = await appendMessage({ conversationId, senderId, kind: 'text', body: text.body, viewingRequestId: null, eventCode: null, eventId: null, eventStart: null, eventRelatedStart: null, eventStatus: null, simulated: !asStudent && ownerSimulated });
      return ok(message);
    },

    async markRead(conversationId, userId) {
      const conversation = (await stores.conversations.all()).find((c) => c.id === conversationId);
      if (!conversation || !isParticipant(conversation, userId)) return;
      const latest = (await stores.messages.all()).filter((m) => m.conversationId === conversationId).sort(byTime).pop();
      const at = [now().toISOString(), latest?.createdAt ?? ''].sort().pop() as string;
      await setRead(conversationId, userId, at);
    },

    async recordViewingEvent(e) {
      // One card per history event: the same event is never posted twice.
      const already = (await stores.messages.all()).find((m) => m.eventId === e.eventId);
      if (already) return { posted: false, conversationId: already.conversationId, createdConversation: false };

      let createdConversation = false;
      let conversation = await findConversation(e.studentId, e.propertyId);
      if (!conversation && e.createIfMissing) {
        const created = now().toISOString();
        conversation = await stores.conversations.update((rows) => {
          const existing = rows.find((c) => c.studentId === e.studentId && c.propertyId === e.propertyId);
          if (existing) return { rows, result: existing };
          const c: Conversation = { id: newId(), propertyId: e.propertyId, studentId: e.studentId, ownerId: e.ownerId, origin: 'viewing_update', listingPlanId: e.listingPlanId, createdAt: created, lastMessageAt: null };
          createdConversation = true;
          return { rows: [...rows, c], result: c };
        });
      }
      if (!conversation) return { posted: false, conversationId: null, createdConversation: false };
      await appendMessage({ conversationId: conversation.id, senderId: e.actorId, kind: 'viewing_event', body: '', viewingRequestId: e.viewingRequestId, eventCode: e.code, eventId: e.eventId, eventStart: e.eventStart, eventRelatedStart: e.relatedStart, eventStatus: e.status, simulated: e.simulated });
      return { posted: true, conversationId: conversation.id, createdConversation };
    },

    async editMessage({ messageId, userId, body }) {
      const message = (await stores.messages.all()).find((m) => m.id === messageId);
      const conversation = message && (await stores.conversations.all()).find((c) => c.id === message.conversationId);
      if (!message || !conversation || !isParticipant(conversation, userId)) return fail('not_found', 'This message is not available.');
      if (message.kind !== 'text') return fail('forbidden', 'Status cards cannot be edited.');
      if (message.senderId !== userId) return fail('forbidden', 'You can only edit your own messages.');
      // The window runs from the ORIGINAL send time and editing never moves it.
      if (!isWithinChangeWindow(message, now())) return fail('expired', `Messages can only be edited within ${MESSAGE_CHANGE_WINDOW_MINUTES} minutes of sending.`);
      if (userId === conversation.studentId) {
        const decision = await access(userId, 'message');
        if (!decision.allowed) return fail('not_allowed', 'Verify your email to edit messages.', { access: decision });
      }
      const text = validateMessageBody(body);
      if (!text.ok) return fail('invalid', text.message);
      if (text.body === message.body) return ok(message);
      const updated = { ...message, body: text.body, editedAt: now().toISOString() };
      await stores.messages.update((rows) => ({ rows: rows.map((m) => (m.id === messageId ? updated : m)), result: undefined }));
      return ok(updated);
    },

    async deleteMessage({ messageId, userId }) {
      const message = (await stores.messages.all()).find((m) => m.id === messageId);
      const conversation = message && (await stores.conversations.all()).find((c) => c.id === message.conversationId);
      if (!message || !conversation || !isParticipant(conversation, userId)) return fail('not_found', 'This message is not available.');
      if (message.kind !== 'text') return fail('forbidden', 'Status cards cannot be deleted.');
      if (message.senderId !== userId) return fail('forbidden', 'You can only delete your own messages.');
      if (!isWithinChangeWindow(message, now())) return fail('expired', `Messages can only be deleted within ${MESSAGE_CHANGE_WINDOW_MINUTES} minutes of sending.`);
      // HARD delete: this one record is removed. Nothing else changes: not other messages, not status cards, not the other person's view.
      const remaining = await stores.messages.update((rows) => {
        const next = rows.filter((m) => m.id !== messageId);
        return { rows: next, result: next.filter((m) => m.conversationId === conversation.id) };
      });
      const latest = remaining.map((m) => m.createdAt).sort().pop() ?? null;
      await stores.conversations.update((rows) => ({ rows: rows.map((c) => (c.id === conversation.id ? { ...c, lastMessageAt: latest } : c)), result: undefined }));
      return ok<null>(null);
    },

    hideConversation: (conversationId, userId) => setVisibility(conversationId, userId, 'hide'),
    unhideConversation: (conversationId, userId) => setVisibility(conversationId, userId, 'unhide'),
    deleteConversation: (conversationId, userId) => setVisibility(conversationId, userId, 'delete'),
  };

  /** Changes ONLY this participant's own row. The shared conversation and its messages are never touched. */
  async function setVisibility(conversationId: string, userId: string, action: 'hide' | 'unhide' | 'delete') {
    const conversation = (await stores.conversations.all()).find((c) => c.id === conversationId);
    if (!conversation || !isParticipant(conversation, userId)) return fail<null>('not_found', 'This conversation is not available.');
    const at = now().toISOString();
    await stores.reads.update((rows) => {
      const existing = rows.find((r) => r.conversationId === conversationId && r.userId === userId);
      const base = { conversationId, userId, lastReadAt: existing?.lastReadAt ?? null };
      const row: ParticipantRead =
        action === 'hide' ? { ...base, hiddenAt: existing?.deletedAt ? null : at, deletedAt: existing?.deletedAt ?? null }
        : action === 'unhide' ? { ...base, hiddenAt: null, deletedAt: existing?.deletedAt ?? null }
        : { ...base, hiddenAt: null, deletedAt: at };
      return { rows: [...rows.filter((r) => r !== existing), row], result: undefined };
    });
    return ok<null>(null);
  }
}

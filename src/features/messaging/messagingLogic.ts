import { describeStart, EVENT_LABEL, STATUS_LABEL } from '../viewings/viewingRules';
import type { ViewingEventCode, ViewingRequest, ViewingStatus } from '../viewings/types';
import type { Conversation, ConversationSummary, Message, ParticipantRead } from './types';

export const MESSAGE_MAX_LENGTH = 2000;

export function validateMessageBody(raw: unknown): { ok: true; body: string } | { ok: false; message: string } {
  const body = typeof raw === 'string' ? raw.trim() : '';
  if (!body) return { ok: false, message: 'Write a message first.' };
  if (body.length > MESSAGE_MAX_LENGTH) return { ok: false, message: `Keep messages under ${MESSAGE_MAX_LENGTH} characters.` };
  return { ok: true, body };
}

export const isParticipant = (c: Conversation, userId: string): boolean => c.studentId === userId || c.ownerId === userId;
export const counterpartOf = (c: Conversation, userId: string): string => (c.studentId === userId ? c.ownerId : c.studentId);

/** Messages from the other person that arrived after this person last read the conversation. */
export function unreadCount(messages: Message[], userId: string, lastReadAt: string | null): number {
  return messages.filter((m) => m.senderId !== userId && (lastReadAt === null || m.createdAt > lastReadAt)).length;
}

/**
 * The messages and status cards one person may see: everything in the conversation created AFTER their history cutoff
 * (`clearedAt`, set when they deleted the conversation). With no cutoff, everything. This is the only place the rule
 * lives, so the list, the unread counts and the open conversation can never disagree.
 */
export const visibleTo = <T extends Pick<Message, 'createdAt'>>(messages: T[], clearedAt: string | null): T[] =>
  clearedAt === null ? messages : messages.filter((m) => m.createdAt > clearedAt);

/**
 * The timestamp for a NEW message: `at`, but never at or before any participant's history cutoff. A message added after
 * someone deleted the conversation must always count as "after" that deletion, even when both happen within the same
 * millisecond (a coarse clock, a frozen test clock). Otherwise a brand-new message could be hidden as "old".
 */
export function afterCutoffs(at: string, cutoffs: (string | null)[]): string {
  let latest = at;
  for (const c of cutoffs) {
    if (c !== null && c >= latest) latest = new Date(new Date(c).getTime() + 1).toISOString();
  }
  return latest;
}

export function summarize(c: Conversation, messages: Message[], reads: ParticipantRead[], userId: string): ConversationSummary {
  const mine = reads.find((r) => r.conversationId === c.id && r.userId === userId);
  const own = visibleTo(messages.filter((m) => m.conversationId === c.id), mine?.clearedAt ?? null).sort(byTime);
  const lastReadAt = mine?.lastReadAt ?? null;
  return { conversation: c, lastMessage: own[own.length - 1] ?? null, unreadCount: unreadCount(own, userId, lastReadAt), hidden: !!mine?.hiddenAt && !mine?.deletedAt, deleted: !!mine?.deletedAt };
}

export const byTime = (a: Message, b: Message): number => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1);

/** Most recently active first. */
export function sortSummaries(list: ConversationSummary[]): ConversationSummary[] {
  const stamp = (s: ConversationSummary) => s.lastMessage?.createdAt ?? s.conversation.createdAt;
  return [...list].sort((a, b) => (stamp(a) < stamp(b) ? 1 : stamp(a) > stamp(b) ? -1 : 0));
}

export const totalUnread = (list: ConversationSummary[]): number => list.reduce((n, s) => n + s.unreadCount, 0);

/** The line shown under a conversation's name. */
export function previewOf(m: Message | null): string {
  if (!m) return 'No messages yet';
  return m.kind === 'viewing_event' && m.eventCode ? EVENT_LABEL[m.eventCode] : m.body;
}

/** Shows "Read" under the person's own latest message once the other person has read it. */
export const isReadByCounterpart = (m: Message, counterpartLastReadAt: string | null): boolean =>
  counterpartLastReadAt !== null && m.createdAt <= counterpartLastReadAt;

const normalise = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Accent- and case-insensitive search over any text parts (name, home title, area, last message). */
export function matchesSearch(parts: (string | null | undefined)[], query: string): boolean {
  const q = normalise(query.trim());
  if (!q) return true;
  const hay = normalise(parts.filter(Boolean).join(' '));
  return q.split(/\s+/).every((word) => hay.includes(word));
}

// ---- editing and deleting your own messages: author only, normal messages only, 20 minutes from sending -------

export const MESSAGE_CHANGE_WINDOW_MINUTES = 20;
const WINDOW_MS = MESSAGE_CHANGE_WINDOW_MINUTES * 60 * 1000;

/** The moment the window closes. It is anchored on the ORIGINAL send time: editing never moves it. */
export const changeDeadline = (m: Pick<Message, 'createdAt'>): Date => new Date(Date.parse(m.createdAt) + WINDOW_MS);
export const isWithinChangeWindow = (m: Pick<Message, 'createdAt'>, now: Date): boolean => now.getTime() <= changeDeadline(m).getTime();

/** True only for the author, for a normal text message, while the 20 minutes have not passed. */
export const canModifyMessage = (m: Message, userId: string, now: Date): boolean => m.kind === 'text' && m.senderId === userId && isWithinChangeWindow(m, now);

// ---- viewing status cards: each one tells ONLY its own event ----------------------------------------------

export type EventCardSnapshot = { code: ViewingEventCode | null; label: string; start: string | null; relatedStart: string | null; status: ViewingStatus | null };

/**
 * What a status card shows. It comes from the card's own snapshot. Cards saved before snapshots existed are filled
 * from the viewing's immutable event HISTORY entry for that same event (by event id, or by order for the oldest
 * cards): never from the viewing's current times or status.
 */
export function eventCardSnapshot(m: Message, viewing: ViewingRequest | undefined, siblings: Message[] = []): EventCardSnapshot {
  let start = m.eventStart, related = m.eventRelatedStart, status = m.eventStatus;
  if ((start === null || status === null) && viewing && m.eventCode) {
    let entry = m.eventId ? viewing.history.find((h) => h.id === m.eventId) : undefined;
    if (!entry) {
      const same = siblings.filter((x) => x.kind === 'viewing_event' && x.viewingRequestId === m.viewingRequestId && x.eventCode === m.eventCode).sort(byTime);
      entry = viewing.history.filter((h) => h.event === m.eventCode)[Math.max(0, same.findIndex((x) => x.id === m.id))];
    }
    if (entry) {
      start = start ?? entry.start;
      related = related ?? entry.relatedStart;
      status = status ?? entry.status;
    }
  }
  return { code: m.eventCode, label: m.eventCode ? EVENT_LABEL[m.eventCode] : 'Viewing update', start, relatedStart: related, status };
}

/** The lines shown on a card, e.g. "12 Nov · 16:00", "Instead of 10 Nov · 14:00", "Status then: Confirmed". */
export function eventCardLines(s: EventCardSnapshot): { primary: string | null; secondary: string | null; status: string | null } {
  const rel = s.relatedStart ? describeStart(s.relatedStart) : null;
  const secondary =
    !rel ? null
    : s.code === 'alternative_proposed' || s.code === 'alternative_accepted' ? `Instead of ${rel}`
    : s.code === 'alternative_rejected' ? `Your time ${rel} is open again`
    : s.code === 'rescheduled' ? `Moved from ${rel}`
    : null;
  return { primary: s.start ? describeStart(s.start) : null, secondary, status: s.status ? `Status then: ${STATUS_LABEL[s.status]}` : null };
}

/** The inbox (`hidden = false`) or the Hidden list (`hidden = true`). Deleted conversations are in neither. */
export const visibleSummaries = (list: ConversationSummary[], hidden: boolean): ConversationSummary[] => list.filter((s) => !s.deleted && s.hidden === hidden);

// ---- viewing status cards that a newer card has replaced ---------------------------------------------------

/**
 * Status cards that a LATER card of the SAME viewing request has replaced. One formal viewing request is one lifecycle
 * (requested, proposed, rescheduled, confirmed, ...) with one current status, so within it only the newest card is the
 * current one and every earlier card is history. Cards of a different viewing request are independent: each keeps its own
 * current card. Text messages are never included. Pass the messages the person can see (see `visibleTo`).
 */
export function supersededCardIds(messages: Message[]): Set<string> {
  const latest = new Map<string, Message>();
  for (const m of [...messages].sort(byTime)) {
    if (m.kind === 'viewing_event' && m.viewingRequestId) latest.set(m.viewingRequestId, m);
  }
  const out = new Set<string>();
  for (const m of messages) {
    if (m.kind !== 'viewing_event' || !m.viewingRequestId) continue;
    if (latest.get(m.viewingRequestId)?.id !== m.id) out.add(m.id);
  }
  return out;
}

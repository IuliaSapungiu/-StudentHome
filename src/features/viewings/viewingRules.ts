import { formatShortDateTime, parseLocalDateTime, toMinutes, type LocalDateTime } from '../../lib/dateTime';
import { dateRange } from '../../lib/dateRange';
import type {
  OwnerViewingCommand, ProposalKind, ProposalOutcome, StudentViewingCommand, ViewingEventCode, ViewingHistoryEntry, ViewingProposal, ViewingRequest, ViewingStatus, ViewingTab,
} from './types';
import type { Attribution } from '../shared/attribution';

// ---- choosing a date and time -------------------------------------------------------------------------
// The student picks an exact date and time (minutes included). It is a PREFERENCE: nothing here knows the
// landlord's real availability, and the landlord can confirm it or suggest another time.

// There is deliberately no minimum lead time and no fixed list of slots: any future time is allowed, up to the
// shared two-year calendar limit (src/lib/dateRange.ts), which is calculated from today's date every time.

export const PREFERRED_TIME_NOTICE = 'Choose the date and time you would like. This is your preference, not the landlord’s confirmed availability. The landlord can confirm it or suggest another time.';
export const NOTE_MAX_LENGTH = 500;

export type Check = { ok: true } | { ok: false; message: string };
const pad = (n: number) => String(n).padStart(2, '0');

export const isHourValid = (h: number): boolean => Number.isInteger(h) && h >= 0 && h <= 23;
export const isMinuteValid = (m: number): boolean => Number.isInteger(m) && m >= 0 && m <= 59;
export const toLocal = (date: string, hour: number, minute: number): LocalDateTime => `${date}T${pad(hour)}:${pad(minute)}`;

/** `nowLocal` is the current local wall-clock time as 'YYYY-MM-DDTHH:mm'. */
export function validateViewingTime(start: unknown, nowLocal: LocalDateTime): Check {
  const p = parseLocalDateTime(start);
  if (!p) return { ok: false, message: 'Choose a date and a time.' };
  if (toMinutes(start as string) <= toMinutes(nowLocal)) return { ok: false, message: 'That time has already passed. Choose a later time.' };
  if (p.date > dateRange(nowLocal.slice(0, 10)).max) return { ok: false, message: 'Choose a date within the next two years.' };
  return { ok: true };
}

/** First and last day the calendar lets the student pick. */
export const bookableRange = (nowLocal: LocalDateTime): { min: string; max: string } => dateRange(nowLocal.slice(0, 10));

/** A specific hour:minute on that day that is still in the future (used to grey out past times on today). */
export const isTimeSelectable = (date: string, hour: number, minute: number, nowLocal: LocalDateTime): boolean =>
  isHourValid(hour) && isMinuteValid(minute) && validateViewingTime(toLocal(date, hour, minute), nowLocal).ok;

export const isHourSelectable = (date: string, hour: number, nowLocal: LocalDateTime): boolean => isTimeSelectable(date, hour, 59, nowLocal);

/** A day is pickable when it is not in the past and still has at least one future minute. */
export const isDateSelectable = (date: string, nowLocal: LocalDateTime): boolean => isTimeSelectable(date, 23, 59, nowLocal);

/** A sensible starting time: 12:00 on a future day, or about an hour from now (rounded up to 5 minutes) today. */
export function defaultTimeFor(date: string, nowLocal: LocalDateTime): { hour: number; minute: number } | null {
  if (!isDateSelectable(date, nowLocal)) return null;
  if (date !== nowLocal.slice(0, 10)) return { hour: 12, minute: 0 };
  const p = parseLocalDateTime(nowLocal)!;
  let total = Math.ceil((p.hour * 60 + p.minute + 60) / 5) * 5;
  if (total > 23 * 60 + 59) total = 23 * 60 + 59;
  const out = { hour: Math.floor(total / 60), minute: total % 60 };
  return isTimeSelectable(date, out.hour, out.minute, nowLocal) ? out : { hour: 23, minute: 59 };
}

/** Index of the nearest enabled value (used when a wheel is dragged onto a past time). */
export function nearestEnabled(count: number, index: number, enabled: (i: number) => boolean): number {
  for (let d = 0; d < count; d++) {
    if (index + d < count && enabled(index + d)) return index + d;
    if (index - d >= 0 && enabled(index - d)) return index - d;
  }
  return -1;
}

export function validateNote(note: string | null | undefined): { ok: true; value: string | null } | { ok: false; message: string } {
  const t = (note ?? '').trim();
  if (t.length > NOTE_MAX_LENGTH) return { ok: false, message: `Keep the note under ${NOTE_MAX_LENGTH} characters.` };
  return { ok: true, value: t || null };
}

// ---- reading a request ---------------------------------------------------------------------------------

export function currentProposal(v: ViewingRequest): ViewingProposal {
  return v.proposals.find((p) => p.id === v.currentProposalId) ?? v.proposals[v.proposals.length - 1];
}

/** The time that matters right now: the agreed time, the landlord's proposal, or the requested time. */
export const effectiveStart = (v: ViewingRequest): LocalDateTime => currentProposal(v).start;
/** The very first time the student asked for. It never changes. */
export const originalRequestedStart = (v: ViewingRequest): LocalDateTime => v.proposals[0].start;

const isFuture = (start: LocalDateTime, nowLocal: LocalDateTime) => toMinutes(start) > toMinutes(nowLocal);
export const isPast = (start: LocalDateTime, nowLocal: LocalDateTime): boolean => !isFuture(start, nowLocal);

/** Waiting for an answer, but the time has already passed. */
export const isExpired = (v: ViewingRequest, nowLocal: LocalDateTime): boolean =>
  (v.status === 'pending' || v.status === 'alternative_proposed') && isPast(effectiveStart(v), nowLocal);

export function bucketOf(v: ViewingRequest, nowLocal: LocalDateTime): ViewingTab {
  const future = isFuture(effectiveStart(v), nowLocal);
  if (v.status === 'confirmed' && future) return 'upcoming';
  if ((v.status === 'pending' || v.status === 'alternative_proposed') && future) return 'pending';
  return 'past';
}

/** A request the student still has open for a home: waiting, or confirmed and not yet happened. */
export const isActive = (v: ViewingRequest, nowLocal: LocalDateTime): boolean => bucketOf(v, nowLocal) !== 'past';

export const STATUS_LABEL: Record<ViewingStatus, string> = {
  pending: 'Pending confirmation',
  alternative_proposed: 'New time proposed',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export function statusLabel(v: ViewingRequest, nowLocal: LocalDateTime): string {
  if (isExpired(v, nowLocal)) return 'Expired';
  if (v.status === 'confirmed' && isPast(effectiveStart(v), nowLocal)) return 'Date passed';
  return STATUS_LABEL[v.status];
}

/** Short wording for the status card in a conversation. */
export const EVENT_LABEL: Record<ViewingEventCode, string> = {
  requested: 'Viewing requested',
  rescheduled: 'Viewing rescheduled',
  alternative_proposed: 'New time proposed',
  alternative_accepted: 'New time accepted',
  alternative_rejected: 'New time rejected',
  confirmed: 'Viewing confirmed',
  declined: 'Viewing declined',
  cancelled: 'Viewing cancelled',
  completed: 'Viewing completed',
};

/** The exact address is only shown once the landlord has confirmed the viewing. */
export const canRevealAddress = (v: ViewingRequest): boolean => v.status === 'confirmed';

export const describeStart = (start: LocalDateTime): string => formatShortDateTime(start);

/** Soonest first for Upcoming and Pending, most recent first for Past. */
export function sortForTab(list: ViewingRequest[], tab: ViewingTab): ViewingRequest[] {
  const key = (v: ViewingRequest) => toMinutes(effectiveStart(v));
  return [...list].sort((a, b) => (tab === 'past' ? key(b) - key(a) : key(a) - key(b)));
}

export function groupByDay(list: ViewingRequest[]): { date: string; items: ViewingRequest[] }[] {
  const groups: { date: string; items: ViewingRequest[] }[] = [];
  for (const v of list) {
    const date = effectiveStart(v).slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.items.push(v);
    else groups.push({ date, items: [v] });
  }
  return groups;
}

// ---- navigation to one exact viewing -------------------------------------------------------------------

/** Which tab shows this viewing right now, so a link can open the right tab and highlight the right card. */
export function resolveViewingFocus(viewings: ViewingRequest[], viewingId: string | undefined, nowLocal: LocalDateTime): { found: false } | { found: true; tab: ViewingTab; viewing: ViewingRequest } {
  const viewing = viewingId ? viewings.find((v) => v.id === viewingId) : undefined;
  return viewing ? { found: true, tab: bucketOf(viewing, nowLocal), viewing } : { found: false };
}

/** Route target for "open this exact viewing". The screen picks the tab and highlights the card. */
export const viewingHref = (viewingId: string) => ({ pathname: '/my-viewings' as const, params: { viewingId } });

// ---- the history, as the student reads it --------------------------------------------------------------

export type TimelineRow = {
  proposalId: string;
  who: 'You' | 'Landlord';
  text: string;
  start: LocalDateTime;
  outcome: ProposalOutcome;
  outcomeText: string;
  /** No longer the live proposal (replaced, rejected, withdrawn, or an earlier agreed time). Shown greyed. */
  inactive: boolean;
  /** The date-time has already passed. Shown disabled and never actionable. */
  past: boolean;
};

const KIND_TEXT: Record<ProposalKind, { student: string; owner: string }> = {
  request: { student: 'You requested', owner: 'Landlord requested' },
  reschedule: { student: 'You asked to move it to', owner: 'Landlord moved it to' },
  alternative: { student: 'You suggested', owner: 'Landlord suggested' },
  retained: { student: 'You kept your original time', owner: 'Landlord kept' },
};

const OUTCOME_TEXT: Record<ProposalOutcome, string> = { active: 'Waiting for an answer', accepted: 'Accepted', rejected: 'Rejected', superseded: 'Replaced by a newer time', withdrawn: 'Withdrawn' };

export function describeTimeline(v: ViewingRequest, nowLocal: LocalDateTime): TimelineRow[] {
  return v.proposals.map((p) => {
    const current = p.id === v.currentProposalId;
    const past = isPast(p.start, nowLocal);
    const live = current && (p.outcome === 'active' || (p.outcome === 'accepted' && v.status === 'confirmed'));
    let outcomeText = OUTCOME_TEXT[p.outcome];
    if (p.outcome === 'active' && past) outcomeText = 'Expired';
    if (p.outcome === 'accepted' && !live) outcomeText = 'Accepted earlier, since changed';
    return {
      proposalId: p.id,
      who: p.proposedBy === 'student' ? 'You' : 'Landlord',
      text: KIND_TEXT[p.kind][p.proposedBy],
      start: p.start,
      outcome: p.outcome,
      outcomeText,
      inactive: !live || (p.outcome === 'active' && past),
      past,
    };
  });
}

// ---- creating and changing a request -------------------------------------------------------------------

export function createViewing(a: Attribution & { id: string; propertyId: string; studentId: string; ownerId: string; start: LocalDateTime; note: string | null; nowIso: string }): ViewingRequest {
  const proposal: ViewingProposal = { id: `${a.id}:p1`, start: a.start, proposedBy: 'student', kind: 'request', proposedAt: a.nowIso, outcome: 'active', resolvedAt: null, resolvedBy: null, simulated: false };
  return {
    id: a.id, propertyId: a.propertyId, studentId: a.studentId, ownerId: a.ownerId, status: 'pending', currentProposalId: proposal.id, proposals: [proposal], studentNote: a.note,
    origin: a.origin, listingPlanId: a.listingPlanId, createdAt: a.nowIso, updatedAt: a.nowIso,
    history: [{ id: `${a.id}:e1`, event: 'requested', status: 'pending', at: a.nowIso, actorId: a.studentId, actorRole: 'student', start: a.start, relatedStart: null, proposalId: proposal.id, simulated: false }],
  };
}

type Context = { actorId: string; nowIso: string; nowLocal: LocalDateTime; simulated: boolean };
export type TransitionResult = { ok: true; value: ViewingRequest; event: ViewingEventCode; entry: ViewingHistoryEntry } | { ok: false; message: string };
const refuse = (message: string): TransitionResult => ({ ok: false, message });

/** Gives an ACTIVE proposal its outcome. Proposals that already have an outcome are never rewritten. */
const resolve = (proposals: ViewingProposal[], id: string, outcome: ProposalOutcome, by: 'student' | 'owner', c: Context): ViewingProposal[] =>
  proposals.map((p) => (p.id === id && p.outcome === 'active' ? { ...p, outcome, resolvedAt: c.nowIso, resolvedBy: by } : p));

const newProposal = (v: ViewingRequest, start: LocalDateTime, by: 'student' | 'owner', kind: ProposalKind, c: Context): ViewingProposal => ({
  id: `${v.id}:p${v.proposals.length + 1}`, start, proposedBy: by, kind, proposedAt: c.nowIso, outcome: 'active', resolvedAt: null, resolvedBy: null, simulated: by === 'owner' && c.simulated,
});

function done(v: ViewingRequest, proposals: ViewingProposal[], currentProposalId: string, status: ViewingStatus, event: ViewingEventCode, role: 'student' | 'owner', start: LocalDateTime | null, related: LocalDateTime | null, c: Context): TransitionResult {
  const entry: ViewingHistoryEntry = { id: `${v.id}:e${v.history.length + 1}`, event, status, at: c.nowIso, actorId: c.actorId, actorRole: role, start, relatedStart: related, proposalId: currentProposalId, simulated: role === 'owner' && c.simulated };
  return { ok: true, event, entry, value: { ...v, proposals, currentProposalId, status, updatedAt: c.nowIso, history: [...v.history, entry] } };
}

/** The student's side. The caller has already checked that the actor is this request's student. */
export function applyStudentCommand(v: ViewingRequest, cmd: StudentViewingCommand, c: Context): TransitionResult {
  const open = v.status === 'pending' || v.status === 'alternative_proposed' || v.status === 'confirmed';
  const cur = currentProposal(v);
  switch (cmd.type) {
    case 'cancel': {
      if (!open) return refuse('This viewing can no longer be cancelled.');
      const outcome: ProposalOutcome = cur.proposedBy === 'student' ? 'withdrawn' : 'rejected';
      return done(v, resolve(v.proposals, cur.id, outcome, 'student', c), cur.id, 'cancelled', 'cancelled', 'student', cur.start, null, c);
    }
    case 'reschedule': {
      if (!open) return refuse('This viewing can no longer be rescheduled.');
      const check = validateViewingTime(cmd.start, c.nowLocal);
      if (!check.ok) return refuse(check.message);
      // The time being replaced keeps its place in the history: a student's own time is "replaced", a landlord's
      // suggestion the student did not take is "rejected". An already agreed time stays "accepted".
      const outcome: ProposalOutcome = cur.proposedBy === 'student' ? 'superseded' : 'rejected';
      const next = newProposal(v, cmd.start, 'student', 'reschedule', c);
      return done(v, [...resolve(v.proposals, cur.id, outcome, 'student', c), next], next.id, 'pending', 'rescheduled', 'student', cmd.start, cur.start, c);
    }
    case 'accept_alternative': {
      if (v.status !== 'alternative_proposed' || cur.proposedBy !== 'owner' || cur.outcome !== 'active') return refuse('There is no new time to accept.');
      if (!isFuture(cur.start, c.nowLocal)) return refuse('That proposed time has passed.');
      const replaced = [...v.proposals].reverse().find((p) => p.proposedBy === 'student');
      return done(v, resolve(v.proposals, cur.id, 'accepted', 'student', c), cur.id, 'confirmed', 'alternative_accepted', 'student', cur.start, replaced?.start ?? null, c);
    }
    case 'reject_alternative': {
      if (v.status !== 'alternative_proposed' || cur.proposedBy !== 'owner' || cur.outcome !== 'active') return refuse('There is no new time to reject.');
      // The landlord's time is rejected; the student's own last time is open again as a NEW proposal (history is kept).
      const own = [...v.proposals].reverse().find((p) => p.proposedBy === 'student');
      if (!own) return refuse('There is no earlier time to return to.');
      const retained = newProposal(v, own.start, 'student', 'retained', c);
      return done(v, [...resolve(v.proposals, cur.id, 'rejected', 'student', c), retained], retained.id, 'pending', 'alternative_rejected', 'student', cur.start, own.start, c);
    }
  }
}

/** The landlord's side. The caller has already checked that the actor owns the property. */
export function applyOwnerCommand(v: ViewingRequest, cmd: OwnerViewingCommand, c: Context): TransitionResult {
  const cur = currentProposal(v);
  switch (cmd.type) {
    case 'confirm':
      if (v.status !== 'pending') return refuse('Only a pending request can be confirmed.');
      if (!isFuture(cur.start, c.nowLocal)) return refuse('The requested time has already passed.');
      return done(v, resolve(v.proposals, cur.id, 'accepted', 'owner', c), cur.id, 'confirmed', 'confirmed', 'owner', cur.start, null, c);
    case 'decline':
      if (v.status !== 'pending') return refuse('Only a pending request can be declined.');
      return done(v, resolve(v.proposals, cur.id, 'rejected', 'owner', c), cur.id, 'declined', 'declined', 'owner', cur.start, null, c);
    case 'propose_alternative': {
      if (v.status !== 'pending' && v.status !== 'alternative_proposed') return refuse('A new time can only be proposed while the request is open.');
      const check = validateViewingTime(cmd.start, c.nowLocal);
      if (!check.ok) return refuse(check.message);
      if (cmd.start === cur.start) return refuse('Propose a different time from the current one.');
      const next = newProposal(v, cmd.start, 'owner', 'alternative', c);
      return done(v, [...resolve(v.proposals, cur.id, 'superseded', 'owner', c), next], next.id, 'alternative_proposed', 'alternative_proposed', 'owner', cmd.start, cur.start, c);
    }
    case 'complete':
      if (v.status !== 'confirmed') return refuse('Only a confirmed viewing can be completed.');
      if (isFuture(cur.start, c.nowLocal)) return refuse('The viewing has not happened yet.');
      return done(v, v.proposals, cur.id, 'completed', 'completed', 'owner', cur.start, null, c);
  }
}

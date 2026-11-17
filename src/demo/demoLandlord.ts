import { DEMO_PROPERTIES } from '../data/mockProperties';
import { toLocalDateTime, addDays } from '../lib/dateTime';
import type { ApplicationRepository } from '../features/applications/applicationRepository';
import type { OwnerApplicationCommand, RentalApplication } from '../features/applications/types';
import type { ConversationRepository } from '../features/messaging/conversationRepository';
import type { Message } from '../features/messaging/types';
import { fail, type RepoResult } from '../features/shared/result';
import type { ViewingRepository } from '../features/viewings/viewingRepository';
import { validateViewingTime } from '../features/viewings/viewingRules';
import type { ViewingRequest } from '../features/viewings/types';

// DEMO ONLY. There are no real landlord accounts yet, so these explicit buttons play the landlord's side by
// calling the same owner-side repository methods the future landlord screens will use. Nothing runs by itself.
// Every result is recorded as simulated, and the app labels it "Demo" wherever it appears.

const REPLIES = [
  'Hello! Yes, the home is still available. Would you like to come and see it?',
  'Thanks for the details. I can show you around this week if you like.',
  'Of course, happy to answer any questions about the home or the area.',
];

export type DemoLandlord = ReturnType<typeof createDemoLandlord>;

export function createDemoLandlord(deps: {
  conversations: ConversationRepository;
  viewings: ViewingRepository;
  applications: ApplicationRepository;
  enabled: () => boolean;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  const off = <T,>(): RepoResult<T> => fail('forbidden', 'Demo landlord responses are not enabled in this build.');

  return {
    isEnabled: deps.enabled,

    /**
     * The student's conversations as the LANDLORDS see them: the same participant-specific `listForParticipant` a real
     * landlord inbox will use, one call per landlord. It does not depend on whether the student has hidden or deleted
     * a conversation, because that is the student's own inbox state. Nothing is faked or read around the repository.
     */
    async conversationsForStudent(studentId: string) {
      const owners = [...new Set(DEMO_PROPERTIES.map((p) => p.ownerId))];
      const [byOwner, mine] = await Promise.all([
        Promise.all(owners.map((o) => deps.conversations.listForParticipant(o))),
        deps.conversations.listForParticipant(studentId, { includeDeleted: true }),
      ]);
      const state = new Map(mine.map((s) => [s.conversation.id, s.deleted ? ('deleted' as const) : s.hidden ? ('hidden' as const) : ('visible' as const)]));
      return byOwner
        .flat()
        .filter((s) => s.conversation.studentId === studentId)
        .map((s) => ({ summary: s, studentInbox: state.get(s.conversation.id) ?? ('visible' as const) }));
    },

    /** The landlord of the conversation writes a short canned reply. */
    async reply(conversationId: string, ownerId: string) {
      if (!deps.enabled()) return off<Message>();
      const thread = await deps.conversations.getThread(conversationId, ownerId);
      if (!thread.ok) return thread;
      const sent = thread.value.messages.filter((m) => m.senderId === ownerId && m.kind === 'text').length;
      return deps.conversations.sendMessage({ conversationId, senderId: ownerId, body: REPLIES[sent % REPLIES.length] });
    },

    confirmViewing: (v: ViewingRequest) => (deps.enabled() ? deps.viewings.respond(v.id, v.ownerId, { type: 'confirm' }) : off<ViewingRequest>()),
    declineViewing: (v: ViewingRequest) => (deps.enabled() ? deps.viewings.respond(v.id, v.ownerId, { type: 'decline' }) : off<ViewingRequest>()),

    /** Suggests another time: 15:00 on a later day than the current one (a different date, so it is always a real change). */
    async proposeAlternative(v: ViewingRequest) {
      if (!deps.enabled()) return off<ViewingRequest>();
      const nowLocal = toLocalDateTime(now());
      const current = v.proposals.find((p) => p.id === v.currentProposalId)?.start ?? v.proposals[0].start;
      for (let d = 1; d <= 14; d++) {
        const start = `${addDays(current.slice(0, 10), d)}T15:00`;
        if (validateViewingTime(start, nowLocal).ok) return deps.viewings.respond(v.id, v.ownerId, { type: 'propose_alternative', start });
      }
      return fail<ViewingRequest>('conflict', 'No later time could be proposed.');
    },

    respondToApplication: (id: string, ownerId: string, command: OwnerApplicationCommand) => (deps.enabled() ? deps.applications.respond(id, ownerId, command) : off<RentalApplication>()),
  };
}

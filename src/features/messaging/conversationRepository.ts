import type { ContactOrigin } from '../shared/attribution';
import type { RepoResult } from '../shared/result';
import type { ViewingEventCode, ViewingStatus } from '../viewings/types';
import type { Conversation, ConversationSummary, Message, Thread } from './types';

/**
 * Conversations and messages, shared by both sides: a student and (later) a landlord read the same rows,
 * each as a participant. Sending as the student needs a verified email (checked HERE, not only in the UI).
 * Supabase: `conversations`, `messages`, `conversation_participants(last_read_at)` with RLS "participants only"
 * and a unique (property_id, student_id).
 */
export interface ConversationRepository {
  /**
   * Every conversation the person takes part in, most recently active first. Conversations the person has hidden
   * carry `hidden: true`. Conversations the person deleted are left out unless `includeDeleted` is set (they then carry
   * `deleted: true`). A conversation with no messages left is never listed.
   */
  listForParticipant(userId: string, options?: { includeDeleted?: boolean }): Promise<ConversationSummary[]>;
  /** Null-equivalent errors ('not_found') for conversations the person is not part of. */
  getThread(conversationId: string, userId: string): Promise<RepoResult<Thread>>;
  findForProperty(studentId: string, propertyId: string): Promise<Conversation | null>;
  /** Finds or creates the student's conversation for a home and sends the first message. */
  startConversation(input: { studentId: string; propertyId: string; body: string; origin?: ContactOrigin }): Promise<RepoResult<{ conversation: Conversation; message: Message }>>;
  sendMessage(input: { conversationId: string; senderId: string; body: string }): Promise<RepoResult<Message>>;
  /** Marks everything up to now (or the latest message) as read for this person. */
  markRead(conversationId: string, userId: string): Promise<void>;
  /**
   * Only the author, only a normal text message, only within 20 minutes of the ORIGINAL send time (editing does not
   * extend it; after that the call fails with 'expired'). Keeps an `editedAt` time. Needs the same gate as sending.
   */
  editMessage(input: { messageId: string; userId: string; body: string }): Promise<RepoResult<Message>>;
  /**
   * Only the author, only a normal text message, only within 20 minutes of the original send time. A HARD delete:
   * the message record is removed and leaves no placeholder. No other message, status card or conversation changes.
   * (If messages later get attachments, their stored files are removed separately, in the same operation.)
   * There is intentionally no way to hide an individual message.
   */
  deleteMessage(input: { messageId: string; userId: string }): Promise<RepoResult<null>>;
  /** Hides the conversation from THIS person's inbox only (reversible). Nothing is deleted; the other participant is unaffected. */
  hideConversation(conversationId: string, userId: string): Promise<RepoResult<null>>;
  unhideConversation(conversationId: string, userId: string): Promise<RepoResult<null>>;
  /**
   * Removes the conversation from THIS person's normal and hidden lists, with no unhide. The shared conversation and
   * its messages stay, and the other participant is unaffected. New activity brings it back.
   */
  deleteConversation(conversationId: string, userId: string): Promise<RepoResult<null>>;
}

/**
 * Used by the viewing repository to record a viewing event in the student's conversation for the same home.
 *  - `createIfMissing` is true only for landlord-initiated events (confirmed, alternative proposed): then the
 *    conversation is created if the student has none for that home. An existing conversation is always reused.
 *  - A viewing request on its own never creates a conversation.
 *  - One card per history event: recording the same `eventId` again posts nothing.
 */
export interface ViewingEventSink {
  recordViewingEvent(e: {
    studentId: string;
    ownerId: string;
    propertyId: string;
    listingPlanId: Conversation['listingPlanId'];
    viewingRequestId: string;
    eventId: string;
    eventStart: string | null;
    relatedStart: string | null;
    status: ViewingStatus;
    actorId: string;
    code: ViewingEventCode;
    simulated: boolean;
    createIfMissing: boolean;
  }): Promise<{ posted: boolean; conversationId: string | null; createdConversation: boolean }>;
}

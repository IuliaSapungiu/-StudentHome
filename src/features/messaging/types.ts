import type { Attribution } from '../shared/attribution';
import type { ViewingEventCode, ViewingStatus } from '../viewings/types';

/**
 * One conversation per student per property. Messages stand on their own: a conversation never requires a
 * formal viewing request or rental application, and neither of those requires a conversation.
 */
export type Conversation = Attribution & {
  id: string;
  propertyId: string;
  studentId: string;
  /** The provider account that owns the property (copied from the property when the conversation starts). */
  ownerId: string;
  createdAt: string;
  /** Time of the latest message; null only for a conversation with no messages. */
  lastMessageAt: string | null;
};

export type MessageKind = 'text' | 'viewing_event';

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  kind: MessageKind;
  /** The text for kind 'text'; empty for status cards. */
  body: string;
  /** For kind 'viewing_event': the formal viewing request the card is about, and what happened. */
  viewingRequestId: string | null;
  eventCode: ViewingEventCode | null;
  /** For status cards: the id of the viewing history event the card records (one card per event, never duplicated). */
  eventId: string | null;
  /**
   * For status cards: an IMMUTABLE snapshot of the event, written when the event happened and never updated:
   * the date-time it is about, the other time involved (what it replaced, or what is open again), and the viewing's
   * status right after it. A card must never read the viewing's CURRENT times.
   */
  eventStart: string | null;
  eventRelatedStart: string | null;
  eventStatus: ViewingStatus | null;
  createdAt: string;
  /** Set when the author changed the text. Editing never moves `createdAt`, so it never extends the 20-minute window. */
  editedAt: string | null;
  /** True when a demo responder wrote it as the landlord. Never a real landlord message. */
  simulated: boolean;
};

/**
 * Per-participant state of a conversation (a future `conversation_participants` row): when they last read it
 * (unread counts are derived from this, never stored) and what THEY did with it in their own inbox:
 *  - `hiddenAt`:  reversible; it moves to their "Hidden conversations" list
 *  - `deletedAt`: it is gone from their normal and hidden lists, with no unhide
 * Neither touches the shared conversation or its messages, and neither affects the other participant.
 * New activity (a message, a viewing card) clears both for the people it reaches.
 */
export type ParticipantRead = { conversationId: string; userId: string; lastReadAt: string | null; hiddenAt: string | null; deletedAt: string | null };

export type ConversationSummary = { conversation: Conversation; lastMessage: Message | null; unreadCount: number; /** Hidden from THIS person's inbox (reversible). */ hidden: boolean; /** Deleted from THIS person's inbox. */ deleted: boolean };

export type Thread = {
  conversation: Conversation;
  /** Oldest first. */
  messages: Message[];
  /** When the OTHER person last read the conversation (drives the "Read" label). */
  counterpartLastReadAt: string | null;
};

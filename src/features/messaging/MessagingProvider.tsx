import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { conversationRepository as defaultRepository } from '@/services';
import { useSession } from '../session/SessionProvider';
import type { ContactOrigin } from '../shared/attribution';
import type { RepoResult } from '../shared/result';
import type { ConversationRepository } from './conversationRepository';
import { totalUnread, visibleSummaries } from './messagingLogic';
import type { Conversation, ConversationSummary, Message, Thread } from './types';

type MessagingContextValue = {
  /** The inbox: conversations this person has not hidden. */
  conversations: ConversationSummary[];
  /** Conversations this person hid from their own inbox (the other participant still sees them). */
  hiddenConversations: ConversationSummary[];
  unreadCount: number;
  ready: boolean;
  refresh: () => Promise<void>;
  getThread: (conversationId: string) => Promise<RepoResult<Thread>>;
  findForProperty: (propertyId: string) => Promise<Conversation | null>;
  startConversation: (propertyId: string, body: string, origin?: ContactOrigin) => Promise<RepoResult<{ conversation: Conversation; message: Message }>>;
  sendMessage: (conversationId: string, body: string) => Promise<RepoResult<Message>>;
  markRead: (conversationId: string) => Promise<void>;
  editMessage: (messageId: string, body: string) => Promise<RepoResult<Message>>;
  /** Hard delete of one's own message within 20 minutes of sending. */
  deleteMessage: (messageId: string) => Promise<RepoResult<null>>;
  /** Removes the conversation from this person's own inbox (and Hidden list) only. */
  deleteConversation: (conversationId: string) => Promise<RepoResult<null>>;
  hideConversation: (conversationId: string) => Promise<RepoResult<null>>;
  unhideConversation: (conversationId: string) => Promise<RepoResult<null>>;
};

const MessagingContext = createContext<MessagingContextValue | null>(null);

export function MessagingProvider({ children, repository = defaultRepository }: { children: ReactNode; repository?: ConversationRepository }) {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [all, setAll] = useState<ConversationSummary[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setAll([]);
      setReady(false);
      return;
    }
    setAll(await repository.listForParticipant(userId));
    setReady(true);
  }, [repository, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Each action is individually stable (they only change with the repository or the signed-in account), so
  // screens that load on focus do not re-run every time the conversation list refreshes.
  const getThread = useCallback(
    async (id: string): Promise<RepoResult<Thread>> => (userId ? repository.getThread(id, userId) : { ok: false, error: { code: 'not_found', message: 'Sign in to see your messages.' } }),
    [repository, userId],
  );
  const findForProperty = useCallback(async (propertyId: string) => (userId ? repository.findForProperty(userId, propertyId) : null), [repository, userId]);
  const startConversation = useCallback(
    async (propertyId: string, body: string, origin?: ContactOrigin): Promise<RepoResult<{ conversation: Conversation; message: Message }>> => {
      if (!userId) return { ok: false, error: { code: 'not_allowed', message: 'Sign in to send messages.' } };
      const r = await repository.startConversation({ studentId: userId, propertyId, body, origin });
      if (r.ok) await refresh();
      return r;
    },
    [repository, userId, refresh],
  );
  const sendMessage = useCallback(
    async (conversationId: string, body: string): Promise<RepoResult<Message>> => {
      if (!userId) return { ok: false, error: { code: 'not_found', message: 'Sign in to send messages.' } };
      const r = await repository.sendMessage({ conversationId, senderId: userId, body });
      if (r.ok) await refresh();
      return r;
    },
    [repository, userId, refresh],
  );
  const markRead = useCallback(
    async (conversationId: string) => {
      if (!userId) return;
      await repository.markRead(conversationId, userId);
      await refresh();
    },
    [repository, userId, refresh],
  );

  const editMessage = useCallback(
    async (messageId: string, body: string): Promise<RepoResult<Message>> => {
      if (!userId) return { ok: false, error: { code: 'not_found', message: 'Sign in to edit messages.' } };
      const r = await repository.editMessage({ messageId, userId, body });
      if (r.ok) await refresh();
      return r;
    },
    [repository, userId, refresh],
  );
  const deleteMessage = useCallback(
    async (messageId: string): Promise<RepoResult<null>> => {
      if (!userId) return { ok: false, error: { code: 'not_found', message: 'Sign in to delete messages.' } };
      const r = await repository.deleteMessage({ messageId, userId });
      if (r.ok) await refresh();
      return r;
    },
    [repository, userId, refresh],
  );
  const hideConversation = useCallback(
    async (conversationId: string): Promise<RepoResult<null>> => {
      if (!userId) return { ok: false, error: { code: 'not_found', message: 'Sign in first.' } };
      const r = await repository.hideConversation(conversationId, userId);
      if (r.ok) await refresh();
      return r;
    },
    [repository, userId, refresh],
  );
  const deleteConversation = useCallback(
    async (conversationId: string): Promise<RepoResult<null>> => {
      if (!userId) return { ok: false, error: { code: 'not_found', message: 'Sign in first.' } };
      const r = await repository.deleteConversation(conversationId, userId);
      if (r.ok) await refresh();
      return r;
    },
    [repository, userId, refresh],
  );
  const unhideConversation = useCallback(
    async (conversationId: string): Promise<RepoResult<null>> => {
      if (!userId) return { ok: false, error: { code: 'not_found', message: 'Sign in first.' } };
      const r = await repository.unhideConversation(conversationId, userId);
      if (r.ok) await refresh();
      return r;
    },
    [repository, userId, refresh],
  );

  const value = useMemo<MessagingContextValue>(() => {
    const conversations = visibleSummaries(all, false);
    return {
      conversations, hiddenConversations: visibleSummaries(all, true), unreadCount: totalUnread(conversations), ready, refresh, getThread, findForProperty, startConversation, sendMessage, markRead,
      editMessage, deleteMessage, hideConversation, unhideConversation, deleteConversation,
    };
  }, [all, ready, refresh, getThread, findForProperty, startConversation, sendMessage, markRead, editMessage, deleteMessage, hideConversation, unhideConversation, deleteConversation]);
  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}

export function useMessaging(): MessagingContextValue {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error('useMessaging must be used inside <MessagingProvider>');
  return ctx;
}

/** Loads one conversation each time the screen is focused (so replies appear when you come back) and marks it read. */
export function useThread(conversationId: string | null) {
  const { getThread, markRead } = useMessaging();
  const [state, setState] = useState<{ thread: Thread | null; error: string | null; loading: boolean }>({ thread: null, error: null, loading: conversationId !== null });

  const load = useCallback(async () => {
    if (!conversationId) {
      setState({ thread: null, error: null, loading: false });
      return;
    }
    const r = await getThread(conversationId);
    setState(r.ok ? { thread: r.value, error: null, loading: false } : { thread: null, error: r.error.message, loading: false });
    if (r.ok) await markRead(conversationId);
  }, [conversationId, getThread, markRead]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return { ...state, reload: load };
}

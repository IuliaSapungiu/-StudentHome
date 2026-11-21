import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';
import { BackButton } from '@/components/BackButton';
import { ContentContainer } from '@/components/ContentContainer';
import { PropertyStrip } from '@/components/PropertyStrip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SwipeableRow } from '@/components/SwipeableRow';
import { MessageBubble } from '@/components/messages/MessageBubble';
import { ViewingEventCard } from '@/components/messages/ViewingEventCard';
import { propertyRepository, type Property } from '@/data';
import { dayLabel } from '@/lib/dateTime';
import { CONTACT_ORIGINS, type ContactOrigin } from '@/features/shared/attribution';
import { RequireAccount } from '@/features/session/RequireAccount';
import { useSession } from '@/features/session/SessionProvider';
import { useMessaging, useThread } from '@/features/messaging/MessagingProvider';
import { canModifyMessage, isReadByCounterpart, MESSAGE_CHANGE_WINDOW_MINUTES, MESSAGE_MAX_LENGTH, supersededCardIds } from '@/features/messaging/messagingLogic';
import type { Message } from '@/features/messaging/types';
import { useGatedSubmit } from '@/features/verification/useGatedSubmit';

// Chat. `id` is a conversation id, or "new" (with ?propertyId=) for a conversation that does not exist yet.
// Nothing is created until the first message is sent, and sending needs a verified email.
export default function ConversationScreen() {
  return (
    <RequireAccount>
      <Content />
    </RequireAccount>
  );
}

type Item = { kind: 'day'; key: string; label: string } | { kind: 'message'; key: string; message: Message };

function Content() {
  const router = useRouter();
  const { id, propertyId: propertyParam, origin: originParam } = useLocalSearchParams<{ id: string; propertyId?: string; origin?: string }>();
  const { user } = useSession();
  const { sendMessage, startConversation, findForProperty, editMessage, deleteMessage, hideConversation, unhideConversation, deleteConversation } = useMessaging();
  const isNew = id === 'new';
  const [conversationId, setConversationId] = useState<string | null>(isNew ? null : id ?? null);
  const { thread, error: loadError, loading, reload } = useThread(conversationId);

  const [property, setProperty] = useState<Property | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteConversation, setConfirmDeleteConversation] = useState(false);
  // Re-evaluated every 30 seconds so swipe actions disappear when a message's 20 minutes are over.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const [editing, setEditing] = useState<Message | null>(null);
  const sendingRef = useRef(false);
  const list = useRef<FlatList<Item>>(null);

  const targetPropertyId = thread?.conversation.propertyId ?? propertyParam ?? null;
  const origin: ContactOrigin = (CONTACT_ORIGINS as readonly string[]).includes(originParam ?? '') ? (originParam as ContactOrigin) : 'property_detail';

  // A draft for a home that already has a conversation opens that conversation instead.
  useEffect(() => {
    if (isNew && propertyParam) findForProperty(propertyParam).then((c) => c && setConversationId(c.id));
  }, [isNew, propertyParam, findForProperty]);

  useEffect(() => {
    let alive = true;
    if (targetPropertyId) propertyRepository.getById(targetPropertyId).then((p) => alive && setProperty(p));
    return () => {
      alive = false;
    };
  }, [targetPropertyId]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSendError(null);
    let r;
    if (editing) r = await editMessage(editing.id, body);
    else if (conversationId) r = await sendMessage(conversationId, body);
    else if (targetPropertyId) r = await startConversation(targetPropertyId, body, origin);
    else r = null;
    setSending(false);
    sendingRef.current = false;
    if (!r) return;
    if (!r.ok) {
      setSendError(r.error.message);
      return;
    }
    setDraft('');
    if (editing) {
      setEditing(null);
      await reload();
    } else if (!conversationId && 'conversation' in r.value) setConversationId(r.value.conversation.id);
    else await reload();
  };
  // The email gate: unverified -> verify screen; after verifying, the pending message is sent automatically.
  const gated = useGatedSubmit('message', send);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    let last = '';
    const now = new Date();
    for (const m of thread?.messages ?? []) {
      const label = dayLabel(m.createdAt, now);
      const day = new Date(m.createdAt).toDateString();
      if (day !== last) {
        out.push({ kind: 'day', key: `day-${day}`, label });
        last = day;
      }
      out.push({ kind: 'message', key: m.id, message: m });
    }
    return out;
  }, [thread]);

  // Status cards that a newer card of the same viewing request has replaced: shown toned down, still readable.
  const superseded = useMemo(() => supersededCardIds(thread?.messages ?? []), [thread]);
  const lastMine = useMemo(() => [...(thread?.messages ?? [])].reverse().find((m) => m.senderId === user?.id && m.kind === 'text')?.id, [thread, user?.id]);
  const name = property?.owner.displayName ?? 'Landlord';

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe}>
        <ContentContainer style={{ gap: spacing.md, paddingTop: spacing.md }}>
          <BackButton />
          <Text style={styles.title}>This conversation isn’t available</Text>
        </ContentContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
          {conversationId ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Conversation options" onPress={() => setHeaderMenu((o) => !o)} style={styles.moreBtn}>
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
        {headerMenu && conversationId ? (
          <View style={styles.hideMenu}>
            {/* The menu always reflects the real state: a hidden conversation offers "Unhide", a normal one offers "Hide". */}
            {thread?.hidden ? (
              <Pressable
                accessibilityRole="button"
                style={styles.menuRow}
                onPress={async () => {
                  const r = await unhideConversation(conversationId);
                  setHeaderMenu(false);
                  if (r.ok) await reload();
                  else setSendError(r.error.message);
                }}>
                <Ionicons name="eye-outline" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuText}>Unhide this conversation</Text>
                  <Text style={styles.menuFine}>Moves it back to your normal Messages list.</Text>
                </View>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                style={styles.menuRow}
                onPress={async () => {
                  const r = await hideConversation(conversationId);
                  setHeaderMenu(false);
                  if (r.ok) router.back();
                  else setSendError(r.error.message);
                }}>
                <Ionicons name="eye-off-outline" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuText}>Hide this conversation</Text>
                  <Text style={styles.menuFine}>Only removes it from your inbox. {name} still sees it, and it comes back if either of you writes again.</Text>
                </View>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" style={styles.menuRow} onPress={() => { setHeaderMenu(false); setConfirmDeleteConversation(true); }}>
              <Ionicons name="trash-outline" size={18} color="#D64545" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuText, { color: '#D64545' }]}>Delete this conversation</Text>
                <Text style={styles.menuFine}>Clears your copy of the messages. {name} keeps the full history. If they write again, you start from a fresh conversation.</Text>
              </View>
            </Pressable>
          </View>
        ) : null}
        {property ? (
          <View style={styles.strip}>
            <ContentContainer>
              <PropertyStrip property={property} />
            </ContentContainer>
          </View>
        ) : null}

        <View style={styles.body}>
          {loading && conversationId ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : (
            <FlatList
              ref={list}
              data={items}
              keyExtractor={(i) => i.key}
              contentContainerStyle={{ paddingVertical: spacing.md, flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>Start the conversation</Text>
                  <Text style={styles.empty}>Ask {name} a question about this home, or suggest a time to see it. You can also send a formal viewing request from the + menu.</Text>
                </View>
              }
              extraData={[now, openRowId]}
              renderItem={({ item }) => {
                if (item.kind === 'day') return <Text style={styles.day}>{item.label}</Text>;
                const m = item.message;
                if (m.kind === 'viewing_event') {
                  return (
                    <View style={styles.cardWrap}>
                      <ViewingEventCard message={m} siblings={thread?.messages ?? []} superseded={superseded.has(m.id)} />
                    </View>
                  );
                }
                const mine = m.senderId === user?.id;
                const bubble = <MessageBubble message={m} mine={mine} read={mine && m.id === lastMine && isReadByCounterpart(m, thread?.counterpartLastReadAt ?? null)} />;
                // Own normal messages can be edited or deleted for 20 minutes after they were sent: swipe LEFT (a right swipe is the
                // screen's back gesture, so it is never used on a message).
                if (!(user && canModifyMessage(m, user.id, now))) return bubble;
                return (
                  <SwipeableRow
                    direction="left"
                    backgroundColor={colors.background}
                    open={openRowId === m.id}
                    onOpenChange={(o) => setOpenRowId(o ? m.id : null)}
                    actions={[
                      { key: 'edit', label: 'Edit', tone: 'primary', onPress: () => { setEditing(m); setDraft(m.body); setSendError(null); } },
                      { key: 'delete', label: 'Delete', tone: 'danger', onPress: () => setConfirmDeleteId(m.id) },
                    ]}>
                    {bubble}
                  </SwipeableRow>
                );
              }}
            />
          )}
        </View>

        {menuOpen && targetPropertyId ? (
          <View style={styles.menu}>
            <Pressable accessibilityRole="button" style={styles.menuRow} onPress={() => { setMenuOpen(false); router.push({ pathname: '/request-viewing', params: { propertyId: targetPropertyId, origin: 'conversation' } }); }}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={styles.menuText}>Request a physical viewing</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.menuRow} onPress={() => { setMenuOpen(false); router.push({ pathname: '/apply/[propertyId]', params: { propertyId: targetPropertyId, origin: 'conversation' } }); }}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              <Text style={styles.menuText}>Apply to rent</Text>
            </Pressable>
          </View>
        ) : null}

        {editing ? (
          <View style={styles.editBar}>
            <Text style={styles.editText}>Editing message</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel editing" onPress={() => { setEditing(null); setDraft(''); }} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>
        ) : null}
        {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
        <View style={styles.composer}>
          <Pressable accessibilityRole="button" accessibilityLabel="More actions" onPress={() => setMenuOpen((o) => !o)} style={styles.plus}>
            <Ionicons name={menuOpen ? 'close' : 'add'} size={22} color={colors.text} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={(t) => { setDraft(t); if (sendError) setSendError(null); }}
            placeholder="Write a message…"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Message"
            style={styles.input}
            multiline
            maxLength={MESSAGE_MAX_LENGTH}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Save changed message' : 'Send message'}
            accessibilityState={{ disabled: !draft.trim() || sending }}
            disabled={!draft.trim() || sending}
            onPress={gated.trigger}
            style={[styles.send, (!draft.trim() || sending) && { opacity: 0.5 }]}>
            {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name={editing ? 'checkmark' : 'paper-plane-outline'} size={20} color="#fff" />}
          </Pressable>
        </View>
        <ConfirmDialog
          visible={confirmDeleteId !== null}
          title="Delete this message?"
          message={`It disappears completely for both of you and cannot be brought back. Messages can only be deleted within ${MESSAGE_CHANGE_WINDOW_MINUTES} minutes of sending.`}
          confirmLabel="Delete message"
          destructive
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={async () => {
            const id = confirmDeleteId;
            setConfirmDeleteId(null);
            if (!id) return;
            const r = await deleteMessage(id);
            if (!r.ok) setSendError(r.error.message);
            await reload();
          }}
        />
        <ConfirmDialog
          visible={confirmDeleteConversation}
          title="Delete this conversation?"
          message={`Your old messages and viewing updates are cleared from your view. ${name} keeps the full history. If they write again, you will only see the new message.`}
          confirmLabel="Delete conversation"
          destructive
          onCancel={() => setConfirmDeleteConversation(false)}
          onConfirm={async () => {
            setConfirmDeleteConversation(false);
            if (!conversationId) return;
            const r = await deleteConversation(conversationId);
            if (r.ok) router.back();
            else setSendError(r.error.message);
          }}
        />
        {gated.sheet}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  headerTitle: { flex: 1, fontSize: 20, color: colors.text },
  title: { fontSize: 20, color: colors.text },
  strip: { backgroundColor: '#fff', paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  body: { flex: 1, backgroundColor: colors.background },
  day: { alignSelf: 'center', fontSize: 11, color: colors.muted, marginVertical: spacing.sm },
  cardWrap: { paddingHorizontal: 16, paddingVertical: 4 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  empty: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },
  moreBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  hideMenu: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: spacing.md },
  menuFine: { fontSize: 11, color: colors.muted, marginTop: 2 },
  editBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.mint, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  editText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  menu: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.md },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 },
  menuText: { fontSize: 14, fontWeight: '600', color: colors.text },
  error: { fontSize: 12, color: '#D64545', paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: '#fff' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.sm, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border },
  plus: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 14, color: colors.text },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});

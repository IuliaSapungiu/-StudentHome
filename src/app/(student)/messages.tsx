import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { ContentContainer } from '@/components/ContentContainer';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SwipeableRow } from '@/components/SwipeableRow';
import { ConversationRow } from '@/components/messages/ConversationRow';
import { usePropertiesById } from '@/hooks/use-properties-by-ids';
import { RequireAccount } from '@/features/session/RequireAccount';
import { useMessaging } from '@/features/messaging/MessagingProvider';
import { matchesSearch, previewOf } from '@/features/messaging/messagingLogic';

// The student's conversations. They start from a home's page ("Message landlord"), so there is no compose button here.
export default function MessagesScreen() {
  return (
    <RequireAccount>
      <Content />
    </RequireAccount>
  );
}

function Content() {
  const router = useRouter();
  const { conversations, hiddenConversations, ready, refresh, unhideConversation, hideConversation, deleteConversation } = useMessaging();
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { byId } = usePropertiesById([...conversations, ...hiddenConversations].map((c) => c.conversation.propertyId));
  const [showHidden, setShowHidden] = useState(false);
  // Events can arrive while this tab is in the background (a viewing update, a landlord reply): refresh on focus.
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const [query, setQuery] = useState('');

  const shown = useMemo(
    () =>
      conversations.filter((s) => {
        const p = byId[s.conversation.propertyId];
        return matchesSearch([p?.owner.displayName, p?.title, p?.area, p?.city, previewOf(s.lastMessage)], query);
      }),
    [conversations, byId, query],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={shown}
        keyExtractor={(s) => s.conversation.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListHeaderComponent={
          <ContentContainer style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
            <Text style={styles.title}>Messages</Text>
            <View style={styles.search}>
              <Ionicons name="search-outline" size={18} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search conversations"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Search conversations"
                style={styles.input}
                returnKeyType="search"
                autoCorrect={false}
              />
            </View>
          </ContentContainer>
        }
        extraData={openId}
        renderItem={({ item }) => (
          <ContentContainer>
            {/* Swipe right: Hide (reversible) or Delete (from your own inbox only). Neither touches the other person's copy. */}
            <SwipeableRow
              open={openId === item.conversation.id}
              onOpenChange={(o) => setOpenId(o ? item.conversation.id : null)}
              actions={[
                { key: 'hide', label: 'Hide', tone: 'neutral', onPress: () => hideConversation(item.conversation.id) },
                { key: 'delete', label: 'Delete', tone: 'danger', onPress: () => setConfirmDelete(item.conversation.id) },
              ]}>
              <ConversationRow
                summary={item}
                property={byId[item.conversation.propertyId]}
                onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: item.conversation.id } })}
              />
            </SwipeableRow>
          </ContentContainer>
        )}
        ListFooterComponent={
          hiddenConversations.length > 0 ? (
            <ContentContainer style={{ gap: spacing.sm, paddingTop: spacing.md }}>
              <Text accessibilityRole="button" onPress={() => setShowHidden((o) => !o)} style={styles.hiddenToggle}>
                {showHidden ? 'Hide hidden conversations' : `Hidden conversations (${hiddenConversations.length})`}
              </Text>
              {showHidden
                ? hiddenConversations.map((s) => (
                    <SwipeableRow
                      key={s.conversation.id}
                      open={openId === s.conversation.id}
                      onOpenChange={(o) => setOpenId(o ? s.conversation.id : null)}
                      actions={[
                        { key: 'unhide', label: 'Unhide', tone: 'primary', onPress: () => unhideConversation(s.conversation.id) },
                        { key: 'delete', label: 'Delete', tone: 'danger', onPress: () => setConfirmDelete(s.conversation.id) },
                      ]}>
                      <ConversationRow summary={s} property={byId[s.conversation.propertyId]} onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: s.conversation.id } })} />
                    </SwipeableRow>
                  ))
                : null}
            </ContentContainer>
          ) : undefined
        }
        ListEmptyComponent={
          ready ? (
            <ContentContainer>
              {conversations.length === 0 ? (
                <EmptyState icon="chatbubble-outline" title="No conversations yet" text="Open a home and tap “Message landlord” to ask a question or arrange a viewing." actionLabel="Browse homes" onAction={() => router.push('/search')} />
              ) : (
                <EmptyState icon="search-outline" title="No matches" text="Try a landlord’s name, a street or a word from the message." />
              )}
            </ContentContainer>
          ) : undefined
        }
      />
      <ConfirmDialog
        visible={confirmDelete !== null}
        title="Delete this conversation?"
        message="It is removed from your inbox and Hidden list only. The other person keeps it, and it comes back if either of you sends a new message."
        confirmLabel="Delete conversation"
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const id = confirmDelete;
          setConfirmDelete(null);
          if (id) deleteConversation(id);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  title: { fontSize: 28, color: colors.text, marginTop: spacing.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 48 },
  hiddenToggle: { fontSize: 13, fontWeight: '700', color: colors.primary },
  hiddenRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unhide: { fontSize: 12, fontWeight: '700', color: colors.primary },
  input: { flex: 1, fontSize: 14, color: colors.text, minHeight: 48 },
});

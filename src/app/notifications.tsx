import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { BackButton } from '@/components/BackButton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SwipeableRow } from '@/components/SwipeableRow';
import { ContentContainer } from '@/components/ContentContainer';
import { EmptyState } from '@/components/EmptyState';
import { listStamp } from '@/lib/dateTime';
import { RequireAccount } from '@/features/session/RequireAccount';
import { useNotifications } from '@/features/notifications/NotificationsProvider';
import { notificationTarget } from '@/features/notifications/notificationLogic';
import type { AppNotification } from '@/features/notifications/types';
import { viewingHref } from '@/features/viewings/viewingRules';

// In-app notifications for viewing and application updates. Local to this device (no push, email or SMS).
export default function NotificationsScreen() {
  return (
    <RequireAccount>
      <Content />
    </RequireAccount>
  );
}

function Content() {
  const router = useRouter();
  const { notifications, unreadCount, ready, refresh, markRead, markAllRead, deleteNotification, deleteAll } = useNotifications();
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const open = async (n: AppNotification) => {
    await markRead(n.id);
    const target = notificationTarget(n);
    if (target.screen === 'viewing') router.push(viewingHref(target.viewingId));
    else router.push({ pathname: '/application/[id]', params: { id: target.applicationId } });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl * 2 }} showsVerticalScrollIndicator={false}>
        <ContentContainer maxWidth={640} style={{ gap: spacing.md }}>
          <View style={styles.header}>
            <BackButton />
            <Text style={styles.title}>Notifications</Text>
          </View>
          {notifications.length > 0 ? (
            <View style={styles.toolbar}>
              {unreadCount > 0 ? <Text accessibilityRole="button" onPress={markAllRead} style={styles.markAll}>Mark all as read</Text> : <View />}
              <Text accessibilityRole="button" onPress={() => setConfirmAll(true)} style={styles.deleteAll}>Delete all</Text>
            </View>
          ) : null}

          {ready && notifications.length === 0 ? (
            <EmptyState icon="notifications-outline" title="No notifications yet" text="Updates about your viewings and rental applications appear here, for example when a landlord confirms a viewing." />
          ) : null}

          {notifications.map((n) => {
            const unread = n.readAt === null;
            return (
              <SwipeableRow
                key={n.id}
                backgroundColor={colors.background}
                open={openId === n.id}
                onOpenChange={(o) => setOpenId(o ? n.id : null)}
                actions={[{ key: 'delete', label: 'Delete', tone: 'danger', onPress: () => deleteNotification(n.id) }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${unread ? 'Unread. ' : ''}${n.title}. ${n.body}`}
                onPress={() => open(n)}
                style={[styles.card, unread && styles.cardUnread]}>
                <View style={styles.icon}>
                  <Ionicons name={n.entityType === 'viewing' ? 'calendar-outline' : 'document-text-outline'} size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.top}>
                    <Text style={styles.cardTitle}>{n.title}</Text>
                    <Text style={styles.time}>{listStamp(n.createdAt, new Date())}</Text>
                  </View>
                  <Text style={styles.body}>{n.body}</Text>
                  <View style={styles.tags}>
                    {n.actionRequired ? <Text style={styles.action}>Action needed</Text> : null}
                    {n.simulated ? <Text style={styles.demo}>Demo</Text> : null}
                  </View>
                </View>
                {unread ? <View style={styles.dot} accessibilityLabel="Unread" /> : null}
              </Pressable>
              </SwipeableRow>
            );
          })}
        </ContentContainer>
      </ScrollView>
      <ConfirmDialog
        visible={confirmAll}
        title="Delete all notifications?"
        message="This removes every notification in your list. It does not change your viewings, applications or messages."
        confirmLabel="Delete all"
        destructive
        onCancel={() => setConfirmAll(false)}
        onConfirm={() => {
          setConfirmAll(false);
          void deleteAll();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  title: { flex: 1, fontSize: 24, color: colors.text },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  markAll: { fontSize: 12, fontWeight: '700', color: colors.primary },
  deleteAll: { fontSize: 12, fontWeight: '700', color: '#D64545' },
  card: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  cardUnread: { borderColor: colors.primary },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  time: { fontSize: 11, color: colors.muted },
  body: { fontSize: 13, color: colors.text, lineHeight: 18 },
  tags: { flexDirection: 'row', gap: spacing.sm },
  action: { fontSize: 11, fontWeight: '700', color: '#2B55A6' },
  demo: { fontSize: 11, fontWeight: '700', color: '#8A5A00' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D64545', marginTop: 4 },
});

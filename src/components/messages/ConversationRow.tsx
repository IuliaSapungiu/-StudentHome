import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PropertyImage } from '@/components/PropertyImage';
import { colors, spacing } from '@/theme';
import type { Property } from '@/data';
import { listStamp } from '@/lib/dateTime';
import { previewOf } from '@/features/messaging/messagingLogic';
import type { ConversationSummary } from '@/features/messaging/types';

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

type Props = { summary: ConversationSummary; property: Property | undefined; onPress: () => void };

// One row of the Messages list: avatar, landlord, home, last message, time and unread count.
export function ConversationRow({ summary, property, onPress }: Props) {
  const name = property?.owner.displayName ?? 'Landlord';
  const stamp = summary.lastMessage?.createdAt ?? summary.conversation.createdAt;
  const unread = summary.unreadCount;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${property?.title ?? 'listing no longer available'}${unread ? `, ${unread} unread` : ''}`}
      onPress={onPress}
      style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(name)}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.time}>{listStamp(stamp, new Date())}</Text>
        </View>
        <View style={styles.home}>
          {property ? <PropertyImage compact uri={property.images[0]} style={styles.thumb} /> : null}
          <Text style={styles.homeText} numberOfLines={1}>
            {property ? `${property.title} · ${property.area}` : 'This listing is no longer available'}
          </Text>
        </View>
        <View style={styles.top}>
          <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
            {summary.lastMessage?.simulated ? 'Demo · ' : ''}{previewOf(summary.lastMessage)}
          </Text>
          {unread > 0 ? (
            <View style={styles.badge} accessibilityLabel={`${unread} unread`}>
              <Text style={styles.badgeText}>{unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  time: { fontSize: 11, color: colors.muted },
  home: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thumb: { width: 20, height: 20, borderRadius: 4, backgroundColor: colors.mint },
  homeText: { flex: 1, fontSize: 11, color: colors.primary },
  preview: { flex: 1, fontSize: 12, color: colors.muted },
  previewUnread: { color: colors.text, fontWeight: '600' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
});

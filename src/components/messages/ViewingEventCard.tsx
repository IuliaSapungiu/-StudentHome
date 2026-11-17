import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { useViewings } from '@/features/viewings/ViewingsProvider';
import { viewingHref } from '@/features/viewings/viewingRules';
import { eventCardLines, eventCardSnapshot } from '@/features/messaging/messagingLogic';
import type { Message } from '@/features/messaging/types';

// Status card for a FORMAL viewing event, shown inside the conversation. It tells ONLY its own event, from the
// snapshot saved when the event happened (the date-time, the time it replaced, and the status right after it).
// It never reads the viewing's current times or status, so a card from last week still says what it said then.
// Viewings is the place for the current state and the full history; tapping the card opens that exact viewing.
export function ViewingEventCard({ message, siblings }: { message: Message; siblings: Message[] }) {
  const router = useRouter();
  const { viewings } = useViewings();
  const viewing = viewings.find((v) => v.id === message.viewingRequestId);
  // `viewing` is used only to fill in OLD cards that predate snapshots, from that viewing's immutable history entry.
  const snapshot = eventCardSnapshot(message, viewing, siblings);
  const lines = eventCardLines(snapshot);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${snapshot.label}${lines.primary ? `, ${lines.primary}` : ''}${lines.secondary ? `. ${lines.secondary}` : ''}. Open this viewing`}
      onPress={() => message.viewingRequestId && router.push(viewingHref(message.viewingRequestId))}
      style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>{snapshot.label}{message.simulated ? ' · Demo' : ''}</Text>
        {lines.primary ? <Text style={styles.time}>{lines.primary}</Text> : null}
        {lines.secondary ? <Text style={styles.sub}>{lines.secondary}</Text> : null}
        {lines.status ? <Text style={styles.sub}>{lines.status}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary + '55', padding: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13, fontWeight: '700', color: colors.text },
  time: { fontSize: 13, color: colors.text },
  sub: { fontSize: 11, color: colors.muted },
});

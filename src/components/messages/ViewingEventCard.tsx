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
//
// `superseded` is true when a NEWER card of the same viewing request exists (see supersededCardIds). Such a card stays fully
// readable and tappable but is toned down: grey surface, no green accent, darker-grey text (contrast 5.8:1 or more on its
// background, so it passes WCAG AA) and a small "Earlier update" label, so the meaning never depends on colour alone.
export function ViewingEventCard({ message, siblings, superseded = false }: { message: Message; siblings: Message[]; superseded?: boolean }) {
  const router = useRouter();
  const { viewings } = useViewings();
  const viewing = viewings.find((v) => v.id === message.viewingRequestId);
  // `viewing` is used only to fill in OLD cards that predate snapshots, from that viewing's immutable history entry.
  const snapshot = eventCardSnapshot(message, viewing, siblings);
  const lines = eventCardLines(snapshot);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${superseded ? 'Earlier update, replaced by a newer one. ' : ''}${snapshot.label}${lines.primary ? `, ${lines.primary}` : ''}${lines.secondary ? `. ${lines.secondary}` : ''}. Open this viewing`}
      onPress={() => message.viewingRequestId && router.push(viewingHref(message.viewingRequestId))}
      style={[styles.card, superseded ? styles.cardOld : null]}>
      <View style={[styles.icon, superseded ? styles.iconOld : null]}>
        <Ionicons name="calendar-outline" size={20} color={superseded ? OLD_TEXT : colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        {superseded ? <Text style={styles.oldTag}>Earlier update</Text> : null}
        <Text style={[styles.title, superseded ? styles.textOld : null]}>{snapshot.label}{message.simulated ? ' · Demo' : ''}</Text>
        {lines.primary ? <Text style={[styles.time, superseded ? styles.textOld : null]}>{lines.primary}</Text> : null}
        {lines.secondary ? <Text style={[styles.sub, superseded ? styles.subOld : null]}>{lines.secondary}</Text> : null}
        {lines.status ? <Text style={[styles.sub, superseded ? styles.subOld : null]}>{lines.status}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={superseded ? OLD_TEXT : colors.text} />
    </Pressable>
  );
}

// Toned-down colours for a superseded card (contrast on colors.background #F6F8F5: 6.9:1 and 5.9:1).
const OLD_TEXT = '#4A5851';
const OLD_SUB = '#55625B';

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary + '55', padding: spacing.md },
  cardOld: { backgroundColor: colors.background, borderColor: colors.border },
  iconOld: { backgroundColor: colors.border },
  textOld: { color: OLD_TEXT, fontWeight: '600' },
  subOld: { color: OLD_SUB },
  oldTag: { fontSize: 11, fontWeight: '700', color: OLD_SUB, textTransform: 'uppercase', letterSpacing: 0.4 },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13, fontWeight: '700', color: colors.text },
  time: { fontSize: 13, color: colors.text },
  sub: { fontSize: 11, color: colors.muted },
});

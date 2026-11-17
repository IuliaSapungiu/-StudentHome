import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';
import { formatClock } from '@/lib/dateTime';
import type { Message } from '@/features/messaging/types';

type Props = { message: Message; mine: boolean; read: boolean };

// One normal text message. Editing and deleting (own messages, first 20 minutes) is done by swiping the row, which
// the chat screen wraps around this bubble; there is no "deleted" placeholder because deleting removes the message.
export function MessageBubble({ message, mine, read }: Props) {
  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        {message.simulated ? <Text style={styles.demo}>Demo reply (simulated landlord)</Text> : null}
        <Text style={styles.body}>{message.body}</Text>
        <Text style={styles.meta}>
          {formatClock(message.createdAt)}
          {message.editedAt ? `  ·  Edited ${formatClock(message.editedAt)}` : ''}
          {mine && read ? '  Read' : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 4 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  mine: { backgroundColor: colors.mint },
  theirs: { backgroundColor: '#fff' },
  body: { fontSize: 14, color: colors.text, lineHeight: 20 },
  meta: { fontSize: 10, color: colors.muted, alignSelf: 'flex-end' },
  demo: { fontSize: 10, fontWeight: '700', color: '#8A5A00' },
});

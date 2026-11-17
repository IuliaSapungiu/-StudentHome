import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { APPLICATION_NOTICE } from '@/features/applications/applicationRules';

// Shown on the application form, the confirmation and the details screen: an application is not a booking.
export function ApplicationNotice() {
  return (
    <View style={styles.notice}>
      <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
      <View style={{ flex: 1, gap: 4 }}>
        {APPLICATION_NOTICE.map((line) => (
          <Text key={line} style={styles.text}>{line}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.mint, borderRadius: radius.md, padding: spacing.md },
  text: { fontSize: 12, color: colors.text, lineHeight: 17 },
});

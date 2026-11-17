import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';

export type BadgeTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';
const PALETTE: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: colors.mint, fg: colors.primary },
  warning: { bg: colors.warning, fg: '#8A5A00' },
  info: { bg: '#E3ECFB', fg: '#2B55A6' },
  danger: { bg: '#FBE4E4', fg: '#B03030' },
  neutral: { bg: '#EEF1EE', fg: colors.muted },
};

// Small status chip for viewings and applications (the verification chip is StatusPill).
export function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  const c = PALETTE[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 11, fontWeight: '700' },
});

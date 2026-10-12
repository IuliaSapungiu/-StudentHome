import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';
import { STATUS_LABEL } from '@/features/verification/verificationRules';
import type { VerificationStatus } from '@/features/verification/types';

const PALETTE: Record<VerificationStatus, { bg: string; fg: string }> = {
  not_started: { bg: '#EEF1EE', fg: colors.muted },
  pending: { bg: colors.warning, fg: '#8A5A00' },
  verified: { bg: colors.mint, fg: colors.primary },
  rejected: { bg: '#FBE4E4', fg: '#B03030' },
  failed: { bg: '#FBE4E4', fg: '#B03030' },
  more_info_required: { bg: '#E3ECFB', fg: '#2B55A6' },
};

/** Status chip. `simulated` marks demo results so they are never mistaken for real verification. */
export function StatusPill({ status, simulated = false }: { status: VerificationStatus; simulated?: boolean }) {
  const c = PALETTE[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>
        {STATUS_LABEL[status]}
        {simulated && status !== 'not_started' ? ' · simulated' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 11, fontWeight: '700' },
});

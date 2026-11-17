import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** Red confirm button for actions that cannot be undone. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// A confirmation dialog that works on iOS, Android and web (Alert.alert does nothing on web).
export function ConfirmDialog({ visible, title, message, confirmLabel, destructive, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} accessibilityViewIsModal>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Cancel" style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttons}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.btn, styles.cancel]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onConfirm} style={[styles.btn, { backgroundColor: destructive ? '#D64545' : colors.primary }]}>
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  message: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  btn: { flex: 1, minHeight: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: colors.background },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.text },
  confirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

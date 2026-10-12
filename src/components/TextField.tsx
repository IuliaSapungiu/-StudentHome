import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius } from '@/theme';

type Props = TextInputProps & { label: string; error?: string | null; hint?: string; marker?: 'required' | 'optional' };

export function TextField({ label, error, hint, marker, style, ...input }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {marker === 'required' ? <Text style={styles.required}> *</Text> : null}
        {marker === 'optional' ? <Text style={styles.optional}> (optional)</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, fontSize: 15, color: colors.text, backgroundColor: '#fff' },
  inputError: { borderColor: '#D64545' },
  required: { color: '#D64545' },
  optional: { fontWeight: '400', color: colors.muted },
  error: { fontSize: 12, color: '#D64545' },
  hint: { fontSize: 12, color: colors.muted },
});

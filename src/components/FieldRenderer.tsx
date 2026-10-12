import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';
import { Checkbox } from '@/components/Checkbox';
import { TextField } from '@/components/TextField';
import type { FieldDefinition, FieldValue } from '@/features/forms/types';

type Props = {
  field: FieldDefinition;
  value: FieldValue;
  required: boolean;
  error?: string | null;
  onChange: (value: string | boolean) => void;
};

// Renders one field from a form definition (see features/forms). Provider onboarding reuses this in Step 4.
export function FieldRenderer({ field, value, required, error, onChange }: Props) {
  if (field.type === 'boolean') {
    return (
      <View style={{ gap: 6 }}>
        <Checkbox checked={value === true} onChange={onChange} error={!!error}>
          <Text style={styles.checkLabel}>{field.label}{required ? ' *' : ''}</Text>
        </Checkbox>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }
  if (field.type === 'select') {
    return (
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>
          {field.label}
          {required ? <Text style={{ color: '#D64545' }}> *</Text> : <Text style={styles.optional}> (optional)</Text>}
        </Text>
        <View style={styles.chips}>
          {field.options?.map((o) => (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: value === o.value }}
              onPress={() => onChange(o.value)}
              style={[styles.chip, value === o.value && styles.chipOn]}>
              <Text style={[styles.chipText, value === o.value && { color: colors.primary }]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : field.hint ? <Text style={styles.hint}>{field.hint}</Text> : null}
      </View>
    );
  }
  return (
    <TextField
      label={field.label}
      marker={required ? 'required' : 'optional'}
      placeholder={field.placeholder}
      hint={field.hint}
      error={error}
      value={typeof value === 'string' ? value : ''}
      onChangeText={onChange}
      secureTextEntry={field.type === 'password'}
      autoCapitalize={field.type === 'email' || field.type === 'url' || field.type === 'password' ? 'none' : field.type === 'cui' || field.type === 'onrc' ? 'characters' : field.type === 'name' ? 'words' : 'sentences'}
      keyboardType={field.type === 'email' ? 'email-address' : field.type === 'phone' ? 'phone-pad' : field.type === 'number' ? 'number-pad' : field.type === 'url' ? 'url' : 'default'}
      autoComplete={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'password' ? 'new-password' : 'off'}
    />
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  optional: { fontWeight: '400', color: colors.muted },
  hint: { fontSize: 12, color: colors.muted },
  error: { fontSize: 12, color: '#D64545' },
  checkLabel: { fontSize: 13, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.mint },
  chipText: { fontSize: 13, color: colors.text },
});

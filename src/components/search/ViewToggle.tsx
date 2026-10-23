import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@/theme';
import type { SearchView } from '@/features/search/searchState';

type Props = { view: SearchView; onChange: (view: SearchView) => void; bottom: number };

// Floating pill: shows the OTHER view ("Map" while listing, "List" while on the map).
export function ViewToggle({ view, onChange, bottom }: Props) {
  const toMap = view === 'list';
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={toMap ? 'Show map' : 'Show list'}
        onPress={() => onChange(toMap ? 'map' : 'list')}
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.85 }]}>
        <Ionicons name={toMap ? 'location-outline' : 'list-outline'} size={18} color="#fff" />
        <Text style={styles.text}>{toMap ? 'Map' : 'List'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primaryDark, paddingHorizontal: 20, height: 44, borderRadius: radius.pill, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  text: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

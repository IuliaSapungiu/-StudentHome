import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/theme';
import type { PropertyMapProps } from './PropertyMap.types';

// Web fallback. The native map library is not loaded on web at all (it is imported only by
// PropertyMap.tsx, which Metro never bundles for web), so Search keeps working there.
export default function PropertyMap({ properties, onShowList }: PropertyMapProps) {
  return (
    <View style={styles.box}>
      <View style={styles.icon}>
        <Ionicons name="map-outline" size={28} color={colors.primary} />
      </View>
      <Text style={styles.title}>Map view is available in the StudentHome mobile app</Text>
      <Text style={styles.text}>
        {properties.length} {properties.length === 1 ? 'home matches' : 'homes match'} your search. Use the list to browse them here.
      </Text>
      {onShowList && (
        <View style={{ width: '100%', maxWidth: 260 }}>
          <Button label="Back to list" onPress={onShowList} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.mint },
  icon: { width: 60, height: 60, borderRadius: radius.lg, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center' },
  text: { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: spacing.sm },
});

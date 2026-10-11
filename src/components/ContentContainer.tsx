import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useResponsive } from '@/hooks/use-responsive';

type Props = { children: ReactNode; padded?: boolean; maxWidth?: number; style?: StyleProp<ViewStyle> };

// Centres content and caps its width on tablets; on phones it is simply full width.
export function ContentContainer({ children, padded = true, maxWidth, style }: Props) {
  const { gutter, contentMaxWidth } = useResponsive();
  return (
    <View
      style={[
        { width: '100%', maxWidth: maxWidth ?? contentMaxWidth, alignSelf: 'center' },
        padded ? { paddingHorizontal: gutter } : null,
        style,
      ]}>
      {children}
    </View>
  );
}

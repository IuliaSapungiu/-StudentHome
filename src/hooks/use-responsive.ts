import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { getLayout, type Layout } from '@/theme/responsive';

export type Responsive = Layout & { width: number; height: number };

// Recomputes on rotation, split-screen and window resizes (tablets).
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  return useMemo(() => ({ ...getLayout(width, height), width, height }), [width, height]);
}

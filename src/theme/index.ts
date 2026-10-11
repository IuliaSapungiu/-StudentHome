// Design tokens taken from the Figma "Modern Marketplace" screens.
// Adjust the hex values to match Figma exactly (use the eyedropper in Figma).
export const colors = {
  primary: '#1B7A4B',
  primaryDark: '#1B3F2E',
  mint: '#E8F2EA',
  background: '#F6F8F5',
  surface: '#FFFFFF',
  text: '#12201A',
  muted: '#6B7A72',
  border: '#E3E8E4',
  warning: '#FFF1D6',
};

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export { breakpoints, getLayout } from './responsive';
export type { Layout, DeviceClass } from './responsive';

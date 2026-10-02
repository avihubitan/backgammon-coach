import type { TextStyle } from 'react-native';

export const fontFamilies = {
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const typography = {
  hero: { fontFamily: fontFamilies.extrabold, fontSize: 40, lineHeight: 46, letterSpacing: -1 },
  display: { fontFamily: fontFamilies.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: fontFamilies.extrabold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  heading: { fontFamily: fontFamilies.bold, fontSize: 19, lineHeight: 25, letterSpacing: -0.1 },
  subheading: { fontFamily: fontFamilies.bold, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: fontFamilies.medium, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fontFamilies.semibold, fontSize: 16, lineHeight: 23 },
  callout: { fontFamily: fontFamilies.semibold, fontSize: 18, lineHeight: 25 },
  small: { fontFamily: fontFamilies.medium, fontSize: 14, lineHeight: 20 },
  smallStrong: { fontFamily: fontFamilies.semibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fontFamilies.semibold, fontSize: 12, lineHeight: 16 },
  label: {
    fontFamily: fontFamilies.extrabold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  button: { fontFamily: fontFamilies.extrabold, fontSize: 16, lineHeight: 20, letterSpacing: 0.6 },
  number: { fontFamily: fontFamilies.extrabold, fontSize: 18, lineHeight: 22, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export { boardColors, colors, type ColorToken } from './colors';
export { fontFamilies, typography, type TypographyVariant } from './typography';

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  pill: 999,
} as const;

/** Standard horizontal gutter for screens. */
export const SCREEN_GUTTER = 20;

/** Max width for content on tablets / web so layouts stay phone-shaped. */
export const MAX_CONTENT_WIDTH = 520;

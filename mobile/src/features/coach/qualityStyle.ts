import { colors } from '@/theme';

import type { QualityBand } from './playQuality';

/** Greens for strong play, warm tones below; never red, a low score is a starting point. */
export const BAND_COLOR: Record<QualityBand, string> = {
  excellent: colors.success,
  strong: '#8FDDB4',
  solid: colors.primary,
  developing: colors.streak,
  learning: colors.info,
};

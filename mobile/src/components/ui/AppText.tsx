import { Text, type TextProps, type TextStyle } from 'react-native';

import { colors, typography, type ColorToken, type TypographyVariant } from '@/theme';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  /** A theme colour token or any CSS colour. */
  color?: ColorToken | (string & {});
  align?: TextStyle['textAlign'];
}

/**
 * Text follows the system text size, up to this much larger: enough for large
 * accessibility sizes while keeping game layouts (board labels, buttons) intact.
 */
export const MAX_FONT_SCALE = 1.6;

export function AppText({ variant = 'body', color = 'text', align, style, ...rest }: AppTextProps) {
  const resolved = color in colors ? colors[color as ColorToken] : color;
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[typography[variant], { color: resolved }, align ? { textAlign: align } : null, style]}
    />
  );
}

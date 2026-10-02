import { Text, type TextProps, type TextStyle } from 'react-native';

import { colors, typography, type ColorToken, type TypographyVariant } from '@/theme';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  /** A theme colour token or any CSS colour. */
  color?: ColorToken | (string & {});
  align?: TextStyle['textAlign'];
}

export function AppText({ variant = 'body', color = 'text', align, style, ...rest }: AppTextProps) {
  const resolved = color in colors ? colors[color as ColorToken] : color;
  return (
    <Text
      {...rest}
      style={[typography[variant], { color: resolved }, align ? { textAlign: align } : null, style]}
    />
  );
}

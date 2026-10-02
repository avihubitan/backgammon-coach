import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { colors, type ColorToken } from '@/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorToken | (string & {});
}

export function Icon({ name, size = 22, color = 'text' }: IconProps) {
  const resolved = color in colors ? colors[color as ColorToken] : color;
  return <MaterialCommunityIcons name={name} size={size} color={resolved} />;
}

export const iconFont = MaterialCommunityIcons.font;

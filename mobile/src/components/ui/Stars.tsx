import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { Icon } from './Icon';

interface StarsProps {
  count: number;
  max?: number;
  size?: number;
  gap?: number;
}

export function Stars({ count, max = 3, size = 16, gap = 2 }: StarsProps) {
  return (
    <View
      style={[styles.row, { gap }]}
      accessibilityLabel={`${count} of ${max} stars`}
      accessibilityRole="image"
    >
      {Array.from({ length: max }, (_, index) => (
        <Icon
          key={index}
          name="star"
          size={size}
          color={index < count ? colors.star : colors.starEmpty}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});

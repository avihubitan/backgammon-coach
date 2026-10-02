import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface StatChipProps {
  icon: IconName;
  value: string | number;
  color: string;
  accessibilityLabel: string;
  muted?: boolean;
  testID?: string;
}

/** Compact pill for streak / XP counters in headers. */
export function StatChip({ icon, value, color, accessibilityLabel, muted, testID }: StatChipProps) {
  return (
    <View style={styles.chip} accessibilityLabel={accessibilityLabel} testID={testID}>
      <Icon name={icon} size={18} color={muted ? colors.textMuted : color} />
      <AppText variant="smallStrong" color={muted ? 'textMuted' : color}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

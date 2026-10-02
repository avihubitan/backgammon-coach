import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { haptics } from '@/services/haptics';
import { colors, spacing } from '@/theme';

import { AppText } from './AppText';

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}

export function ToggleRow({ label, description, value, onChange, testID }: ToggleRowProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => {
        haptics.tap();
        onChange(!value);
      }}
      style={styles.row}
    >
      <View style={styles.text}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? (
          <AppText variant="small" color="textSecondary">
            {description}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.track, { backgroundColor: value ? colors.success : colors.borderStrong }]}>
        <Animated.View
          style={[
            styles.knob,
            {
              transform: [{ translateX: value ? 20 : 0 }],
              transitionProperty: 'transform',
              transitionDuration: 180,
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  text: { flex: 1, gap: 2 },
  track: { width: 48, height: 28, borderRadius: 14, padding: 3 },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
});

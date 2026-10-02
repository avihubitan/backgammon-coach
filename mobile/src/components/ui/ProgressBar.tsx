import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors, radii } from '@/theme';

interface ProgressBarProps {
  /** 0..1 */
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
  style?: ViewStyle;
  /** Adds a soft highlight stripe to the fill for a more tactile look. */
  shine?: boolean;
  accessibilityLabel?: string;
}

export function ProgressBar({
  progress,
  color = colors.primary,
  trackColor = colors.surfaceRaised,
  height = 12,
  style,
  shine = true,
  accessibilityLabel,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height, backgroundColor: trackColor, borderRadius: height / 2 }, style]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            width: `${clamped * 100}%`,
            backgroundColor: color,
            borderRadius: height / 2,
            transitionProperty: 'width',
            transitionDuration: 600,
            transitionTimingFunction: 'ease-out',
          },
        ]}
      >
        {shine && clamped > 0.04 ? (
          <View style={[styles.shine, { top: height * 0.22, height: Math.max(2, height * 0.22), borderRadius: radii.pill }]} />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden', width: '100%' },
  fill: { height: '100%' },
  shine: {
    position: 'absolute',
    left: 6,
    right: 6,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
});

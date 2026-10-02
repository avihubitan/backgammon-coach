import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Stars } from '@/components/ui/Stars';
import { haptics } from '@/services/haptics';
import { colors, radii } from '@/theme';

import type { LessonStatus } from '../progression';

const SIZE = 74;

interface LessonNodeProps {
  icon: IconName;
  status: LessonStatus;
  stars: number;
  color: string;
  current: boolean;
  label: string;
  onPress: () => void;
  testID?: string;
}

/** One stop on the learning path. */
export function LessonNode({ icon, status, stars, color, current, label, onPress, testID }: LessonNodeProps) {
  const locked = status === 'locked';
  const completed = status === 'completed';
  const face = locked ? colors.locked : completed ? colors.primary : color;
  const edge = locked ? '#1D2129' : completed ? colors.primaryShadow : shade(color);
  return (
    <View style={styles.wrap}>
      {current ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bubble,
            {
              animationName: {
                from: { transform: [{ translateY: 0 }] },
                to: { transform: [{ translateY: -5 }] },
              },
              animationDuration: 700,
              animationIterationCount: 'infinite',
              animationDirection: 'alternate',
              animationTimingFunction: 'ease-in-out',
            },
          ]}
        >
          <AppText variant="caption" color={color}>
            {completed ? 'REVIEW' : 'START'}
          </AppText>
          <View style={styles.bubbleTail} />
        </Animated.View>
      ) : null}
      {current ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              borderColor: color,
              animationName: {
                from: { transform: [{ scale: 0.92 }], opacity: 0.9 },
                to: { transform: [{ scale: 1.12 }], opacity: 0.25 },
              },
              animationDuration: 1100,
              animationIterationCount: 'infinite',
              animationDirection: 'alternate',
            },
          ]}
        />
      ) : null}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${locked ? 'locked' : completed ? `completed with ${stars} stars` : 'available'}`}
        onPressIn={() => haptics.tap()}
        onPress={onPress}
      >
        {({ pressed }) => (
          <View style={[styles.edge, { backgroundColor: edge, paddingBottom: pressed ? 2 : 6, marginTop: pressed ? 4 : 0 }]}>
            <View style={[styles.face, { backgroundColor: face }]}>
              <Icon
                name={locked ? 'lock' : completed ? 'check-bold' : icon}
                size={locked ? 26 : 32}
                color={locked ? colors.lockedText : colors.textInverse}
              />
            </View>
          </View>
        )}
      </Pressable>
      <View style={styles.starsRow}>{completed ? <Stars count={stars} size={15} /> : null}</View>
    </View>
  );
}

/** Darker version of a hex colour for the 3D edge. */
function shade(hex: string): string {
  const value = hex.replace('#', '');
  const channel = (index: number) => Math.round(parseInt(value.slice(index, index + 2), 16) * 0.62);
  return `rgb(${channel(0)}, ${channel(2)}, ${channel(4)})`;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: SIZE + 30 },
  edge: { borderRadius: SIZE, width: SIZE },
  face: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    top: -8,
    width: SIZE + 16,
    height: SIZE + 16,
    borderRadius: SIZE,
    borderWidth: 3,
  },
  bubble: {
    position: 'absolute',
    top: -40,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    zIndex: 5,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -6,
    width: 10,
    height: 10,
    backgroundColor: colors.surfaceRaised,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderStrong,
    transform: [{ rotate: '45deg' }],
  },
  starsRow: { height: 22, justifyContent: 'center' },
});

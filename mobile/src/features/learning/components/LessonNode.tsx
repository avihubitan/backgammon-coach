import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ParticleBurst } from '@/components/fx/ParticleBurst';
import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Stars } from '@/components/ui/Stars';
import { feedback } from '@/services/feedback';
import { haptics } from '@/services/haptics';
import { colors, radii } from '@/theme';

import type { LessonStatus } from '../progression';

const SIZE = 74;
/** Diameter of a node's face, for laying out paths between nodes. */
export const NODE_FACE = SIZE;

/** How long a freshly unlocked node stays locked (rattling) before it opens. */
const REVEAL_MS = 1100;

interface LessonNodeProps {
  icon: IconName;
  status: LessonStatus;
  stars: number;
  color: string;
  current: boolean;
  label: string;
  /** Just unlocked: show it locked, rattle the padlock, then burst open. */
  revealing?: boolean;
  onRevealed?: () => void;
  onPress: () => void;
  testID?: string;
}

/** One stop on the learning path. */
export function LessonNode({
  icon,
  status,
  stars,
  color,
  current,
  label,
  revealing = false,
  onRevealed,
  onPress,
  testID,
}: LessonNodeProps) {
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!revealing) return;
    const timer = setTimeout(() => {
      setOpened(true);
      feedback.unlock();
    }, REVEAL_MS);
    const done = setTimeout(() => onRevealed?.(), REVEAL_MS + 900);
    return () => {
      clearTimeout(timer);
      clearTimeout(done);
    };
    // Reveal once per pending unlock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealing]);

  const hidden = revealing && !opened;
  const shownStatus: LessonStatus = hidden ? 'locked' : status;
  const locked = shownStatus === 'locked';
  const premium = shownStatus === 'premium';
  const completed = shownStatus === 'completed';
  const face = locked || premium ? colors.locked : completed ? colors.primary : color;
  const edge = locked || premium ? '#1D2129' : completed ? colors.primaryShadow : shade(color);
  const showCurrent = current && !hidden;
  const justOpened = revealing && opened;

  return (
    <View style={styles.wrap}>
      {showCurrent ? (
        <Animated.View
          style={[
            styles.bubble,
            justOpened
              ? {
                  animationName: {
                    from: { opacity: 0, transform: [{ translateY: 10 }, { scale: 0.6 }] },
                    to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
                  },
                  animationDuration: 320,
                  animationDelay: 250,
                  animationFillMode: 'backwards',
                }
              : {
                  animationName: {
                    from: { transform: [{ translateY: 0 }] },
                    to: { transform: [{ translateY: -5 }] },
                  },
                  animationDuration: 700,
                  animationIterationCount: 'infinite',
                  animationDirection: 'alternate',
                  animationTimingFunction: 'ease-in-out',
                },
            { pointerEvents: 'none' },
          ]}
        >
          <AppText variant="caption" color={color}>
            {completed ? 'REVIEW' : 'START'}
          </AppText>
          <View style={styles.bubbleTail} />
        </Animated.View>
      ) : null}
      {showCurrent ? (
        <Animated.View
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
            { pointerEvents: 'none' },
          ]}
        />
      ) : null}
      {justOpened ? (
        <ParticleBurst
          x={(SIZE + 30) / 2}
          y={SIZE / 2}
          count={18}
          radius={SIZE * 1.1}
          size={8}
          gravity={30}
          duration={800}
          shapes={['star', 'confetti', 'circle']}
          colors={[color, colors.star, '#FFFFFF']}
          seed={label.length}
        />
      ) : null}
      <Animated.View
        style={
          justOpened
            ? {
                animationName: {
                  '0%': { transform: [{ scale: 0.8 }] },
                  '45%': { transform: [{ scale: 1.22 }] },
                  '70%': { transform: [{ scale: 0.95 }] },
                  '100%': { transform: [{ scale: 1 }] },
                },
                animationDuration: 520,
              }
            : undefined
        }
      >
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${
            locked ? 'locked' : premium ? 'part of Premium' : completed ? `completed with ${stars} stars` : 'available'
          }`}
          onPressIn={() => haptics.tap()}
          onPress={onPress}
        >
          {({ pressed }) => (
            <View style={[styles.edge, { backgroundColor: edge, paddingBottom: pressed ? 2 : 6, marginTop: pressed ? 4 : 0 }]}>
              <View style={[styles.face, { backgroundColor: face }, premium && styles.premiumFace]}>
                <Animated.View
                  style={
                    hidden
                      ? {
                          animationName: {
                            '0%': { transform: [{ rotate: '0deg' }] },
                            '15%': { transform: [{ rotate: '-16deg' }] },
                            '30%': { transform: [{ rotate: '14deg' }] },
                            '45%': { transform: [{ rotate: '-11deg' }] },
                            '60%': { transform: [{ rotate: '8deg' }] },
                            '75%': { transform: [{ rotate: '-4deg' }] },
                            '100%': { transform: [{ rotate: '0deg' }] },
                          },
                          animationDuration: 520,
                          animationDelay: REVEAL_MS - 560,
                          animationFillMode: 'backwards',
                        }
                      : undefined
                  }
                >
                  <Icon
                    name={locked ? 'lock' : premium ? 'crown' : completed ? 'check-bold' : icon}
                    size={locked ? 26 : premium ? 30 : 32}
                    color={locked ? colors.lockedText : premium ? colors.star : colors.textInverse}
                  />
                </Animated.View>
              </View>
            </View>
          )}
        </Pressable>
      </Animated.View>
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
  premiumFace: { borderWidth: 2, borderColor: 'rgba(255, 201, 77, 0.45)' },
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

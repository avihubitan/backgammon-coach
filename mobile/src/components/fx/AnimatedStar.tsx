import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { feedback } from '@/services/feedback';
import { colors } from '@/theme';

import { ParticleBurst } from './ParticleBurst';

interface AnimatedStarProps {
  earned: boolean;
  size: number;
  /** ms before this star appears. */
  delay: number;
  /** 1, 2 or 3: earned stars chime higher one after another. */
  index: number;
  /** Play the chime (off for replays of the same screen, previews…). */
  sound?: boolean;
}

/** A reward star: earned stars slam in with a spin, a chime and a burst; missed ones fade in quietly. */
export function AnimatedStar({ earned, size, delay, index, sound = true }: AnimatedStarProps) {
  useEffect(() => {
    if (!earned || !sound) return;
    const timer = setTimeout(() => feedback.star(index), delay + 120);
    return () => clearTimeout(timer);
  }, [earned, sound, delay, index]);

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden>
      {earned ? (
        <ParticleBurst
          x={size / 2}
          y={size / 2}
          delay={delay + 140}
          count={12}
          radius={size * 0.95}
          size={Math.max(5, size * 0.11)}
          gravity={size * 0.25}
          duration={720}
          shapes={['star', 'circle']}
          colors={[colors.star, '#FFE9A8', '#FFFFFF']}
          seed={index * 13}
        />
      ) : null}
      <Animated.View
        style={[
          styles.center,
          earned
            ? {
                animationName: {
                  '0%': { opacity: 0, transform: [{ scale: 2.2 }, { rotate: '-35deg' }] },
                  '55%': { opacity: 1, transform: [{ scale: 0.86 }, { rotate: '6deg' }] },
                  '78%': { opacity: 1, transform: [{ scale: 1.1 }, { rotate: '-2deg' }] },
                  '100%': { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }] },
                },
                animationDuration: 520,
                animationDelay: delay,
                animationFillMode: 'backwards',
                animationTimingFunction: 'ease-out',
              }
            : {
                animationName: { from: { opacity: 0, transform: [{ scale: 0.6 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } },
                animationDuration: 300,
                animationDelay: delay,
                animationFillMode: 'backwards',
              },
        ]}
      >
        <Icon name="star" size={size} color={earned ? colors.star : colors.starEmpty} />
        {earned ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shine,
              {
                width: size * 0.22,
                height: size * 0.22,
                top: size * 0.28,
                left: size * 0.36,
                animationName: {
                  '0%': { opacity: 0, transform: [{ scale: 0.2 }, { rotate: '0deg' }] },
                  '50%': { opacity: 1, transform: [{ scale: 1.2 }, { rotate: '45deg' }] },
                  '100%': { opacity: 0, transform: [{ scale: 0.2 }, { rotate: '90deg' }] },
                },
                animationDuration: 700,
                animationDelay: delay + 380,
                animationFillMode: 'both',
              },
            ]}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  shine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
});

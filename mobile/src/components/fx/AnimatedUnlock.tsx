import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { feedback } from '@/services/feedback';
import { colors } from '@/theme';

import { ParticleBurst } from './ParticleBurst';

interface AnimatedUnlockProps {
  size?: number;
  color?: string;
  /** ms before the lock starts to rattle. */
  delay?: number;
  /** Hold the animation (e.g. while another overlay is up). */
  paused?: boolean;
  sound?: boolean;
}

const RATTLE_MS = 420;

/** A padlock that rattles, springs open with a chime and a burst. */
export function AnimatedUnlock({ size = 26, color = colors.primary, delay = 0, paused = false, sound = true }: AnimatedUnlockProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (paused || open) return;
    const timer = setTimeout(() => {
      setOpen(true);
      if (sound) feedback.unlock();
    }, delay + RATTLE_MS);
    return () => clearTimeout(timer);
  }, [paused, open, delay, sound]);

  return (
    <View style={{ width: size * 1.4, height: size * 1.4, alignItems: 'center', justifyContent: 'center' }}>
      {open ? (
        <>
          <ParticleBurst
            x={size * 0.7}
            y={size * 0.7}
            count={12}
            radius={size * 1.8}
            size={Math.max(4, size * 0.2)}
            gravity={size * 0.4}
            duration={700}
            shapes={['star', 'circle']}
            colors={[color, '#FFE9A8', '#FFFFFF']}
            seed={7}
          />
          <Animated.View
            style={{
              animationName: {
                '0%': { transform: [{ scale: 0.6 }, { rotate: '-12deg' }] },
                '60%': { transform: [{ scale: 1.3 }, { rotate: '6deg' }] },
                '100%': { transform: [{ scale: 1 }, { rotate: '0deg' }] },
              },
              animationDuration: 420,
            }}
          >
            <Icon name="lock-open-variant" size={size} color={color} />
          </Animated.View>
        </>
      ) : (
        <Animated.View
          style={
            paused
              ? undefined
              : {
                  animationName: {
                    '0%': { transform: [{ rotate: '0deg' }] },
                    '20%': { transform: [{ rotate: '-14deg' }] },
                    '40%': { transform: [{ rotate: '12deg' }] },
                    '60%': { transform: [{ rotate: '-9deg' }] },
                    '80%': { transform: [{ rotate: '6deg' }] },
                    '100%': { transform: [{ rotate: '0deg' }] },
                  },
                  animationDuration: RATTLE_MS,
                  animationDelay: delay,
                }
          }
        >
          <Icon name="lock" size={size} color={colors.textMuted} />
        </Animated.View>
      )}
      <View style={styles.hidden} accessibilityLabel={open ? 'Unlocked' : 'Locked'} />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});

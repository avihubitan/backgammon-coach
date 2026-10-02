import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { DieValue, Player } from '@/game';
import { boardColors } from '@/theme';

const PIPS: Record<DieValue, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

interface DieFaceProps {
  value: DieValue;
  size: number;
  player?: Player;
  used?: boolean;
}

export function DieFace({ value, size, player = 'player1', used = false }: DieFaceProps) {
  const light = player === 'player1';
  const pip = size * 0.18;
  const pad = size * 0.17;
  const step = (size - pad * 2 - pip) / 2;
  return (
    <Animated.View
      style={[
        styles.die,
        {
          width: size,
          height: size,
          borderRadius: size * 0.22,
          backgroundColor: light ? boardColors.lightDie : boardColors.darkDie,
          opacity: used ? 0.3 : 1,
          transform: [{ scale: used ? 0.88 : 1 }],
          transitionProperty: ['opacity', 'transform'],
          transitionDuration: 220,
        },
      ]}
    >
      {PIPS[value].map(([cx, cy], index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: pad + cx * step,
            top: pad + cy * step,
            width: pip,
            height: pip,
            borderRadius: pip / 2,
            backgroundColor: light ? boardColors.lightPip : boardColors.darkPip,
          }}
        />
      ))}
    </Animated.View>
  );
}

interface RollingDieProps extends DieFaceProps {
  /** Throw the die onto the board when it first appears. */
  animate?: boolean;
  /** Which die of the roll (0, 1, …): each one tumbles a little differently. */
  index?: number;
  delay?: number;
  onSettle?: () => void;
}

/** How long a throw takes; the face settles at about 70%. */
export const DICE_THROW_MS = 640;

const TUMBLE_FACES: DieValue[] = [3, 6, 2, 5, 1, 4];

/** A die thrown in from the roller's side (remount it with a new key for each roll). */
export function RollingDie({ value, size, player = 'player1', used, animate = true, index = 0, delay = 0, onSettle }: RollingDieProps) {
  const [frame, setFrame] = useState(animate ? 0 : -1);

  useEffect(() => {
    if (!animate) return;
    let current = 0;
    let tumble: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      tumble = setInterval(() => {
        current += 1;
        if (current >= 7) {
          if (tumble) clearInterval(tumble);
          setFrame(-1);
        } else {
          setFrame(current);
        }
      }, 55);
    }, delay);
    const settle = setTimeout(() => onSettle?.(), delay + DICE_THROW_MS * 0.7);
    return () => {
      clearTimeout(start);
      clearTimeout(settle);
      if (tumble) clearInterval(tumble);
    };
    // A throw happens once per mount; later prop changes don't restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  const shown = frame >= 0 ? TUMBLE_FACES[(frame * 2 + value + index) % 6] : value;
  return <Animated.View style={animate ? throwAnimation(size, player, index, delay) : undefined}>
    <DieFace value={shown} size={size} player={player} used={used} />
  </Animated.View>;
}

function throwAnimation(size: number, player: Player, index: number, delay: number) {
  // Dice come in from the roller's side of the board.
  const dir = player === 'player1' ? 1 : -1;
  const wobble = index % 2 === 0 ? 1 : -1;
  const frame = (x: number, y: number, rotate: number, scale: number) => ({
    transform: [
      { translateX: x * size },
      { translateY: y * size },
      { rotate: `${rotate}deg` },
      { scale },
    ],
  });
  return {
    animationName: {
      '0%': { ...frame(dir * (2.4 + index * 0.6), -0.8 * wobble, dir * (520 + index * 90), 0.72), opacity: 0 },
      '10%': { opacity: 1 },
      '46%': { ...frame(dir * 0.3, 0.1 * wobble, dir * 70, 1.1), opacity: 1 },
      '64%': { ...frame(-dir * 0.07, -0.2 * wobble, -dir * 16, 1.02), opacity: 1 },
      '80%': { ...frame(dir * 0.025, 0.04 * wobble, dir * 5, 0.97), opacity: 1 },
      '100%': { ...frame(0, 0, 0, 1), opacity: 1 },
    },
    animationDuration: DICE_THROW_MS,
    animationDelay: delay,
    animationFillMode: 'backwards' as const,
    animationTimingFunction: 'ease-out' as const,
  };
}

const styles = StyleSheet.create({
  die: {
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.45)',
  },
});

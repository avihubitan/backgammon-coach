import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { DieValue, Player } from '@/game';

import { DICE_SETTLE_MS, DICE_THROW_MS } from './motion';
import { useBoardPalette } from './palette';

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

/** A die seen from above: a rounded cube with a lit top edge and a shaded lower edge. */
export function DieFace({ value, size, player = 'player1', used = false }: DieFaceProps) {
  const boardColors = useBoardPalette();
  const light = player === 'player1';
  const edge = Math.max(1.5, size * 0.07);
  // Pips sit on the top face, inside the bevelled edges.
  const innerWidth = size - 2;
  const innerHeight = size - 1 - edge;
  const pip = size * 0.18;
  const padX = innerWidth * 0.16;
  const padY = innerHeight * 0.16;
  const stepX = (innerWidth - padX * 2 - pip) / 2;
  const stepY = (innerHeight - padY * 2 - pip) / 2;
  return (
    <Animated.View
      style={[
        styles.die,
        {
          width: size,
          height: size,
          borderRadius: size * 0.22,
          backgroundColor: light ? boardColors.lightDie : boardColors.darkDie,
          borderTopColor: light ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.24)',
          borderLeftColor: light ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.14)',
          borderRightColor: light ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.35)',
          borderBottomColor: light ? 'rgba(90, 70, 40, 0.38)' : 'rgba(0, 0, 0, 0.55)',
          borderBottomWidth: edge,
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
            left: padX + cx * stepX,
            top: padY + cy * stepY,
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
  /** The opening roll: this die won it (lit up) or lost it (steps back). */
  standing?: 'won' | 'lost' | null;
  /** Doubles: the third and fourth dice pop in beside the thrown pair instead of being thrown. */
  copy?: boolean;
}

// Timing lives with the rest of the board's motion, free of rendering imports.
export { DICE_SETTLE_MS, DICE_THROW_MS } from './motion';

const TUMBLE_FACES: DieValue[] = [3, 6, 2, 5, 1, 4];

/** A die thrown in from the roller's side (remount it with a new key for each roll). */
export function RollingDie({
  value,
  size,
  player = 'player1',
  used,
  animate = true,
  index = 0,
  delay = 0,
  onSettle,
  standing = null,
  copy = false,
}: RollingDieProps) {
  const thrown = animate && !copy;
  const [frame, setFrame] = useState(thrown ? 0 : -1);

  useEffect(() => {
    if (!thrown) return;
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
    const settle = setTimeout(() => onSettle?.(), delay + DICE_SETTLE_MS);
    return () => {
      clearTimeout(start);
      clearTimeout(settle);
      if (tumble) clearInterval(tumble);
    };
    // A throw happens once per mount; later prop changes don't restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thrown]);

  const shown = frame >= 0 ? TUMBLE_FACES[(frame * 2 + value + index) % 6] : value;
  const entry = !animate ? undefined : copy ? popIn(delay) : throwAnimation(size, player, index, delay);
  return (
    <Animated.View style={entry}>
      <Animated.View
        style={[
          { borderRadius: size * 0.26, transitionProperty: ['opacity', 'transform'], transitionDuration: 260 },
          standing === 'won' && [styles.won, { borderRadius: size * 0.26 }],
          standing === 'lost' && styles.lost,
        ]}
      >
        <DieFace value={shown} size={size} player={player} used={used} />
      </Animated.View>
    </Animated.View>
  );
}

/** The extra dice of a double appear with a small pop once the thrown pair has landed. */
function popIn(delay: number) {
  return {
    animationName: {
      '0%': { opacity: 0, transform: [{ scale: 0.4 }] },
      '60%': { opacity: 1, transform: [{ scale: 1.12 }] },
      '100%': { opacity: 1, transform: [{ scale: 1 }] },
    },
    animationDuration: 280,
    animationDelay: delay,
    animationFillMode: 'backwards' as const,
    animationTimingFunction: 'ease-out' as const,
  };
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
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    boxShadow: '0px 3px 5px rgba(0, 0, 0, 0.5)',
  },
  won: {
    boxShadow: '0px 0px 0px 2px rgba(243, 184, 71, 0.95), 0px 0px 14px rgba(243, 184, 71, 0.55)',
    transform: [{ scale: 1.08 }],
  },
  lost: { opacity: 0.55, transform: [{ scale: 0.94 }] },
});

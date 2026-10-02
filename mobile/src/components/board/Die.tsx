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
    <View
      style={[
        styles.die,
        {
          width: size,
          height: size,
          borderRadius: size * 0.22,
          backgroundColor: light ? boardColors.lightDie : boardColors.darkDie,
          opacity: used ? 0.32 : 1,
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
    </View>
  );
}

interface RollingDieProps extends DieFaceProps {
  /** Animate a tumble when the die first appears. */
  animate?: boolean;
  delay?: number;
}

const TUMBLE_FACES: DieValue[] = [3, 6, 2, 5, 1, 4];

/** A die that tumbles in when it mounts (remount it with a new key for each roll). */
export function RollingDie({ value, size, player, used, animate = true, delay = 0 }: RollingDieProps) {
  const [frame, setFrame] = useState(animate ? 0 : -1);

  useEffect(() => {
    if (!animate) return;
    let current = 0;
    const timer = setInterval(() => {
      current += 1;
      if (current >= 6) {
        clearInterval(timer);
        setFrame(-1);
      } else {
        setFrame(current);
      }
    }, 60);
    return () => clearInterval(timer);
  }, [animate]);

  const shown = frame >= 0 ? TUMBLE_FACES[(frame + value) % 6] : value;
  return (
    <Animated.View
      style={
        animate
          ? {
              animationName: {
                '0%': { transform: [{ rotate: '-200deg' }, { scale: 0.4 }], opacity: 0 },
                '60%': { transform: [{ rotate: '12deg' }, { scale: 1.12 }], opacity: 1 },
                '100%': { transform: [{ rotate: '0deg' }, { scale: 1 }], opacity: 1 },
              },
              animationDuration: 420,
              animationDelay: delay,
              animationFillMode: 'backwards',
              animationTimingFunction: 'ease-out',
            }
          : undefined
      }
    >
      <DieFace value={shown} size={size} player={player} used={used} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  die: {
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.45)',
  },
});

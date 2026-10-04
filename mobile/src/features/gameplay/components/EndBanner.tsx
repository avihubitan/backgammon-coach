import { Platform, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ParticleBurst } from '@/components/fx/ParticleBurst';
import { AppText } from '@/components/ui/AppText';
import type { GameResult } from '@/game';
import { colors } from '@/theme';

/** When the banner appears after the last move: the last checker has landed. */
export const END_BANNER_DELAY_MS = 450;
/** When the result sheet follows: long enough to take in the end, short enough not to wait. */
export const RESULT_SHEET_DELAY_MS = { won: 1700, lost: 1300 } as const;

const TYPE_LINE = { single: null, gammon: 'Gammon!', backgammon: 'Backgammon!' } as const;

// The web wants the CSS shorthand; phones the separate properties.
const TEXT_SHADOW =
  Platform.OS === 'web'
    ? ({ textShadow: '0px 2px 8px rgba(0, 0, 0, 0.6)' } as object)
    : { textShadowColor: 'rgba(0, 0, 0, 0.6)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } };

/**
 * The moment between the last move and the result sheet, over the board: a
 * tasteful celebration for a win, a calm "Good game" for a loss.
 */
export function EndBanner({ result, opponentName, width, height }: { result: GameResult; opponentName: string; width: number; height: number }) {
  const won = result.winner === 'player1';
  const extra = TYPE_LINE[result.type];
  const detail =
    result.reason === 'resigned'
      ? `${opponentName} takes this one.`
      : result.reason === 'dropped-double'
        ? won
          ? `${opponentName} dropped your double.`
          : 'You dropped the double.'
        : won
          ? 'You bore off first.'
          : `${opponentName} bore off first.`;
  return (
    <View testID="end-banner" style={[StyleSheet.absoluteFill, styles.wrap, { pointerEvents: 'none' }]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.scrim,
          {
            animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
            animationDuration: 380,
            animationDelay: END_BANNER_DELAY_MS,
            animationFillMode: 'backwards',
          },
        ]}
      />
      <Animated.View
        style={[
          styles.center,
          {
            animationName: {
              '0%': { opacity: 0, transform: [{ scale: won ? 0.6 : 0.92 }] },
              '60%': { opacity: 1, transform: [{ scale: won ? 1.08 : 1 }] },
              '100%': { opacity: 1, transform: [{ scale: 1 }] },
            },
            animationDuration: won ? 520 : 420,
            animationDelay: END_BANNER_DELAY_MS + 80,
            animationFillMode: 'backwards',
            animationTimingFunction: 'ease-out',
          },
        ]}
      >
        <AppText variant="display" align="center" style={won ? styles.winTitle : styles.title}>
          {won ? 'You win!' : 'Good game'}
        </AppText>
        {won && extra ? (
          <AppText variant="heading" align="center" color="primary">
            {extra}
          </AppText>
        ) : null}
        <AppText variant="smallStrong" align="center" color="textSecondary">
          {detail}
        </AppText>
      </Animated.View>
      {won ? (
        <ParticleBurst
          x={width / 2}
          y={height / 2}
          delay={END_BANNER_DELAY_MS + 200}
          count={26}
          radius={Math.min(width, height) * 0.62}
          size={7}
          gravity={height * 0.35}
          duration={1300}
          shapes={['confetti', 'star', 'circle']}
          colors={[colors.primary, '#FFE6A8', '#FFFFFF', colors.success]}
          seed={result.points * 13 + 7}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 120, alignItems: 'center', justifyContent: 'center' },
  scrim: { backgroundColor: 'rgba(8, 9, 11, 0.55)', borderRadius: 12 },
  center: { alignItems: 'center', gap: 2, paddingHorizontal: 16 },
  title: { ...TEXT_SHADOW },
  winTitle: { color: colors.primary, ...TEXT_SHADOW },
});

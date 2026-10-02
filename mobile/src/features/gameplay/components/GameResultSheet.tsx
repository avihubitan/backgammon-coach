import { Modal, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { getAchievement } from '@/features/learning/achievements';
import type { GameResult, MatchScore } from '@/game';
import { colors, radii, SCREEN_GUTTER, spacing } from '@/theme';

import type { GameOutcome } from '../useGameController';

interface GameResultSheetProps {
  result: GameResult;
  outcome: GameOutcome;
  match: MatchScore;
  matchLength: number;
  onReview?: () => void;
  onNextGame: () => void;
  onPlayAgain: () => void;
  onDone: () => void;
}

const TYPE_LABEL = { single: 'Single game', gammon: 'Gammon!', backgammon: 'Backgammon!' } as const;

export function GameResultSheet({
  result,
  outcome,
  match,
  matchLength,
  onReview,
  onNextGame,
  onPlayAgain,
  onDone,
}: GameResultSheetProps) {
  const insets = useSafeAreaInsets();
  const won = result.winner === 'player1';
  const isMatch = matchLength > 1;
  const matchWon = isMatch && outcome.matchOver && match.player1 >= matchLength;
  const reason =
    result.reason === 'dropped-double'
      ? won
        ? 'The computer dropped your double.'
        : 'You dropped the double.'
      : result.reason === 'resigned'
        ? 'You resigned this game.'
        : won
          ? 'You bore off all your checkers first.'
          : 'The computer bore off first.';

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <Animated.View
          testID="game-result"
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, spacing.xl),
              animationName: { from: { transform: [{ translateY: 200 }] }, to: { transform: [{ translateY: 0 }] } },
              animationDuration: 320,
            },
          ]}
        >
          <View style={[styles.badge, { backgroundColor: won ? colors.primary : colors.surfaceRaised }]}>
            <Icon name={won ? 'trophy' : 'emoticon-neutral-outline'} size={40} color={won ? 'textInverse' : 'textSecondary'} />
          </View>
          <AppText variant="display" align="center">
            {isMatch && outcome.matchOver ? (matchWon ? 'Match won!' : 'Match lost') : won ? 'You won!' : 'You lost'}
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            {reason}
          </AppText>
          <View style={styles.chips}>
            <View style={styles.chip}>
              <AppText variant="smallStrong" color={won ? 'primary' : 'textSecondary'}>
                {TYPE_LABEL[result.type]} · {result.points} pt{result.points === 1 ? '' : 's'}
              </AppText>
            </View>
            <View style={styles.chip}>
              <Icon name="lightning-bolt" size={16} color={colors.xp} />
              <AppText variant="smallStrong" color="xp">
                +{outcome.xp} XP
              </AppText>
            </View>
          </View>
          {isMatch ? (
            <AppText variant="heading" align="center">
              You {match.player1} – {match.player2} Computer
              <AppText variant="small" color="textSecondary">
                {'  '}(to {matchLength})
              </AppText>
            </AppText>
          ) : null}
          {outcome.levelUp ? (
            <AppText variant="bodyStrong" color="primary" align="center">
              Level {outcome.levelUp} reached!
            </AppText>
          ) : null}
          {outcome.newAchievements.map((id) => (
            <AppText key={id} variant="bodyStrong" color="info" align="center">
              Achievement unlocked: {getAchievement(id)?.title}
            </AppText>
          ))}
          <View style={styles.actions}>
            {isMatch && !outcome.matchOver ? (
              <Button testID="next-game" label="Next game" icon="play" onPress={onNextGame} />
            ) : (
              <Button testID="play-again" label="Play again" icon="restart" onPress={onPlayAgain} />
            )}
            {onReview ? (
              <Button testID="review-game" label="Review with coach" icon="school" variant="secondary" onPress={onReview} />
            ) : null}
            <Button testID="game-done" label="Done" variant="ghost" size="medium" onPress={onDone} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingTop: spacing.xxl,
    paddingHorizontal: SCREEN_GUTTER,
    gap: spacing.md,
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  badge: {
    alignSelf: 'center',
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  actions: { gap: spacing.xs, marginTop: spacing.sm },
});

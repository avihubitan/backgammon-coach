import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LevelUpOverlay } from '@/components/fx/LevelUpOverlay';
import { ParticleBurst } from '@/components/fx/ParticleBurst';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { isPersonalBest, moveQuality, qualityBand } from '@/features/coach/playQuality';
import { BAND_COLOR } from '@/features/coach/qualityStyle';
import { QuickFeedback } from '@/features/feedback/QuickFeedback';
import { getAchievement } from '@/features/learning/achievements';
import { freezeLines } from '@/features/learning/streakLines';
import type { GameResult, MatchScore } from '@/game';
import { useGameStore } from '@/state/gameStore';
import { colors, radii, SCREEN_GUTTER, spacing } from '@/theme';

import { resultCopy } from '../resultCopy';
import type { GameOutcome } from '../useGameController';

interface GameResultSheetProps {
  result: GameResult;
  opponentName: string;
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
  opponentName,
  outcome,
  match,
  matchLength,
  onReview,
  onNextGame,
  onPlayAgain,
  onDone,
}: GameResultSheetProps) {
  const insets = useSafeAreaInsets();
  const [showLevelUp, setShowLevelUp] = useState(!!outcome.levelUp);
  const won = result.winner === 'player1';
  const isMatch = matchLength > 1;
  const matchWon = isMatch && outcome.matchOver && match.player1 >= matchLength;
  // Streak news first, then achievements.
  const chips: { icon: IconName; color: string; text: string }[] = [
    ...(outcome.streak.streakExtended && outcome.streak.streak > 0
      ? [{ icon: 'fire' as const, color: colors.streak, text: `${outcome.streak.streak}-day streak!` }]
      : []),
    ...freezeLines(outcome.streak),
    ...outcome.newAchievements.flatMap((id) => {
      const achievement = getAchievement(id);
      return achievement ? [{ icon: achievement.icon, color: colors.info, text: achievement.title }] : [];
    }),
  ];
  // A loss isn't the end of anything: the review is the next step.
  const copy = resultCopy({ result, opponentName, isMatch, matchOver: outcome.matchOver, matchWon, canReview: !!onReview });
  const reviewFirst = copy.reviewFirst;
  const xpShown = useCountUp(outcome.xp, 520, 650);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone}>
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
          <View style={styles.badgeWrap}>
            <Animated.View
              style={[
                styles.badge,
                { backgroundColor: won ? colors.primary : colors.surfaceRaised },
                won
                  ? {
                      animationName: {
                        '0%': { transform: [{ scale: 0.2 }, { rotate: '-40deg' }] },
                        '60%': { transform: [{ scale: 1.2 }, { rotate: '8deg' }] },
                        '100%': { transform: [{ scale: 1 }, { rotate: '0deg' }] },
                      },
                      animationDuration: 560,
                      animationDelay: 200,
                      animationFillMode: 'backwards',
                    }
                  : null,
              ]}
            >
              <Icon name={won ? 'trophy' : 'handshake-outline'} size={40} color={won ? 'textInverse' : 'textSecondary'} />
            </Animated.View>
            {won ? (
              <ParticleBurst
                x={38}
                y={38}
                delay={420}
                count={22}
                radius={140}
                size={8}
                gravity={90}
                duration={1100}
                shapes={['confetti', 'star', 'circle']}
                colors={[colors.primary, colors.success, colors.info, '#FFFFFF']}
                seed={result.points}
              />
            ) : null}
          </View>
          <AppText variant="display" align="center">
            {copy.title}
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            {copy.line}
          </AppText>
          <View style={styles.chips}>
            <View style={styles.chip}>
              <AppText variant="smallStrong" color={won ? 'primary' : 'textSecondary'}>
                {TYPE_LABEL[result.type]} · {result.points} pt{result.points === 1 ? '' : 's'}
              </AppText>
            </View>
            <View style={styles.chip}>
              <Icon name="lightning-bolt" size={16} color={colors.xp} />
              <AppText variant="smallStrong" color="xp" testID="result-xp">
                +{xpShown} XP
              </AppText>
            </View>
          </View>
          {outcome.gameId ? <MoveQualityLine gameId={outcome.gameId} /> : null}
          {isMatch ? (
            <AppText variant="heading" align="center">
              You {match.player1} – {match.player2} Computer
              <AppText variant="small" color="textSecondary">
                {'  '}(to {matchLength})
              </AppText>
            </AppText>
          ) : null}
          {chips.length > 0 ? (
            <View style={styles.achievements} testID="game-achievements">
              {chips.slice(0, 4).map((chip, index) => (
                <Animated.View
                  key={chip.text}
                  style={[
                    styles.achievement,
                    {
                      animationName: {
                        from: { opacity: 0, transform: [{ scale: 0.7 }] },
                        to: { opacity: 1, transform: [{ scale: 1 }] },
                      },
                      animationDuration: 300,
                      animationDelay: 450 + index * 120,
                      animationFillMode: 'backwards',
                    },
                  ]}
                >
                  <Icon name={chip.icon} size={16} color={chip.color} />
                  <AppText variant="caption" color="text">
                    {chip.text}
                  </AppText>
                </Animated.View>
              ))}
              {chips.length > 4 ? (
                <View style={styles.achievement}>
                  <AppText variant="caption" color="textSecondary">
                    +{chips.length - 4} more
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : null}
          {!isMatch || outcome.matchOver ? <QuickFeedback context="game" subject={outcome.level} /> : null}
          <View style={styles.actions}>
            {reviewFirst && onReview ? (
              <Button testID="review-game" label="Review with coach" icon="school" onPress={onReview} />
            ) : null}
            {isMatch && !outcome.matchOver ? (
              <Button
                testID="next-game"
                label="Next game"
                icon="play"
                variant={reviewFirst ? 'secondary' : 'primary'}
                onPress={onNextGame}
              />
            ) : (
              <Button
                testID="play-again"
                label="Play again"
                icon="restart"
                variant={reviewFirst ? 'secondary' : 'primary'}
                onPress={onPlayAgain}
              />
            )}
            {onReview && !reviewFirst ? (
              <Button testID="review-game" label="Review with coach" icon="school" variant="secondary" onPress={onReview} />
            ) : null}
            <Button testID="game-done" label="Done" variant="ghost" size="medium" onPress={onDone} />
          </View>
        </Animated.View>
        {showLevelUp && outcome.levelUp ? (
          <LevelUpOverlay level={outcome.levelUp} onClose={() => setShowLevelUp(false)} />
        ) : null}
      </View>
    </Modal>
  );
}

/** Counts up to `target` once, after `delay` ms, over `duration` ms. */
function useCountUp(target: number, delay: number, duration: number): number {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let tick: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      const began = Date.now();
      tick = setInterval(() => {
        const t = Math.min(1, (Date.now() - began) / duration);
        // Ease out: quick at first, settling on the number.
        setShown(Math.round(target * (1 - (1 - t) * (1 - t))));
        if (t >= 1 && tick) clearInterval(tick);
      }, 32);
    }, delay);
    return () => {
      clearTimeout(start);
      if (tick) clearInterval(tick);
    };
  }, [target, delay, duration]);
  return shown;
}

/** The coach's quick verdict, as soon as the background review is done. */
function MoveQualityLine({ gameId }: { gameId: string }) {
  const finished = useGameStore((store) => store.finished);
  const game = finished.find((entry) => entry.id === gameId);
  const review = game?.review;
  const quality = review ? moveQuality(review) : null;
  // Nothing to score: no moves (resigned at once) or too few real decisions.
  if (!game || game.history.length === 0 || (review && quality === null)) return null;
  if (quality === null) {
    return (
      <View style={styles.quality}>
        <ActivityIndicator size="small" color={colors.textMuted} />
        <AppText variant="small" color="textSecondary">
          Your coach is scoring your moves…
        </AppText>
      </View>
    );
  }
  const band = qualityBand(quality);
  const best = isPersonalBest(finished, gameId);
  return (
    <View style={styles.qualityBlock}>
      <Animated.View
        testID="result-quality"
        accessibilityLabel={`Move quality ${quality} out of 100, ${band.label}`}
        style={[styles.quality, pop(0)]}
      >
        <Icon name="school" size={18} color={colors.info} />
        <AppText variant="smallStrong">Move quality {quality}</AppText>
        <AppText variant="smallStrong" color={BAND_COLOR[band.band]}>
          · {band.label}
        </AppText>
      </Animated.View>
      {best ? (
        <Animated.View testID="result-personal-best" style={[styles.best, pop(260)]}>
          <Icon name="star-shooting" size={16} color={colors.star} />
          <AppText variant="caption" color="star">
            New personal best!
          </AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const pop = (delay: number) => ({
  animationName: {
    '0%': { opacity: 0, transform: [{ scale: 0.8 }] },
    '70%': { opacity: 1, transform: [{ scale: 1.06 }] },
    '100%': { opacity: 1, transform: [{ scale: 1 }] },
  },
  animationDuration: 320,
  animationDelay: delay,
  animationFillMode: 'backwards' as const,
});

const styles = StyleSheet.create({
  qualityBlock: { alignItems: 'center', gap: spacing.xs },
  quality: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 24 },
  best: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
  },
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
  badgeWrap: { alignSelf: 'center', width: 76, height: 76 },
  achievements: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  achievement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.infoSoft,
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

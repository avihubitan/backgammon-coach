import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LevelUpOverlay } from '@/components/fx/LevelUpOverlay';
import { ParticleBurst } from '@/components/fx/ParticleBurst';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { isPersonalBest, moveQuality, qualityBand } from '@/features/coach/playQuality';
import { BAND_COLOR } from '@/features/coach/qualityStyle';
import { QuickFeedback } from '@/features/feedback/QuickFeedback';
import { getAchievement } from '@/features/learning/achievements';
import { dayKey, levelInfo } from '@/features/learning/progression';
import { freezeLines } from '@/features/learning/streakLines';
import { POSITION_MINUTES } from '@/features/learning/timeEstimates';
import { gameLesson, gameLessonText } from '@/features/skills/gameLink';
import type { GameResult, MatchScore } from '@/game';
import { feedback } from '@/services/feedback';
import { useGameStore } from '@/state/gameStore';
import { useMistakesStore } from '@/state/mistakesStore';
import { useProgressStore } from '@/state/progressStore';
import { useToday } from '@/state/useToday';
import { colors, radii, SCREEN_GUTTER, spacing } from '@/theme';

import { resultCopy, resultTypeLabel, reviewTeaser } from '../resultCopy';
import type { GameOutcome } from '../useGameController';

/** The XP starts counting once the sheet has risen… */
const XP_DELAY_MS = 520;
const XP_COUNT_MS = 650;
/** …and what the game earned beyond XP (streak, achievements) follows it in. */
const CHIPS_DELAY_MS = XP_DELAY_MS + XP_COUNT_MS + 80;

interface GameResultSheetProps {
  result: GameResult;
  opponentName: string;
  outcome: GameOutcome;
  match: MatchScore;
  matchLength: number;
  onReview?: () => void;
  /** Practise one position from this game (free): the first one about the idea that tripped the player up. */
  onPractise?: (mistakeId: string) => void;
  onNextGame: () => void;
  onPlayAgain: () => void;
  onDone: () => void;
}

export function GameResultSheet({
  result,
  opponentName,
  outcome,
  match,
  matchLength,
  onReview,
  onPractise,
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
  // Short phones get a smaller badge, and the sheet scrolls rather than run off the top of the screen.
  const { height } = useWindowDimensions();
  const badge = height < 700 ? 56 : 76;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.backdrop}>
        <Animated.View
          testID="game-result"
          style={[
            styles.sheet,
            {
              maxHeight: height - insets.top - spacing.sm,
              animationName: { from: { transform: [{ translateY: 200 }] }, to: { transform: [{ translateY: 0 }] } },
              animationDuration: 320,
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[styles.badgeWrap, { width: badge, height: badge }]}>
              <Animated.View
                style={[
                  styles.badge,
                  { width: badge, height: badge, borderRadius: badge / 2, backgroundColor: won ? colors.primary : colors.surfaceRaised },
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
                <Icon name={won ? 'trophy' : 'handshake-outline'} size={badge * 0.52} color={won ? 'textInverse' : 'textSecondary'} />
              </Animated.View>
              {won ? (
                <ParticleBurst
                  x={badge / 2}
                  y={badge / 2}
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
                  {resultTypeLabel(result)} · {result.points} pt{result.points === 1 ? '' : 's'}
                </AppText>
              </View>
              <XpChip xp={outcome.xp} />
            </View>
            <LevelProgress earned={outcome.xp} />
            {outcome.gameId ? <MoveQualityLine gameId={outcome.gameId} teaser={!won} /> : null}
            {outcome.gameId ? (
              <GameLessonLine gameId={outcome.gameId} onPractise={!isMatch || outcome.matchOver ? onPractise : undefined} />
            ) : null}
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
                        animationDelay: CHIPS_DELAY_MS + index * 120,
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
          </ScrollView>
        </Animated.View>
        {showLevelUp && outcome.levelUp ? (
          <LevelUpOverlay level={outcome.levelUp} onClose={() => setShowLevelUp(false)} />
        ) : null}
      </View>
    </Modal>
  );
}

/**
 * The XP the game earned: it counts up, then lands with a small pop and tick.
 * Its own component, so the count re-renders only the chip.
 */
function XpChip({ xp }: { xp: number }) {
  const [shown, setShown] = useState(0);
  const landed = xp > 0 && shown === xp;
  useEffect(() => {
    let tick: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      const began = Date.now();
      tick = setInterval(() => {
        const t = Math.min(1, (Date.now() - began) / XP_COUNT_MS);
        // Ease out: quick at first, settling on the number.
        setShown(Math.round(xp * (1 - (1 - t) * (1 - t))));
        if (t >= 1 && tick) {
          clearInterval(tick);
          if (xp > 0) feedback.xp();
        }
      }, 32);
    }, XP_DELAY_MS);
    return () => {
      clearTimeout(start);
      if (tick) clearInterval(tick);
    };
  }, [xp]);
  return (
    <Animated.View style={[styles.chip, landed ? [styles.chipLanded, XP_POP] : null]} accessibilityLabel={`${xp} XP earned`}>
      <Icon name="lightning-bolt" size={16} color={colors.xp} />
      <AppText variant="smallStrong" color="xp" testID="result-xp">
        +{shown} XP
      </AppText>
    </Animated.View>
  );
}

const XP_POP = {
  animationName: {
    '0%': { transform: [{ scale: 1 }] },
    '45%': { transform: [{ scale: 1.12 }] },
    '100%': { transform: [{ scale: 1 }] },
  },
  animationDuration: 320,
  animationTimingFunction: 'ease-out',
} as const;

/** Where the XP leaves the player: their level, filling toward the next one as the XP arrives. */
function LevelProgress({ earned }: { earned: number }) {
  const total = useProgressStore((store) => store.xp);
  const after = levelInfo(total);
  const before = levelInfo(Math.max(0, total - earned));
  // A new level starts its bar from empty (the level-up has its own celebration).
  const from = before.level === after.level ? before.progress : 0;
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFilled(true), XP_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View style={styles.level} testID="result-level" accessibilityLabel={`Level ${after.level}, ${after.toNext} XP to level ${after.level + 1}`}>
      <AppText variant="caption" color="textSecondary">
        Level {after.level}
      </AppText>
      <ProgressBar progress={filled ? after.progress : from} height={6} color={colors.xp} shine={false} style={styles.levelBar} />
      <AppText variant="caption" color="textMuted">
        {after.toNext} to go
      </AppText>
    </View>
  );
}

/** The coach's quick verdict, as soon as the background review is done; after a loss, a reason to look. */
function MoveQualityLine({ gameId, teaser }: { gameId: string; teaser: boolean }) {
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
  const hook = teaser ? reviewTeaser(review) : null;
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
      {hook ? (
        <Animated.View style={pop(140)}>
          <AppText variant="smallStrong" align="center" testID="result-teaser">
            {hook}
          </AppText>
        </Animated.View>
      ) : null}
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

/**
 * What this game says about the learner's lessons, once the background review
 * is done: "You practised playing safe in “Safe or Risky?”. It tripped you up
 * twice today." and one position from the game to practise, free.
 */
function GameLessonLine({ gameId, onPractise }: { gameId: string; onPractise?: (mistakeId: string) => void }) {
  const finished = useGameStore((store) => store.finished);
  const lessons = useProgressStore((store) => store.lessons);
  const mistakes = useMistakesStore((store) => store.mistakes);
  const { day } = useToday();
  const review = finished.find((entry) => entry.id === gameId)?.review;
  // "Today" means games played today, whenever their review ran.
  const playedToday = new Set(finished.filter((entry) => dayKey(new Date(entry.finishedAt)) === day).map((entry) => entry.id));
  const note = review ? gameLesson(gameId, review, lessons, mistakes, day, playedToday) : null;
  if (!note) return null;
  // The position has to be saved to be practised (a full list keeps only the most useful ones).
  const saved = mistakes.some((mistake) => mistake.id === note.mistakeId);
  return (
    <Animated.View testID="result-lesson" style={[styles.lesson, pop(380)]}>
      <View style={styles.lessonText}>
        <Icon name="school-outline" size={18} color={colors.info} />
        <AppText variant="small" style={styles.flex}>
          {gameLessonText(note)}
        </AppText>
      </View>
      {onPractise && saved ? (
        <Button
          testID="result-practise"
          label={`Practise it · ${POSITION_MINUTES} min`}
          icon="lightbulb-on-outline"
          variant="secondary"
          size="medium"
          onPress={() => onPractise(note.mistakeId)}
        />
      ) : null}
    </Animated.View>
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
  lesson: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.infoSoft },
  lessonText: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  flex: { flex: 1 },
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
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  sheetContent: {
    paddingTop: spacing.xxl,
    paddingHorizontal: SCREEN_GUTTER,
    gap: spacing.md,
    alignItems: 'stretch',
  },
  badgeWrap: { alignSelf: 'center' },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  chipLanded: { boxShadow: '0px 0px 10px rgba(243, 184, 71, 0.35)' },
  level: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'center', width: '100%', maxWidth: 300 },
  levelBar: { flex: 1, width: undefined },
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

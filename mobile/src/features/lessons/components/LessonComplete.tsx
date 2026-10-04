import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedStar } from '@/components/fx/AnimatedStar';
import { AnimatedUnlock } from '@/components/fx/AnimatedUnlock';
import { LevelUpOverlay } from '@/components/fx/LevelUpOverlay';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useCountUp } from '@/components/ui/useCountUp';
import { getSection, type Lesson } from '@/curriculum';
import { getAchievement } from '@/features/learning/achievements';
import type { LessonReward } from '@/features/learning/progressModel';
import type { LessonOutcome } from '@/features/lessons/engine/session';
import { QuickFeedback } from '@/features/feedback/QuickFeedback';
import { useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { freezeLines } from '@/features/learning/streakLines';
import { colors, MAX_CONTENT_WIDTH, radii, SCREEN_GUTTER, spacing } from '@/theme';

interface LessonCompleteProps {
  lesson: Lesson;
  outcome: LessonOutcome;
  reward: LessonReward;
  onContinue: () => void;
  onRetry: () => void;
  onNextLesson?: (lessonId: string) => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

const riseIn = (delay: number) => ({
  animationName: {
    from: { transform: [{ translateY: 16 }], opacity: 0 },
    to: { transform: [{ translateY: 0 }], opacity: 1 },
  },
  animationDuration: 380,
  animationDelay: delay,
  animationFillMode: 'backwards' as const,
});

/** When each beat of the celebration lands (ms). */
const BEAT = {
  stars: 350,
  starGap: 300,
  stats: 1150,
  xp: 1250,
  extras: 1500,
  levelUp: 2100,
  unlock: 1800,
} as const;

/** Celebrates a finished lesson: stars, XP, level ups, streaks, unlocks and achievements. */
export function LessonComplete({ lesson, outcome, reward, onContinue, onRetry, onNextLesson }: LessonCompleteProps) {
  const insets = useSafeAreaInsets();
  const xp = useCountUp(reward.xpGained, 800, BEAT.xp);
  const section = getSection(lesson.sectionId);
  const lastInSection = section?.lessons[section.lessons.length - 1]?.id === lesson.id;
  const next = reward.unlockedLessons[0];
  const passed = outcome.passed;
  const canAccess = useFeatureAccess().canAccessLesson;
  // After a free preview, say where the rest of the course is (once, calmly).
  const sectionIndex = section ? section.lessons.findIndex((candidate) => candidate.id === lesson.id) : -1;
  const nextInSection = section && sectionIndex >= 0 ? section.lessons[sectionIndex + 1] : undefined;
  const premiumNext = passed && nextInSection && !canAccess(nextInSection.id) ? nextInSection : undefined;
  const leveledUp = reward.levelAfter > reward.levelBefore;
  const [levelUp, setLevelUp] = useState<'waiting' | 'showing' | 'done'>(leveledUp ? 'waiting' : 'done');

  useEffect(() => {
    if (levelUp !== 'waiting') return;
    const timer = setTimeout(() => setLevelUp('showing'), BEAT.levelUp);
    return () => clearTimeout(timer);
  }, [levelUp]);

  const extras: { icon: IconName; color: string; text: string }[] = [];
  if (reward.streakExtended && reward.streak > 0) {
    extras.push({ icon: 'fire', color: colors.streak, text: `${reward.streak}-day streak!` });
  }
  extras.push(...freezeLines(reward));
  if (reward.dailyGoalReached) extras.push({ icon: 'target', color: colors.success, text: 'Daily goal reached' });
  if (leveledUp) {
    extras.push({ icon: 'arrow-up-bold-circle', color: colors.primary, text: `Level ${reward.levelAfter} reached!` });
  }
  for (const id of reward.newAchievements) {
    const achievement = getAchievement(id);
    if (achievement) extras.push({ icon: achievement.icon, color: colors.info, text: `Achievement: ${achievement.title}` });
  }

  const breakdown = [
    { label: 'Exercises', value: reward.xp.exercises },
    { label: 'First completion', value: reward.xp.completion },
    { label: 'Perfect', value: reward.xp.perfect },
  ].filter((part) => part.value > 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.hero, riseIn(0)]}>
          <AppText variant="label" color={passed ? 'success' : 'primary'}>
            {passed ? (lastInSection ? 'Section complete' : 'Lesson complete') : 'Almost there'}
          </AppText>
          <AppText variant="display" align="center" testID="lesson-complete-title">
            {passed ? lesson.title : 'Let’s try that again'}
          </AppText>
        </Animated.View>

        <View style={styles.stars} accessibilityLabel={`${outcome.stars} of 3 stars`} testID="lesson-stars">
          {[0, 1, 2].map((index) => (
            <View key={index} style={index === 1 ? styles.middleStar : undefined}>
              <AnimatedStar
                earned={index < outcome.stars}
                size={index === 1 ? 84 : 64}
                delay={BEAT.stars + index * BEAT.starGap}
                index={index + 1}
              />
            </View>
          ))}
        </View>

        <Animated.View style={[styles.statsRow, riseIn(BEAT.stats)]}>
          <Stat label="XP earned" value={`+${xp}`} color={colors.xp} icon="lightning-bolt" testID="xp-earned" />
          <Stat
            label="Accuracy"
            value={`${Math.round(outcome.accuracy * 100)}%`}
            color={colors.success}
            icon="bullseye-arrow"
          />
          <Stat label="Time" value={formatDuration(outcome.durationMs)} color={colors.info} icon="timer-outline" />
        </Animated.View>

        {breakdown.length > 1 ? (
          <Animated.View style={[styles.breakdown, riseIn(BEAT.stats + 150)]} testID="xp-breakdown">
            {breakdown.map((part) => (
              <View key={part.label} style={styles.breakdownChip}>
                <AppText variant="caption" color="textSecondary">
                  {part.label}
                </AppText>
                <AppText variant="smallStrong" color={colors.xp}>
                  +{part.value}
                </AppText>
              </View>
            ))}
          </Animated.View>
        ) : null}

        {!passed ? (
          <Animated.View style={[styles.card, riseIn(BEAT.extras)]}>
            <AppText variant="bodyStrong">
              This lesson needs {Math.round(lesson.passingScore * 100)}% to pass. You’re close. Each try makes the
              patterns easier to spot.
            </AppText>
          </Animated.View>
        ) : null}

        {passed ? (
          <Animated.View style={[styles.card, styles.inGameCard, riseIn(BEAT.stats + 250)]} testID="lesson-in-game">
            <Icon name="dice-multiple" size={22} color={colors.info} />
            <View style={styles.nextText}>
              <AppText variant="caption" color="info">
                IN YOUR GAMES
              </AppText>
              <AppText variant="small">{lesson.purpose.inGame}</AppText>
            </View>
          </Animated.View>
        ) : null}

        {passed && next ? (
          <Animated.View style={[styles.card, styles.nextCard, riseIn(BEAT.unlock - 300)]} testID="unlocked-card">
            <AnimatedUnlock size={24} delay={leveledUp ? 350 : BEAT.unlock} paused={levelUp !== 'done'} />
            <View style={styles.nextText}>
              <AppText variant="caption" color="textSecondary">
                UNLOCKED
              </AppText>
              <AppText variant="bodyStrong">{next.title}</AppText>
            </View>
          </Animated.View>
        ) : null}

        {premiumNext && section ? (
          <Animated.View style={[styles.card, styles.premiumCard, riseIn(BEAT.unlock)]} testID="premium-next-card">
            <Icon name="crown" size={26} color={colors.star} />
            <View style={styles.nextText}>
              <AppText variant="caption" color="textSecondary">
                PREMIUM
              </AppText>
              <AppText variant="bodyStrong">The rest of {section.title} is in Premium.</AppText>
            </View>
            <Button
              testID="premium-next"
              label="See"
              variant="secondary"
              size="medium"
              fullWidth={false}
              onPress={() => router.push({ pathname: '/paywall', params: { source: 'lesson_complete' } })}
            />
          </Animated.View>
        ) : null}

        {extras.map((extra, index) => (
          <Animated.View key={extra.text} style={[styles.extra, riseIn(BEAT.extras + index * 120)]}>
            <Icon name={extra.icon} size={22} color={extra.color} />
            <AppText variant="bodyStrong">{extra.text}</AppText>
          </Animated.View>
        ))}

        {passed ? (
          <Animated.View style={[styles.feedback, riseIn(BEAT.extras + extras.length * 120 + 200)]}>
            <QuickFeedback context="lesson" subject={lesson.id} />
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {passed ? (
          <>
            {next && onNextLesson ? (
              <Button testID="next-lesson" label="Next lesson" iconRight="arrow-right" onPress={() => onNextLesson(next.id)} />
            ) : null}
            <Button
              testID="lesson-done"
              label={next && onNextLesson ? 'Done' : 'Continue'}
              variant={next && onNextLesson ? 'ghost' : 'primary'}
              size={next && onNextLesson ? 'medium' : 'large'}
              onPress={onContinue}
            />
          </>
        ) : (
          <>
            <Button testID="lesson-retry" label="Try again" onPress={onRetry} />
            <Button label="Back to path" variant="ghost" size="medium" onPress={onContinue} />
          </>
        )}
      </View>

      {levelUp === 'showing' ? <LevelUpOverlay level={reward.levelAfter} onClose={() => setLevelUp('done')} /> : null}
    </View>
  );
}

function Stat({
  label,
  value,
  color,
  icon,
  testID,
}: {
  label: string;
  value: string;
  color: string;
  icon: IconName;
  testID?: string;
}) {
  return (
    <View style={[styles.stat, { borderColor: color }]} testID={testID}>
      <AppText variant="caption" style={[styles.statLabel, { backgroundColor: color }]} color="textInverse">
        {label.toUpperCase()}
      </AppText>
      <View style={styles.statValue}>
        <Icon name={icon} size={18} color={color} />
        <AppText variant="number" color={color}>
          {value}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  feedback: { alignSelf: 'stretch' },
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: SCREEN_GUTTER,
    paddingBottom: 200,
    gap: spacing.lg,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  middleStar: { marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    borderWidth: 2,
    borderRadius: radii.lg,
    overflow: 'hidden',
    alignItems: 'center',
  },
  statLabel: {
    alignSelf: 'stretch',
    textAlign: 'center',
    paddingVertical: 3,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
  },
  breakdown: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: -spacing.xs },
  breakdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderColor: colors.primary },
  inGameCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderColor: 'rgba(98, 182, 255, 0.35)' },
  nextText: { flex: 1 },
  premiumCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderColor: 'rgba(255, 201, 77, 0.45)' },
  extra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.bg,
  },
});

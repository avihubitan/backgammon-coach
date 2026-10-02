import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useCountUp } from '@/components/ui/useCountUp';
import { getSection, type Lesson } from '@/curriculum';
import { getAchievement } from '@/features/learning/achievements';
import type { LessonReward } from '@/features/learning/progressModel';
import type { LessonOutcome } from '@/features/lessons/engine/session';
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

const popIn = (delay: number) => ({
  animationName: {
    '0%': { transform: [{ scale: 0.2 }], opacity: 0 },
    '65%': { transform: [{ scale: 1.2 }], opacity: 1 },
    '100%': { transform: [{ scale: 1 }], opacity: 1 },
  },
  animationDuration: 480,
  animationDelay: delay,
  animationFillMode: 'backwards' as const,
  animationTimingFunction: 'ease-out' as const,
});

const riseIn = (delay: number) => ({
  animationName: {
    from: { transform: [{ translateY: 16 }], opacity: 0 },
    to: { transform: [{ translateY: 0 }], opacity: 1 },
  },
  animationDuration: 380,
  animationDelay: delay,
  animationFillMode: 'backwards' as const,
});

/** Celebrates a finished lesson: stars, XP, streak, unlocks and achievements. */
export function LessonComplete({ lesson, outcome, reward, onContinue, onRetry, onNextLesson }: LessonCompleteProps) {
  const insets = useSafeAreaInsets();
  const xp = useCountUp(reward.xpGained, 900, 700);
  const section = getSection(lesson.sectionId);
  const lastInSection = section?.lessons[section.lessons.length - 1]?.id === lesson.id;
  const next = reward.unlockedLessons[0];
  const passed = outcome.passed;

  const extras: { icon: IconName; color: string; text: string }[] = [];
  if (reward.streakExtended && reward.streak > 0) {
    extras.push({ icon: 'fire', color: colors.streak, text: `${reward.streak}-day streak!` });
  }
  if (reward.dailyGoalReached) extras.push({ icon: 'target', color: colors.success, text: 'Daily goal reached' });
  if (reward.levelAfter > reward.levelBefore) {
    extras.push({ icon: 'arrow-up-bold-circle', color: colors.primary, text: `Level ${reward.levelAfter} reached!` });
  }
  for (const id of reward.newAchievements) {
    const achievement = getAchievement(id);
    if (achievement) extras.push({ icon: achievement.icon, color: colors.info, text: `Achievement: ${achievement.title}` });
  }

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

        <View style={styles.stars} accessibilityLabel={`${outcome.stars} of 3 stars`}>
          {[0, 1, 2].map((index) => (
            <Animated.View key={index} style={[index === 1 && styles.middleStar, popIn(250 + index * 180)]}>
              <Icon
                name="star"
                size={index === 1 ? 84 : 64}
                color={index < outcome.stars ? colors.star : colors.starEmpty}
              />
            </Animated.View>
          ))}
        </View>

        <Animated.View style={[styles.statsRow, riseIn(600)]}>
          <Stat label="XP earned" value={`+${xp}`} color={colors.xp} icon="lightning-bolt" testID="xp-earned" />
          <Stat
            label="Accuracy"
            value={`${Math.round(outcome.accuracy * 100)}%`}
            color={colors.success}
            icon="bullseye-arrow"
          />
          <Stat label="Time" value={formatDuration(outcome.durationMs)} color={colors.info} icon="timer-outline" />
        </Animated.View>

        {!passed ? (
          <Animated.View style={[styles.card, riseIn(800)]}>
            <AppText variant="bodyStrong">
              This lesson needs {Math.round(lesson.passingScore * 100)}% to pass. You’re close. Each try makes the
              patterns easier to spot.
            </AppText>
          </Animated.View>
        ) : null}

        {extras.map((extra, index) => (
          <Animated.View key={extra.text} style={[styles.extra, riseIn(850 + index * 120)]}>
            <Icon name={extra.icon} size={22} color={extra.color} />
            <AppText variant="bodyStrong">{extra.text}</AppText>
          </Animated.View>
        ))}

        {passed && next ? (
          <Animated.View style={[styles.card, styles.nextCard, riseIn(1000)]}>
            <Icon name="lock-open-variant" size={22} color="primary" />
            <View style={styles.nextText}>
              <AppText variant="caption" color="textSecondary">
                UNLOCKED
              </AppText>
              <AppText variant="bodyStrong">{next.title}</AppText>
            </View>
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
    gap: spacing.sm,
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nextText: { flex: 1 },
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

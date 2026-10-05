import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { analytics } from '@/services/analytics';
import { unlockedDrillCategories } from '@/features/practice/practiceModel';
import { useDailyPositionStore } from '@/state/dailyPositionStore';
import { useMistakesStore } from '@/state/mistakesStore';
import { usePracticeStore } from '@/state/practiceStore';
import { useProgressStore } from '@/state/progressStore';
import { useToday } from '@/state/useToday';
import { colors, radii, spacing } from '@/theme';

import { coachPlan, type CoachPick } from './coachPick';

function open({ action, topic, trigger }: Pick<CoachPick, 'action' | 'topic' | 'trigger'>, doneToday: boolean) {
  analytics.track('coach_pick_opened', { kind: action.kind, topic, done_today: doneToday, trigger });
  // `source` lets the session report a finished pick (coach_pick_completed).
  const source = 'coach_pick';
  if (action.kind === 'mistakes') router.push({ pathname: '/practice/[kind]', params: { kind: 'mistakes', source } });
  else if (action.kind === 'position') {
    router.push({ pathname: '/practice/[kind]', params: { kind: 'position', position: action.position, source } });
  } else if (action.kind === 'drill') router.push({ pathname: '/practice/[kind]', params: { kind: action.drill, source } });
  else router.push({ pathname: '/lesson/[id]', params: { id: action.lessonId, source } });
}

const ACTION_NAME = { mistakes: 'Your positions', position: 'One of your positions', drill: 'Drill', lesson: 'Lesson replay' } as const;

/** One more suggestion under the pick: a single tappable row. */
function MoreRow({ pick, doneToday }: { pick: CoachPick; doneToday: boolean }) {
  return (
    <Pressable
      testID={`coach-more-${pick.trigger}`}
      accessibilityRole="button"
      accessibilityLabel={`${pick.topic}, ${ACTION_NAME[pick.action.kind].toLowerCase()}, about ${pick.minutes} minutes`}
      onPress={() => open(pick, doneToday)}
      style={({ pressed }) => [styles.more, pressed && styles.pressed]}
    >
      <Icon name={pick.icon} size={18} color="textSecondary" />
      <View style={styles.flex}>
        <AppText variant="smallStrong" numberOfLines={1}>
          {pick.topic}
        </AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {ACTION_NAME[pick.action.kind]} · {pick.minutes} min
        </AppText>
      </View>
      <Icon name="chevron-right" size={18} color="textMuted" />
    </Pressable>
  );
}

function Minutes({ minutes }: { minutes: number }) {
  return (
    <View style={styles.minutes} accessibilityLabel={`About ${minutes} minutes`}>
      <Icon name="clock-outline" size={12} color={colors.textSecondary} />
      <AppText variant="caption" color="textSecondary">
        {minutes} min
      </AppText>
    </View>
  );
}

/**
 * "Recommended for you": the coach's one pick, from the player's own games
 * and answers, with how long it takes, and a couple of other things worth
 * doing.
 */
export function CoachPickCard({ enterDelay }: { enterDelay?: number }) {
  const mistakes = useMistakesStore((state) => state.mistakes);
  const bySkill = useProgressStore((state) => state.stats.bySkill);
  const lessons = useProgressStore((state) => state.lessons);
  const practiced = usePracticeStore((state) => state.records);
  const access = useFeatureAccess();
  const { day: today } = useToday();
  // Today's Position of the Day, kept by its card: the pick offers a different position.
  const dailyPosition = useDailyPositionStore((state) => (state.day === today ? state.ref : null));
  const plan = coachPlan({
    mistakes,
    bySkill,
    lessons,
    unlockedDrills: unlockedDrillCategories(lessons).map((info) => info.id),
    canPracticeMistakes: access.canUseAdvancedTraining(),
    canAccessLesson: access.canAccessLesson,
    today,
    practiced,
    dailyPosition,
  });
  if (!plan) return null;
  const { pick, done, next, more } = plan;
  const moreRows =
    more.length > 0 ? (
      <View style={styles.moreList}>
        <AppText variant="caption" color="textMuted">
          ALSO FOR YOU
        </AppText>
        {more.map((other) => (
          <MoreRow key={`${other.trigger}-${other.topic}`} pick={other} doneToday={done} />
        ))}
      </View>
    ) : null;

  if (done) {
    return (
      <Card style={[styles.card, styles.cardDone]} testID="coach-pick" enterDelay={enterDelay}>
        <View style={styles.top}>
          <View style={[styles.icon, styles.iconDone]}>
            <Icon name="check-bold" size={24} color="success" />
          </View>
          <View style={styles.flex}>
            <AppText variant="label" color="success">
              Coach’s pick · done
            </AppText>
            <AppText variant="subheading">{pick.topic}: done for today</AppText>
          </View>
        </View>
        <AppText variant="small" color="textSecondary">
          Nice work. A little practice every day is what makes it stick.
          {next ? ` Next up: ${next.topic.toLowerCase()}.` : ' Your coach picks again tomorrow.'}
        </AppText>
        {next ? (
          <Button
            testID="coach-pick-next"
            label={`Keep going · ${next.minutes} min`}
            iconRight="arrow-right"
            variant="secondary"
            size="medium"
            onPress={() => open(next, true)}
          />
        ) : null}
        {moreRows}
      </Card>
    );
  }

  return (
    <Card style={styles.card} testID="coach-pick" enterDelay={enterDelay}>
      <View style={styles.top}>
        <View style={styles.icon}>
          <Icon name={pick.icon} size={24} color="info" />
        </View>
        <View style={styles.flex}>
          <View style={styles.labelRow}>
            <AppText variant="label" color="info" style={styles.flex}>
              Your coach’s pick
            </AppText>
            <Minutes minutes={pick.minutes} />
          </View>
          <AppText variant="subheading" testID="coach-pick-title">
            {pick.title}
          </AppText>
        </View>
      </View>
      <AppText variant="small" color="textSecondary">
        {pick.reason}
      </AppText>
      <Button
        testID="coach-pick-start"
        label={pick.actionLabel}
        icon="target"
        variant="secondary"
        size="medium"
        onPress={() => open(pick, false)}
      />
      {moreRows}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, borderColor: 'rgba(98, 182, 255, 0.35)' },
  cardDone: { borderColor: 'rgba(61, 214, 140, 0.35)' },
  iconDone: { backgroundColor: colors.successSoft },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.infoSoft,
  },
  minutes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  moreList: { gap: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.bgElevated,
  },
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },
});

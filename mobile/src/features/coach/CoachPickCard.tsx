import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { curriculum } from '@/curriculum';
import { useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { analytics } from '@/services/analytics';
import { unlockedDrillCategories } from '@/features/practice/practiceModel';
import { useMistakesStore } from '@/state/mistakesStore';
import { usePracticeStore } from '@/state/practiceStore';
import { todayKey, useProgressStore } from '@/state/progressStore';
import { colors, radii, spacing } from '@/theme';

import { coachPlan, type CoachPick } from './coachPick';

function open({ action, topic }: Pick<CoachPick, 'action' | 'topic'>, doneToday: boolean) {
  analytics.track('coach_pick_opened', { kind: action.kind, topic, done_today: doneToday });
  // `source` lets the session report a finished pick (coach_pick_completed).
  const source = 'coach_pick';
  if (action.kind === 'mistakes') router.push({ pathname: '/practice/[kind]', params: { kind: 'mistakes', source } });
  else if (action.kind === 'drill') router.push({ pathname: '/practice/[kind]', params: { kind: action.drill, source } });
  else router.push({ pathname: '/lesson/[id]', params: { id: action.lessonId, source } });
}

/** "Coach's pick": the one thing worth practising next, from the player's own games and lessons. */
export function CoachPickCard({ enterDelay }: { enterDelay?: number }) {
  const mistakes = useMistakesStore((state) => state.mistakes);
  const byCategory = useProgressStore((state) => state.stats.byCategory);
  const lessons = useProgressStore((state) => state.lessons);
  const practiced = usePracticeStore((state) => state.records);
  const access = useFeatureAccess();
  const plan = coachPlan({
    mistakes,
    byCategory,
    lessons,
    unlockedDrills: unlockedDrillCategories(lessons, curriculum).map((info) => info.id),
    canPracticeMistakes: access.canUseAdvancedTraining(),
    canAccessLesson: access.canAccessLesson,
    today: todayKey(),
    practiced,
  });
  if (!plan) return null;
  const { pick, done, next } = plan;

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
            label="Keep going"
            iconRight="arrow-right"
            variant="secondary"
            size="medium"
            onPress={() => open(next, true)}
          />
        ) : null}
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
          <AppText variant="label" color="info">
            Your coach’s pick
          </AppText>
          <AppText variant="subheading">Let’s work on {pick.topic.toLowerCase()}.</AppText>
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
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, borderColor: 'rgba(98, 182, 255, 0.35)' },
  cardDone: { borderColor: 'rgba(61, 214, 140, 0.35)' },
  iconDone: { backgroundColor: colors.successSoft },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.infoSoft,
  },
  flex: { flex: 1 },
});

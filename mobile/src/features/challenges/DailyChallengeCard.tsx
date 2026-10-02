import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { nextLesson } from '@/features/learning/progression';
import { useChallengeStore } from '@/state/challengeStore';
import { todayKey, useProgressStore } from '@/state/progressStore';
import { colors, radii, spacing } from '@/theme';

import { currentChallengeContext } from './challengeService';
import { getChallenge, type ChallengeAction } from './challenges';

function go(action: ChallengeAction) {
  if (action.kind === 'play') {
    router.push('/play');
  } else if (action.kind === 'practice') {
    router.push({ pathname: '/practice/[kind]', params: { kind: action.category } });
  } else {
    const lesson = nextLesson(useProgressStore.getState().lessons);
    if (lesson) router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } });
    else router.push('/practice');
  }
}

/** Today's optional challenge, with live progress. `compact` is a single tappable row. */
export function DailyChallengeCard({ enterDelay, compact = false }: { enterDelay?: number; compact?: boolean }) {
  const today = todayKey();
  const daily = useChallengeStore((state) => state.daily);
  const ensure = useChallengeStore((state) => state.ensure);

  // Fix today's pick the first time it's shown, so it can't change mid-day.
  useEffect(() => {
    if (daily?.day !== today) ensure(today, currentChallengeContext());
  }, [daily?.day, today, ensure]);

  const state = daily?.day === today ? daily : null;
  const challenge = state ? getChallenge(state.id) : undefined;
  if (!state || !challenge) return null;
  const done = !!state.completedAt;

  if (compact) {
    return (
      <Card
        style={styles.compact}
        testID="daily-challenge"
        enterDelay={enterDelay}
        accessibilityLabel={`Daily challenge: ${challenge.title}, ${state.progress} of ${challenge.target}`}
        onPress={done ? undefined : () => go(challenge.action)}
      >
        <View style={[styles.compactIcon, { backgroundColor: done ? colors.success : colors.primary }]}>
          <Icon name={done ? 'check-bold' : challenge.icon} size={20} color="textInverse" />
        </View>
        <View style={styles.flex}>
          <View style={styles.top}>
            <AppText variant="caption" color={done ? 'success' : 'primary'}>
              DAILY CHALLENGE
            </AppText>
            <AppText variant="caption" color={done ? colors.success : colors.xp}>
              {done ? 'Done!' : `+${challenge.xp} XP`}
            </AppText>
          </View>
          <AppText variant="bodyStrong" numberOfLines={1} testID="daily-challenge-title">
            {challenge.title}
          </AppText>
          <View style={styles.progressRow}>
            <View style={styles.flex}>
              <ProgressBar
                progress={state.progress / challenge.target}
                color={done ? colors.success : colors.primary}
                height={6}
                shine={false}
              />
            </View>
            <AppText variant="caption" color="textSecondary" testID="daily-challenge-progress">
              {state.progress}/{challenge.target}
            </AppText>
          </View>
        </View>
        {done ? null : <Icon name="chevron-right" size={22} color="textMuted" />}
      </Card>
    );
  }

  return (
    <Card style={[styles.card, done && styles.cardDone]} testID="daily-challenge" enterDelay={enterDelay}>
      <View style={styles.top}>
        <AppText variant="label" color={done ? 'success' : 'primary'}>
          Daily challenge
        </AppText>
        <View style={styles.xp}>
          <Icon name={done ? 'check-bold' : 'lightning-bolt'} size={13} color={done ? colors.success : colors.xp} />
          <AppText variant="caption" color={done ? colors.success : colors.xp}>
            {done ? `Earned ${challenge.xp} XP` : `+${challenge.xp} XP`}
          </AppText>
        </View>
      </View>
      <View style={styles.body}>
        <View style={[styles.icon, { backgroundColor: done ? colors.success : colors.primary }]}>
          <Icon name={done ? 'check-bold' : challenge.icon} size={24} color="textInverse" />
        </View>
        <View style={styles.flex}>
          <AppText variant="subheading" testID="daily-challenge-title">
            {challenge.title}
          </AppText>
          <AppText variant="small" color="textSecondary">
            {done ? 'Done for today. A new challenge arrives tomorrow.' : challenge.description}
          </AppText>
        </View>
      </View>
      <View style={styles.progressRow}>
        <View style={styles.flex}>
          <ProgressBar
            progress={state.progress / challenge.target}
            color={done ? colors.success : colors.primary}
            height={10}
            accessibilityLabel={`${state.progress} of ${challenge.target}`}
          />
        </View>
        <AppText variant="caption" color="textSecondary" testID="daily-challenge-progress">
          {state.progress}/{challenge.target}
        </AppText>
      </View>
      {done ? null : (
        <Button
          testID="daily-challenge-go"
          label="Go"
          icon="arrow-right"
          variant="secondary"
          size="medium"
          onPress={() => go(challenge.action)}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  compact: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  compactIcon: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  cardDone: { borderColor: 'rgba(61, 214, 140, 0.4)' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  xp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  body: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 48, height: 48, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});

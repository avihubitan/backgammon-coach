import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { SKILLS } from '@/curriculum';
import { POSITION_MINUTES } from '@/features/learning/timeEstimates';
import { useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { useDailyPositionStore } from '@/state/dailyPositionStore';
import { useMistakesStore } from '@/state/mistakesStore';
import { useProgressStore } from '@/state/progressStore';
import { useToday } from '@/state/useToday';
import { colors, radii, spacing } from '@/theme';

import { anotherLike, dailyPosition, parseRef, refKey, skillOfRef, type PositionRef } from './positionOfTheDay';

const NONE: string[] = [];

function openPosition(params: { daily: '1' } | { position: string }) {
  router.push({ pathname: '/practice/[kind]', params: { kind: 'position', source: 'daily_position', ...params } });
}

/** A fixed number from today's date, so "Try another" is stable through the day. */
const daySeed = (day: string) => Number(day.split('-').join(''));

/**
 * Position of the Day on Home: one real position a day ("What would you
 * play?"), from the learner's own games when one is due, else from the skill
 * they most need. Once answered, it offers another with the same idea.
 */
export function PositionOfTheDayCard({ enterDelay }: { enterDelay?: number }) {
  const { day } = useToday();
  const mistakes = useMistakesStore((state) => state.mistakes);
  const lessons = useProgressStore((state) => state.lessons);
  const bySkill = useProgressStore((state) => state.stats.bySkill);
  const reviewQueue = useFeatureAccess().canUseAdvancedTraining();
  const storedDay = useDailyPositionStore((state) => state.day);
  const storedRef = useDailyPositionStore((state) => state.ref);
  const done = useDailyPositionStore((state) => state.day === day && state.done);
  const correct = useDailyPositionStore((state) => state.day === day && state.correct === true);
  const seen = useDailyPositionStore((state) => (state.day === day ? state.seen : NONE));
  const ref = dailyPosition({ day, stored: { day: storedDay, ref: storedRef }, mistakes, lessons, bySkill, reviewQueue });
  const key = ref ? refKey(ref) : null;

  // Fix today's position the first time it's shown, so a game or a lesson later today can't change it.
  useEffect(() => {
    if (key && (storedDay !== day || storedRef !== key)) useDailyPositionStore.getState().keep(day, parseRef(key));
  }, [day, key, storedDay, storedRef]);

  const skill = ref ? skillOfRef(ref, mistakes) : null;
  if (!ref || !skill) return null;
  const fromGame = ref.source === 'mistake';

  if (done) {
    const seenBank = seen.map(parseRef).filter((seenRef): seenRef is PositionRef => seenRef?.source === 'bank');
    const another = anotherLike(skill, [...seenBank.map((seenRef) => seenRef.id), ref.id], daySeed(day));
    return (
      <Card
        style={[styles.card, styles.cardDone]}
        testID="daily-position"
        enterDelay={enterDelay}
        accessibilityLabel={another ? 'Position of the Day done. Try another like it' : 'Position of the Day done'}
        onPress={another ? () => openPosition({ position: refKey(another) }) : undefined}
      >
        <View style={[styles.icon, { backgroundColor: colors.success }]}>
          <Icon name="check-bold" size={20} color="textInverse" />
        </View>
        <View style={styles.flex}>
          <AppText variant="caption" color="success">
            POSITION OF THE DAY · DONE
          </AppText>
          <AppText variant="bodyStrong" testID="daily-position-title">
            {correct ? 'You found the best move.' : 'Now you know the idea.'}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {another ? `Try another about ${SKILLS[skill].doing}` : 'A new position arrives tomorrow.'}
          </AppText>
        </View>
        {another ? <Icon name="chevron-right" size={22} color="textMuted" /> : null}
      </Card>
    );
  }

  return (
    <Card
      style={styles.card}
      testID="daily-position"
      enterDelay={enterDelay}
      accessibilityLabel={`Position of the Day: what would you play? ${SKILLS[skill].title}, about ${POSITION_MINUTES} minute`}
      onPress={() => openPosition({ daily: '1' })}
    >
      <View style={[styles.icon, { backgroundColor: colors.info }]}>
        <Icon name="lightbulb-on-outline" size={20} color="textInverse" />
      </View>
      <View style={styles.flex}>
        <View style={styles.top}>
          <AppText variant="caption" color="info">
            POSITION OF THE DAY
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {POSITION_MINUTES} min
          </AppText>
        </View>
        <AppText variant="bodyStrong" testID="daily-position-title">
          What would you play?
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {fromGame ? `From your game · ${SKILLS[skill].title}` : `A real position · ${SKILLS[skill].title}`}
        </AppText>
      </View>
      <Icon name="chevron-right" size={22} color="textMuted" />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  cardDone: { borderColor: 'rgba(61, 214, 140, 0.4)' },
  icon: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flex: { flex: 1 },
});

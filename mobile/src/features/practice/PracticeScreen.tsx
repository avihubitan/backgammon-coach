import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Stars } from '@/components/ui/Stars';
import { allLessons, curriculum, getSection } from '@/curriculum';
import { DRILL_CATEGORIES } from '@/curriculum/drills';
import { DailyChallengeCard } from '@/features/challenges/DailyChallengeCard';
import { useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { useMistakesStore } from '@/state/mistakesStore';
import { usePracticeStore } from '@/state/practiceStore';
import { useProgressStore } from '@/state/progressStore';
import { colors, radii, spacing } from '@/theme';

import { isMastered } from './mistakes';
import { SESSION_LENGTH, unlockedDrillCategories } from './practiceModel';

/** Daily challenge, skill drills, your own mistakes, and lesson replays. */
export function PracticeScreen() {
  const lessons = useProgressStore((state) => state.lessons);
  const records = usePracticeStore((state) => state.records);
  const mistakes = useMistakesStore((state) => state.mistakes);
  const unlocked = new Set(unlockedDrillCategories(lessons, curriculum).map((info) => info.id));
  const openMistakes = mistakes.filter((mistake) => !isMastered(mistake)).length;
  const canPracticeMistakes = useFeatureAccess().canUseAdvancedTraining();
  const completed = allLessons
    .filter((lesson) => lessons[lesson.id]?.completed)
    .sort((a, b) => (lessons[a.id]?.bestStars ?? 0) - (lessons[b.id]?.bestStars ?? 0));

  return (
    <Screen
      testID="practice-screen"
      header={
        <View style={styles.header}>
          <AppText variant="title">Practice</AppText>
          <AppText variant="small" color="textSecondary">
            Short drills that make the patterns automatic.
          </AppText>
        </View>
      }
    >
      <DailyChallengeCard enterDelay={0} />

      <AppText variant="label" color="textSecondary">
        Skill drills
      </AppText>
      <View style={styles.grid}>
        {DRILL_CATEGORIES.map((info, index) => {
          const open = unlocked.has(info.id);
          const record = records[info.id];
          const section = curriculum.find((entry) => entry.id === info.requiresSection);
          return (
            <View key={info.id} style={styles.cell}>
              <Card
                testID={`drill-${info.id}`}
                style={[styles.drill, !open && styles.drillLocked]}
                enterDelay={60 + index * 50}
                accessibilityLabel={open ? `${info.title} drill` : `${info.title}, locked`}
                onPress={
                  open
                    ? () => router.push({ pathname: '/practice/[kind]', params: { kind: info.id } })
                    : () => router.push('/learn')
                }
              >
                <View style={[styles.drillIcon, { backgroundColor: open ? info.color : colors.locked }]}>
                  <Icon name={open ? info.icon : 'lock'} size={22} color={open ? 'textInverse' : 'textMuted'} />
                </View>
                <AppText variant="bodyStrong" color={open ? 'text' : 'textMuted'} numberOfLines={1}>
                  {info.title}
                </AppText>
                <AppText variant="caption" color="textSecondary" numberOfLines={2} style={styles.drillText}>
                  {open ? info.description : `Unlocks after “${section?.title ?? ''}”`}
                </AppText>
                {open ? (
                  <AppText variant="caption" color={record ? 'success' : 'textMuted'}>
                    {record ? `Best ${record.bestFirstTry}/${SESSION_LENGTH}` : 'Not tried yet'}
                  </AppText>
                ) : null}
              </Card>
            </View>
          );
        })}
      </View>

      <AppText variant="label" color="textSecondary">
        Your mistakes
      </AppText>
      <Card style={styles.mistakes} testID="mistakes-card">
        <View style={styles.mistakesTop}>
          <View style={[styles.drillIcon, { backgroundColor: openMistakes > 0 ? colors.danger : colors.surfaceRaised }]}>
            <Icon name="auto-fix" size={22} color={openMistakes > 0 ? 'textInverse' : 'textMuted'} />
          </View>
          <View style={styles.flex}>
            <AppText variant="subheading">
              {openMistakes > 0 ? `${openMistakes} position${openMistakes === 1 ? '' : 's'} to fix` : 'Nothing to fix yet'}
            </AppText>
            <AppText variant="small" color="textSecondary">
              {openMistakes > 0
                ? 'Moves you got wrong in your games. Find the better move twice to master each one.'
                : 'Play a game and open its review: your mistakes are collected here.'}
            </AppText>
          </View>
        </View>
        {openMistakes > 0 ? (
          canPracticeMistakes ? (
            <Button
              testID="practice-mistakes"
              label="Practice my mistakes"
              icon="target"
              size="medium"
              onPress={() => router.push({ pathname: '/practice/[kind]', params: { kind: 'mistakes' } })}
            />
          ) : (
            <Button
              testID="practice-mistakes-premium"
              label="Practice them with Premium"
              icon="crown"
              variant="secondary"
              size="medium"
              onPress={() => router.push({ pathname: '/paywall', params: { source: 'mistakes' } })}
            />
          )
        ) : null}
      </Card>

      {completed.length > 0 ? (
        <>
          <AppText variant="label" color="textSecondary">
            Replay lessons
          </AppText>
          {completed.map((lesson) => {
            const section = getSection(lesson.sectionId);
            const stars = lessons[lesson.id]?.bestStars ?? 0;
            return (
              <Card
                key={lesson.id}
                testID={`review-${lesson.id}`}
                style={styles.row}
                accessibilityLabel={`Replay ${lesson.title}`}
                onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })}
              >
                <View style={[styles.lessonIcon, { backgroundColor: section?.color ?? colors.primary }]}>
                  <Icon name={lesson.icon} size={22} color="textInverse" />
                </View>
                <View style={styles.flex}>
                  <AppText variant="subheading">{lesson.title}</AppText>
                  <AppText variant="caption" color="textSecondary">
                    {section?.title}
                  </AppText>
                </View>
                <Stars count={stars} size={16} />
              </Card>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: spacing.md, gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  cell: { width: '50%', padding: spacing.xs },
  drill: { gap: spacing.xs, minHeight: 150 },
  drillLocked: { opacity: 0.75 },
  drillIcon: { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  drillText: { flex: 1 },
  mistakes: { gap: spacing.md },
  mistakesTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lessonIcon: { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});

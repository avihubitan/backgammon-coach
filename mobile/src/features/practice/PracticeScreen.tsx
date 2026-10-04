import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Stars } from '@/components/ui/Stars';
import { allLessons, getLesson, getSection, SKILL_GROUPS, SKILLS } from '@/curriculum';
import { DRILL_CATEGORIES, type DrillCategoryInfo } from '@/curriculum/drills';
import { DailyChallengeCard } from '@/features/challenges/DailyChallengeCard';
import { useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { useMistakesStore } from '@/state/mistakesStore';
import { usePracticeStore } from '@/state/practiceStore';
import { useProgressStore } from '@/state/progressStore';
import { useToday } from '@/state/useToday';
import { colors, radii, spacing } from '@/theme';

import { levelProgress, openLevels } from './drillLevels';
import { dueIn, dueMistakes, isMastered, nextDueDay } from './mistakes';
import { unlockedDrillCategories } from './practiceModel';

/** Drills under the skill group they train, in path order. */
const DRILL_GROUPS = SKILL_GROUPS.map((group) => ({
  group,
  drills: DRILL_CATEGORIES.filter((info) => SKILLS[info.skill].group === group.id),
})).filter((entry) => entry.drills.length > 0);

/** Daily challenge, skill drills, your own mistakes, and lesson replays. */
export function PracticeScreen() {
  const lessons = useProgressStore((state) => state.lessons);
  const records = usePracticeStore((state) => state.records);
  const mistakes = useMistakesStore((state) => state.mistakes);
  const unlocked = new Set(unlockedDrillCategories(lessons).map((info) => info.id));
  const { day: today } = useToday();
  const openMistakes = mistakes.filter((mistake) => !isMastered(mistake)).length;
  const due = dueMistakes(mistakes, today).length;
  const next = due === 0 ? nextDueDay(mistakes, today) : null;
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

      {DRILL_GROUPS.map(({ group, drills }) => (
        <View key={group.id} style={styles.group}>
          <AppText variant="label" color="textSecondary">
            {group.title}
          </AppText>
          <View style={styles.grid}>
            {drills.map((info, index) => (
              <DrillTile
                key={info.id}
                info={info}
                open={unlocked.has(info.id)}
                tried={!!records[info.id]}
                level={levelProgress(info, (lessonId) => !!lessons[lessonId]?.completed, records[info.id]?.levels ?? {})}
                questions={openLevels(info, (lessonId) => !!lessons[lessonId]?.completed).length}
                enterDelay={60 + index * 50}
              />
            ))}
          </View>
        </View>
      ))}

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
              {openMistakes === 0
                ? 'Nothing to fix yet'
                : due > 0
                  ? `${due} position${due === 1 ? '' : 's'} due today`
                  : `${openMistakes} position${openMistakes === 1 ? '' : 's'} to fix`}
            </AppText>
            <AppText variant="small" color="textSecondary">
              {openMistakes === 0
                ? 'Play a game and open its review: your mistakes are collected here.'
                : due > 0
                  ? 'Moves you got wrong in your games come back until they stick: soon at first, then further apart each time you find them.'
                  : `All caught up. The next one comes back ${next ? dueIn(next, today) : 'soon'}.`}
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

function DrillTile({
  info,
  open,
  tried,
  level,
  questions,
  enterDelay,
}: {
  info: DrillCategoryInfo;
  open: boolean;
  tried: boolean;
  level: ReturnType<typeof levelProgress>;
  /** Open questions, for drills that mix every level. */
  questions: number;
  enterDelay: number;
}) {
  const lesson = getLesson(info.requiresLesson);
  return (
    <View style={styles.cell}>
      <Card
        testID={`drill-${info.id}`}
        style={[styles.drill, !open && styles.drillLocked]}
        enterDelay={enterDelay}
        accessibilityLabel={open ? `${info.title} drill${level ? `, level ${level.number} of ${level.of}` : ''}` : `${info.title}, locked`}
        onPress={open ? () => router.push({ pathname: '/practice/[kind]', params: { kind: info.id } }) : () => router.push('/learn')}
      >
        <View style={[styles.drillIcon, { backgroundColor: open ? info.color : colors.locked }]}>
          <Icon name={open ? info.icon : 'lock'} size={22} color={open ? 'textInverse' : 'textMuted'} />
        </View>
        <AppText variant="bodyStrong" color={open ? 'text' : 'textMuted'} numberOfLines={1}>
          {info.title}
        </AppText>
        <AppText variant="caption" color="textSecondary" numberOfLines={2} style={styles.drillText}>
          {open ? info.description : `Unlocks after “${lesson?.title ?? ''}”`}
        </AppText>
        {open && level ? (
          <AppText variant="caption" color={tried ? 'success' : 'textMuted'} numberOfLines={2}>
            {info.mixLevels
              ? `${questions} of ${info.levels.length} questions`
              : level.allCleared
                ? 'All levels cleared'
                : `Level ${level.number}/${level.of} · ${level.level.title}`}
          </AppText>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
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

import { router } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { BackgammonBoard } from '@/components/board/BackgammonBoard';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { allLessons, curriculum } from '@/curriculum';
import { START } from '@/curriculum/builders';
import { FEATURE_UNLOCKS, nextLesson, type LessonRecords } from '@/features/learning/progression';
import { createBoard } from '@/game';
import { colors, MAX_CONTENT_WIDTH, SCREEN_GUTTER, spacing } from '@/theme';

/** Shown on the Play tab until the learner knows enough rules to enjoy a full game. */
export function PlayLockedView({ records }: { records: LessonRecords }) {
  const { width } = useWindowDimensions();
  const unlock = FEATURE_UNLOCKS.find((feature) => feature.id === 'play')!;
  const sectionIndex = curriculum.findIndex((section) => section.id === unlock.requiresSection);
  const required = sectionIndex >= 0 ? curriculum.slice(0, sectionIndex + 1).flatMap((section) => section.lessons) : allLessons;
  const done = required.filter((lesson) => records[lesson.id]?.completed).length;
  const sectionTitle = curriculum[sectionIndex]?.title ?? 'the rules sections';
  const upNext = nextLesson(records);

  return (
    <View style={styles.wrap}>
      <View style={styles.boardWrap}>
        <View style={styles.dim}>
          <BackgammonBoard board={createBoard(START)} width={Math.min(width, MAX_CONTENT_WIDTH) - SCREEN_GUTTER * 2} showPointNumbers={false} />
        </View>
        <View style={styles.lockBadge}>
          <Icon name="lock" size={30} color="textInverse" />
        </View>
      </View>
      <View style={styles.text}>
        <AppText variant="title" align="center">
          Play vs Computer
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          Finish “{sectionTitle}” first. By then you’ll know every rule you need for a full game.
        </AppText>
      </View>
      <Card style={styles.progressCard}>
        <View style={styles.row}>
          <AppText variant="subheading">Rules learned</AppText>
          <AppText variant="smallStrong" color="textSecondary">
            {done}/{required.length} lessons
          </AppText>
        </View>
        <ProgressBar progress={required.length ? done / required.length : 0} color={colors.primary} />
      </Card>
      {upNext ? (
        <Button
          label="Continue learning"
          icon="play"
          onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: upNext.id } })}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl, alignItems: 'center' },
  boardWrap: { alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.35 },
  lockBadge: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 8px 24px rgba(0,0,0,0.5)',
  },
  text: { gap: spacing.sm, paddingHorizontal: spacing.md },
  progressCard: { alignSelf: 'stretch', gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

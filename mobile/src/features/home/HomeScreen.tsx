import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { StatChip } from '@/components/ui/StatChip';
import { allLessons, curriculum, getSection, sectionNumber } from '@/curriculum';
import { DailyChallengeCard } from '@/features/challenges/DailyChallengeCard';
import { CoachPickCard } from '@/features/coach/CoachPickCard';
import {
  currentSection,
  isFeatureUnlocked,
  levelInfo,
  maxLessonXp,
  nextLesson,
  premiumLessonsLeft,
  sectionProgress,
  streakStatus,
} from '@/features/learning/progression';
import { todayXp } from '@/features/learning/progressModel';
import { useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { todayKey, useProgressStore } from '@/state/progressStore';
import { colors, radii, spacing } from '@/theme';

import { StreakCard } from './StreakCard';

export function HomeScreen() {
  const progress = useProgressStore();
  const today = todayKey();
  const level = levelInfo(progress.xp);
  const streakNow = streakStatus(progress.streak, today);
  const streak = streakNow.days;
  const xpToday = todayXp(progress, today);
  const goal = progress.dailyGoalXp;
  const canAccess = useFeatureAccess().canAccessLesson;
  const lesson = nextLesson(progress.lessons, allLessons, canAccess);
  const section = currentSection(progress.lessons, curriculum, canAccess);
  const sectionStats = sectionProgress(section, progress.lessons, allLessons, canAccess);
  const premiumLeft = lesson ? [] : premiumLessonsLeft(progress.lessons, allLessons, canAccess);
  const premiumSection = premiumLeft.length > 0 ? getSection(premiumLeft[0].sectionId) : undefined;
  const startedPath = Object.values(progress.lessons).some((record) => record.completed);
  const playUnlocked = isFeatureUnlocked('play', progress.lessons);

  return (
    <Screen
      testID="home-screen"
      header={
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="label" color="primary">
              Backgammon Coach
            </AppText>
            <AppText variant="title" numberOfLines={1}>
              {greeting()}
            </AppText>
          </View>
          <View style={styles.chips}>
            <StatChip
              testID="streak-chip"
              icon="fire"
              value={streak}
              color={colors.streak}
              muted={streak === 0}
              accessibilityLabel={`${streak} day streak`}
            />
            <StatChip
              icon="lightning-bolt"
              value={progress.xp}
              color={colors.xp}
              accessibilityLabel={`${progress.xp} XP`}
            />
          </View>
        </View>
      }
    >
      <Card style={styles.levelCard} enterDelay={0}>
        <View style={styles.levelBadge}>
          <AppText variant="caption" color="textInverse">
            LEVEL
          </AppText>
          <AppText variant="title" color="textInverse" testID="level-number">
            {level.level}
          </AppText>
        </View>
        <View style={styles.levelBody}>
          <View style={styles.levelRow}>
            <AppText variant="subheading">Level {level.level}</AppText>
            <AppText variant="caption" color="textSecondary">
              {level.toNext} XP to level {level.level + 1}
            </AppText>
          </View>
          <ProgressBar progress={level.progress} color={colors.primary} height={10} />
        </View>
      </Card>

      {lesson ? (
        <Card tone="accent" style={styles.continueCard} testID="continue-card" enterDelay={90}>
          <View style={styles.continueTop}>
            <View style={[styles.sectionIcon, { backgroundColor: section.color }]}>
              <Icon name={section.icon} size={26} color="textInverse" />
            </View>
            <View style={styles.flex}>
              <AppText variant="label" color="textSecondary">
                Section {sectionNumber(section.id)} · {section.title}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {sectionStats.completed} of {sectionStats.total} lessons
              </AppText>
            </View>
          </View>
          <ProgressBar
            progress={sectionStats.fraction}
            color={section.color}
            accessibilityLabel={`${Math.round(sectionStats.fraction * 100)}% of section complete`}
          />
          <View>
            <View style={styles.nextRow}>
              <AppText variant="caption" color="textSecondary">
                {startedPath ? 'NEXT UP' : 'START HERE'}
              </AppText>
              <View style={styles.xpChip}>
                <Icon name="lightning-bolt" size={13} color={colors.xp} />
                <AppText variant="caption" color={colors.xp}>
                  Up to {maxLessonXp(lesson)} XP
                </AppText>
              </View>
            </View>
            <AppText variant="title" testID="next-lesson-title">
              {lesson.title}
            </AppText>
            <AppText variant="small" color="textSecondary">
              {lesson.description}
            </AppText>
          </View>
          <Button
            testID="continue-learning"
            label={startedPath ? 'Continue learning' : 'Start learning'}
            icon="play"
            onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })}
          />
        </Card>
      ) : premiumSection ? (
        <Card tone="accent" style={styles.continueCard} testID="premium-continue-card" enterDelay={90}>
          <View style={styles.continueTop}>
            <View style={[styles.sectionIcon, { backgroundColor: premiumSection.color }]}>
              <Icon name={premiumSection.icon} size={26} color="textInverse" />
            </View>
            <View style={styles.flex}>
              <AppText variant="label" color="textSecondary">
                Section {sectionNumber(premiumSection.id)} · {premiumSection.title}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                You’ve finished every free lesson
              </AppText>
            </View>
          </View>
          <View>
            <AppText variant="caption" color="textSecondary">
              KEEP GOING
            </AppText>
            <AppText variant="title">{premiumLeft[0].title}</AppText>
            <AppText variant="small" color="textSecondary">
              {premiumLeft.length} more advanced lesson{premiumLeft.length === 1 ? '' : 's'} with Premium. Games, drills
              and replays stay free.
            </AppText>
          </View>
          <Button
            testID="home-unlock-premium"
            label="Unlock with Premium"
            icon="crown"
            onPress={() => router.push({ pathname: '/paywall', params: { source: 'home' } })}
          />
        </Card>
      ) : (
        <Card tone="accent" style={styles.continueCard} enterDelay={90}>
          <Icon name="trophy" size={40} color="primary" />
          <AppText variant="title">Path complete!</AppText>
          <AppText variant="body" color="textSecondary">
            You’ve finished every lesson. Keep sharpening your skills with practice drills and games.
          </AppText>
          <Button label="Practice" icon="target" onPress={() => router.push('/practice')} />
        </Card>
      )}

      <CoachPickCard enterDelay={150} />

      <DailyChallengeCard enterDelay={180} compact />

      <StreakCard status={streakNow} xpToday={xpToday} goal={goal} enterDelay={240} />

      <Card
        style={styles.playCard}
        enterDelay={300}
        onPress={() => router.push('/play')}
        accessibilityLabel={playUnlocked ? 'Play against the computer' : 'Play against the computer, locked'}
      >
        <View style={[styles.sectionIcon, { backgroundColor: playUnlocked ? colors.primary : colors.locked }]}>
          <Icon name={playUnlocked ? 'dice-multiple' : 'lock'} size={24} color={playUnlocked ? 'textInverse' : 'textMuted'} />
        </View>
        <View style={styles.flex}>
          <AppText variant="subheading">Play vs Computer</AppText>
          <AppText variant="small" color="textSecondary">
            {playUnlocked
              ? 'Put your skills to the test in a full game.'
              : `Unlocks after “${curriculum.find((s) => s.id === 'bearing-off')?.title ?? 'Bearing Off'}”. You’ll know every rule by then.`}
          </AppText>
        </View>
        <Icon name="chevron-right" size={24} color="textMuted" />
      </Card>
    </Screen>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Up late?';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  headerText: { flex: 1, marginRight: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, flexShrink: 0 },
  flex: { flex: 1 },
  levelCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  levelBadge: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0px 4px 0px ${colors.primaryShadow}`,
  },
  levelBody: { flex: 1, gap: spacing.sm },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  continueCard: { gap: spacing.lg, padding: spacing.xl },
  continueTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  xpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(243, 184, 71, 0.12)',
  },
  sectionIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});

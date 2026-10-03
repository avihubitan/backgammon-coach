import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { ToggleRow } from '@/components/ui/Toggle';
import { curriculum } from '@/curriculum';
import { pendingReviews, qualityTrend } from '@/features/coach/playQuality';
import { reviewPendingGames } from '@/features/coach/reviewQueue';
import { ACHIEVEMENTS } from '@/features/learning/achievements';
import { levelInfo, visibleStreak } from '@/features/learning/progression';
import { accuracy } from '@/features/learning/progressModel';
import { PremiumCard } from '@/features/monetization/PremiumCard';
import { useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { unlockedDrillCategories } from '@/features/practice/practiceModel';
import { useGameStore } from '@/state/gameStore';
import { useMistakesStore } from '@/state/mistakesStore';
import { todayKey, useProgressStore } from '@/state/progressStore';
import { resetAllProgress } from '@/state/resetAll';
import { useSettingsStore } from '@/state/settingsStore';
import { colors, MAX_CONTENT_WIDTH, radii, SCREEN_GUTTER, spacing } from '@/theme';

import { BoardStylePicker } from './components/BoardStylePicker';
import { CloudBackupCard } from './components/CloudBackupCard';
import { GamesCard } from './components/GamesCard';
import { PlayQualityCard } from './components/PlayQualityCard';
import { SkillBreakdown } from './components/SkillBreakdown';
import { WeeklyXpChart } from './components/WeeklyXpChart';
import { coachSummary, focusSkill, lastSevenDays, skillRows } from './profileStats';

export function ProfileScreen() {
  const progress = useProgressStore();
  const settings = useSettingsStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const level = levelInfo(progress.xp);
  const records = Object.values(progress.lessons);
  const completed = records.filter((record) => record.completed).length;
  const mastered = records.filter((record) => record.bestStars === 3).length;
  const unlockedCount = ACHIEVEMENTS.filter((achievement) => progress.achievements[achievement.id]).length;
  const gameStats = useGameStore((state) => state.stats);
  const finishedGames = useGameStore((state) => state.finished);
  const access = useFeatureAccess();
  const { width: windowWidth } = useWindowDimensions();
  // Two style previews per row, inside the card padding and border.
  const previewWidth = Math.floor((Math.min(windowWidth, MAX_CONTENT_WIDTH) - SCREEN_GUTTER * 2 - spacing.sm) / 2 - spacing.sm * 2 - 4);
  const mistakes = useMistakesStore((state) => state.mistakes);
  const today = todayKey();
  // Each block appears once there is something real to show.
  const skills = skillRows(progress.stats.byCategory);
  const focus = focusSkill(skills);
  const trend = qualityTrend(finishedGames);

  // Games finished before background reviews existed get reviewed here, for the trend.
  useEffect(() => {
    void reviewPendingGames();
  }, []);

  const focusDrillOpen =
    !!focus?.drill && unlockedDrillCategories(progress.lessons, curriculum).some((info) => info.id === focus.drill);

  return (
    <Screen
      testID="profile-screen"
      header={
        <View style={styles.header}>
          <AppText variant="title">Profile</AppText>
        </View>
      }
    >
      <Card style={styles.levelCard}>
        <View style={styles.avatar}>
          <Icon name="account" size={36} color="textInverse" />
        </View>
        <View style={styles.flex}>
          <AppText variant="heading">Level {level.level}</AppText>
          <AppText variant="small" color="textSecondary">
            {progress.xp} XP total · {level.toNext} XP to level {level.level + 1}
          </AppText>
          <ProgressBar progress={level.progress} height={8} style={styles.levelBar} />
        </View>
      </Card>

      <PremiumCard />

      <WeeklyXpChart days={lastSevenDays(progress.xpByDay, today)} goal={progress.dailyGoalXp} />

      <AppText variant="label" color="textSecondary">
        Statistics
      </AppText>
      <View style={styles.grid}>
        <StatTile icon="fire" color={colors.streak} value={visibleStreak(progress.streak, today)} label="Day streak" />
        <StatTile icon="calendar-star" color={colors.streak} value={progress.streak.longest} label="Best streak" />
        <StatTile icon="book-open-variant" color={colors.info} value={completed} label="Lessons done" />
        <StatTile icon="star" color={colors.star} value={mastered} label="Mastered" />
        <StatTile icon="puzzle" color={colors.success} value={progress.stats.exercisesAttempted} label="Exercises" />
        <StatTile
          icon="bullseye-arrow"
          color={colors.success}
          value={progress.stats.exercisesAttempted > 0 ? `${Math.round(accuracy(progress.stats) * 100)}%` : '–'}
          label="First-try accuracy"
        />
      </View>

      {skills.length > 0 ? (
        <>
          <AppText variant="label" color="textSecondary">
            Your skills · first-try accuracy
          </AppText>
          <SkillBreakdown rows={skills} focus={focus} drillUnlocked={focusDrillOpen} />
        </>
      ) : null}

      {gameStats.gamesPlayed > 0 ? (
        <>
          <AppText variant="label" color="textSecondary">
            Games vs computer
          </AppText>
          <GamesCard stats={gameStats} coach={mistakes.length > 0 ? coachSummary(mistakes) : null} />
          <PlayQualityCard trend={trend} pending={pendingReviews(finishedGames)} premium={access.canAnalyzeGame()} />
        </>
      ) : null}

      <View style={styles.sectionTitle}>
        <AppText variant="label" color="textSecondary">
          Achievements
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {unlockedCount}/{ACHIEVEMENTS.length}
        </AppText>
      </View>
      <View style={styles.achievements}>
        {ACHIEVEMENTS.map((achievement) => {
          const unlocked = !!progress.achievements[achievement.id];
          return (
            <View
              key={achievement.id}
              style={[styles.achievement, !unlocked && styles.achievementLocked]}
              accessibilityLabel={`${achievement.title}: ${achievement.description}${unlocked ? '' : ' (locked)'}`}
            >
              <View style={[styles.achievementIcon, { backgroundColor: unlocked ? colors.primary : colors.locked }]}>
                <Icon name={unlocked ? achievement.icon : 'lock'} size={22} color={unlocked ? 'textInverse' : 'textMuted'} />
              </View>
              <AppText variant="caption" align="center" color={unlocked ? 'text' : 'textMuted'} numberOfLines={1}>
                {achievement.title}
              </AppText>
              <AppText variant="caption" align="center" color="textMuted" numberOfLines={2} style={styles.achievementDesc}>
                {achievement.description}
              </AppText>
            </View>
          );
        })}
      </View>

      <AppText variant="label" color="textSecondary">
        Board style
      </AppText>
      <BoardStylePicker previewWidth={previewWidth} />

      <CloudBackupCard />

      <AppText variant="label" color="textSecondary">
        Settings
      </AppText>
      <Card style={styles.settings}>
        <ToggleRow
          testID="setting-sound"
          label="Sound effects"
          description="Dice, checkers and rewards. Follows your silent switch."
          value={settings.sound}
          onChange={(sound) => settings.update({ sound })}
        />
        <View style={styles.divider} />
        <ToggleRow
          testID="setting-music"
          label="Music"
          description="Calm background music on the menus"
          value={settings.music}
          onChange={(music) => settings.update({ music })}
        />
        <View style={styles.divider} />
        <ToggleRow
          label="Haptics"
          description="Vibration feedback on moves and answers"
          value={settings.haptics}
          onChange={(haptics) => settings.update({ haptics })}
        />
        <View style={styles.divider} />
        <ToggleRow
          testID="setting-analytics"
          label="Share anonymous usage data"
          description="Helps improve lessons. No personal information is collected."
          value={settings.analytics}
          onChange={(analytics) => settings.update({ analytics })}
        />
        <View style={styles.divider} />
        <ToggleRow
          label="Point numbers"
          description="Show 1–24 around the board"
          value={settings.showPointNumbers}
          onChange={(showPointNumbers) => settings.update({ showPointNumbers })}
        />
        <View style={styles.divider} />
        <ToggleRow
          label="Highlight movable checkers"
          description="Ring the checkers that can move during games"
          value={settings.showMovableHints}
          onChange={(showMovableHints) => settings.update({ showMovableHints })}
        />
      </Card>

      <Button testID="reset-progress" label="Reset progress" variant="ghost" size="medium" onPress={() => setConfirmReset(true)} />

      <ConfirmDialog
        visible={confirmReset}
        title="Reset all progress?"
        message="This erases your lessons, XP, streak, achievements, games and practice history on this device. It can’t be undone."
        confirmLabel="Erase everything"
        cancelLabel="Keep my progress"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          resetAllProgress();
        }}
      />
    </Screen>
  );
}

function StatTile({ icon, color, value, label }: { icon: IconName; color: string; value: string | number; label: string }) {
  return (
    <View style={styles.tile} accessibilityLabel={`${label}: ${value}`}>
      <Icon name={icon} size={22} color={color} />
      <AppText variant="title">{value}</AppText>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: spacing.md },
  flex: { flex: 1 },
  levelCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBar: { marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '31.5%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  achievements: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  achievement: {
    width: '31.5%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 4,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  achievementLocked: { opacity: 0.7 },
  achievementIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  achievementDesc: { fontSize: 10, lineHeight: 13 },
  settings: { paddingVertical: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border },
});

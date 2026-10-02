import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { ToggleRow } from '@/components/ui/Toggle';
import { ACHIEVEMENTS } from '@/features/learning/achievements';
import { levelInfo, visibleStreak } from '@/features/learning/progression';
import { accuracy } from '@/features/learning/progressModel';
import { todayKey, useProgressStore } from '@/state/progressStore';
import { useSettingsStore } from '@/state/settingsStore';
import { colors, radii, spacing } from '@/theme';

export function ProfileScreen() {
  const progress = useProgressStore();
  const settings = useSettingsStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const level = levelInfo(progress.xp);
  const records = Object.values(progress.lessons);
  const completed = records.filter((record) => record.completed).length;
  const mastered = records.filter((record) => record.bestStars === 3).length;
  const unlockedCount = ACHIEVEMENTS.filter((achievement) => progress.achievements[achievement.id]).length;

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

      <AppText variant="label" color="textSecondary">
        Statistics
      </AppText>
      <View style={styles.grid}>
        <StatTile icon="fire" color={colors.streak} value={visibleStreak(progress.streak, todayKey())} label="Day streak" />
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
        Settings
      </AppText>
      <Card style={styles.settings}>
        <ToggleRow
          label="Haptics"
          description="Vibration feedback on moves and answers"
          value={settings.haptics}
          onChange={(haptics) => settings.update({ haptics })}
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
        message="This erases your lessons, XP, streak and achievements on this device. It can’t be undone."
        confirmLabel="Erase everything"
        cancelLabel="Keep my progress"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          progress.resetProgress();
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

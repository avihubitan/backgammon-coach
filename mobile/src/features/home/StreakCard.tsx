import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { StreakStatus } from '@/features/learning/progression';
import { colors, radii, spacing } from '@/theme';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Today's goal and the streak, with the freezes that protect it. */
export function StreakCard({
  status,
  xpToday,
  goal,
  enterDelay,
}: {
  status: StreakStatus;
  xpToday: number;
  goal: number;
  enterDelay?: number;
}) {
  const { days, activeToday, covering, freezes, nextFreezeIn } = status;
  const goalMet = xpToday >= goal;
  const subtitle =
    covering > 0
      ? `A streak freeze covered ${covering === 1 ? 'yesterday' : `the last ${covering} days`}. Learn today to keep your streak.`
      : goalMet
        ? 'Daily goal done. Nice work!'
        : days > 0 && !activeToday
          ? 'Learn today to keep your streak alive.'
          : `Earn ${goal - xpToday} more XP to hit today’s goal.`;
  const nextFreeze =
    nextFreezeIn === null
      ? null
      : nextFreezeIn === 1
        ? activeToday
          ? 'tomorrow'
          : 'today'
        : `in ${plural(nextFreezeIn, 'day')}`;
  const freezeNote =
    days === 0
      ? null
      : freezes > 0
        ? `${plural(freezes, 'streak freeze')} ready: ${freezes === 1 ? 'it covers' : 'each covers'} a day you miss.${
            nextFreeze ? ` Next one ${nextFreeze}.` : ''
          }`
        : nextFreeze === 'today'
          ? 'Learn today to earn a streak freeze: it covers a day you miss.'
          : nextFreeze
            ? `Next streak freeze ${nextFreeze}: it covers a day you miss.`
            : null;

  return (
    <Card style={styles.card} enterDelay={enterDelay} testID="streak-card">
      <View style={styles.top}>
        <View style={[styles.flame, { backgroundColor: days > 0 ? 'rgba(255,138,61,0.15)' : colors.surfaceRaised }]}>
          <Icon name="fire" size={30} color={days > 0 ? colors.streak : colors.textMuted} />
          {covering > 0 ? (
            <View style={styles.frozen} testID="streak-frozen">
              <Icon name="snowflake" size={14} color={colors.textInverse} />
            </View>
          ) : null}
        </View>
        <View style={styles.flex}>
          <AppText variant="subheading">{days > 0 ? `${days}-day streak` : 'Start a streak today'}</AppText>
          <AppText variant="small" color="textSecondary">
            {subtitle}
          </AppText>
        </View>
        {freezes > 0 ? (
          <View style={styles.freezes} testID="streak-freezes" accessibilityLabel={`${plural(freezes, 'streak freeze')} ready`}>
            <Icon name="snowflake" size={16} color={colors.info} />
            <AppText variant="smallStrong" color="info">
              {freezes}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.goalRow}>
        <View style={styles.flex}>
          <ProgressBar progress={xpToday / goal} color={goalMet ? colors.success : colors.streak} height={10} />
        </View>
        <AppText variant="caption" color="textSecondary" style={styles.goalText}>
          {Math.min(xpToday, goal)} / {goal} XP
        </AppText>
      </View>
      {freezeNote ? (
        <View style={styles.note}>
          <Icon name="snowflake" size={14} color={colors.textMuted} />
          <AppText variant="caption" color="textMuted" style={styles.flex}>
            {freezeNote}
          </AppText>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flame: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frozen: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.info,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  freezes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.infoSoft,
  },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  goalText: { minWidth: 70, textAlign: 'right' },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: -spacing.xs },
});

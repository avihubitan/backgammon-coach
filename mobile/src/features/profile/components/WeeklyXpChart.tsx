import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { colors, radii, spacing } from '@/theme';

import type { DayBar } from '../profileStats';

const CHART_HEIGHT = 96;

/** XP earned on each of the last seven days, with the daily goal as a guide line. */
export function WeeklyXpChart({ days, goal }: { days: DayBar[]; goal: number }) {
  const total = days.reduce((sum, day) => sum + day.xp, 0);
  const goalDays = days.filter((day) => day.xp >= goal).length;
  const top = Math.max(goal * 1.25, ...days.map((day) => day.xp));
  const goalY = (goal / top) * CHART_HEIGHT;

  return (
    <Card style={styles.card} testID="weekly-xp">
      <View style={styles.header}>
        <View>
          <AppText variant="label" color="textSecondary">
            This week
          </AppText>
          <AppText variant="title">{total} XP</AppText>
        </View>
        <AppText variant="caption" color={goalDays > 0 ? 'success' : 'textMuted'}>
          Goal met {goalDays}/7 days
        </AppText>
      </View>

      <View style={styles.chart} accessibilityLabel={`XP this week: ${days.map((day) => day.xp).join(', ')}`}>
        <View style={[styles.goalLine, { bottom: goalY, pointerEvents: 'none' }]} />
        {days.map((day, index) => {
          const height = day.xp > 0 ? Math.max(6, (day.xp / top) * CHART_HEIGHT) : 4;
          const met = day.xp >= goal;
          return (
            <View key={day.day} style={styles.column}>
              <AppText variant="caption" color={day.xp > 0 ? 'textSecondary' : 'textMuted'} style={styles.value}>
                {day.xp > 0 ? day.xp : ''}
              </AppText>
              <Animated.View
                style={[
                  styles.bar,
                  {
                    height,
                    backgroundColor: day.xp === 0 ? colors.surfaceRaised : met ? colors.success : colors.xp,
                    opacity: day.today || day.xp === 0 ? 1 : 0.8,
                    animationName: { from: { height: 0 }, to: { height } },
                    animationDuration: 520,
                    animationDelay: 120 + index * 55,
                    animationTimingFunction: 'ease-out',
                    animationFillMode: 'backwards',
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.labels}>
        {days.map((day) => (
          <AppText
            key={day.day}
            variant={day.today ? 'smallStrong' : 'caption'}
            color={day.today ? 'primary' : 'textMuted'}
            align="center"
            style={styles.label}
          >
            {day.today ? 'Today' : day.label}
          </AppText>
        ))}
      </View>
      <AppText variant="caption" color="textMuted">
        Dashed line: your daily goal of {goal} XP
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  chart: {
    height: CHART_HEIGHT + 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  value: { fontSize: 10, lineHeight: 14 },
  bar: { width: '100%', maxWidth: 30, borderRadius: radii.sm },
  labels: { flexDirection: 'row', gap: spacing.sm, marginTop: -spacing.xs },
  label: { flex: 1 },
});

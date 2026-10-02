import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { colors, radii, spacing } from '@/theme';

import type { SkillRow } from '../profileStats';

const percent = (value: number) => `${Math.round(value * 100)}%`;
const toneFor = (accuracy: number) => (accuracy >= 0.85 ? colors.success : accuracy >= 0.65 ? colors.xp : colors.danger);

/** First-try accuracy per skill, and the one skill most worth practising. */
export function SkillBreakdown({
  rows,
  focus,
  drillUnlocked,
}: {
  rows: SkillRow[];
  focus: SkillRow | null;
  /** Whether the focus skill's drill is open yet. */
  drillUnlocked: boolean;
}) {
  return (
    <Card style={styles.card} testID="skill-breakdown">
      {rows.map((row) => (
        <View key={row.id} style={styles.row} accessibilityLabel={`${row.label}: ${percent(row.accuracy)} first try`}>
          <View style={[styles.icon, { backgroundColor: colors.surfaceRaised }]}>
            <Icon name={row.icon} size={18} color={toneFor(row.accuracy)} />
          </View>
          <View style={styles.flex}>
            <View style={styles.rowTop}>
              <AppText variant="smallStrong">{row.label}</AppText>
              <AppText variant="caption" color="textSecondary">
                {percent(row.accuracy)} · {row.firstTry}/{row.attempted}
              </AppText>
            </View>
            <ProgressBar progress={row.accuracy} color={toneFor(row.accuracy)} height={6} shine={false} />
          </View>
        </View>
      ))}

      {focus ? (
        <View style={styles.focus} testID="skill-focus">
          <Icon name="bullseye-arrow" size={22} color="primary" />
          <View style={styles.flex}>
            <AppText variant="smallStrong">Focus next: {focus.label}</AppText>
            <AppText variant="caption" color="textSecondary">
              Your weakest skill so far. A few minutes of practice make the patterns stick.
            </AppText>
          </View>
          <Button
            testID="skill-focus-practice"
            label="Practise"
            size="medium"
            variant="secondary"
            fullWidth={false}
            onPress={() =>
              focus.drill && drillUnlocked
                ? router.push({ pathname: '/practice/[kind]', params: { kind: focus.drill } })
                : router.push('/practice')
            }
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 34, height: 34, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  focus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
  },
});

import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SKILLS } from '@/curriculum';
import { MASTERY_BADGE, masteryRank, type MasteryLevel, type SkillMastery } from '@/features/skills/mastery';
import { MasteryBadge, nextLevelColor } from '@/features/skills/MasteryBadge';
import { colors, radii, spacing } from '@/theme';

import type { SkillRow } from '../profileStats';

const percent = (value: number) => `${Math.round(value * 100)}%`;

/** "2 Strong · 3 Practising · 4 Learning": how the learner's skills stand, top level first. */
function summary(skills: readonly SkillMastery[]): string {
  const levels: Exclude<MasteryLevel, 'none'>[] = ['mastered', 'reliable', 'practised', 'introduced'];
  return levels
    .map((level) => ({ level, count: skills.filter((skill) => skill.level === level).length }))
    .filter(({ count }) => count > 0)
    .map(({ level, count }) => `${count} ${MASTERY_BADGE[level].label}`)
    .join(' · ');
}

/**
 * Every skill a lesson has taught: its level (Learning, Practising, Strong,
 * Mastered), how close the next one is and what it takes, and the one skill
 * most worth practising.
 */
export function SkillBreakdown({
  skills,
  accuracy,
  focus,
  drillUnlocked,
}: {
  skills: SkillMastery[];
  /** First-try accuracy per skill, where there are enough answers to show it. */
  accuracy: SkillRow[];
  focus: SkillRow | null;
  /** Whether the focus skill's drill is open yet. */
  drillUnlocked: boolean;
}) {
  return (
    <Card style={styles.card} testID="skill-breakdown">
      <AppText variant="caption" color="textSecondary" testID="skill-summary">
        {summary(skills)}
      </AppText>
      {skills.map((mastery) => {
        const skill = SKILLS[mastery.skill];
        const row = accuracy.find((candidate) => candidate.id === mastery.skill);
        const top = mastery.level === 'mastered';
        return (
          <View
            key={mastery.skill}
            style={styles.row}
            testID={`skill-${mastery.skill}`}
            accessibilityLabel={`${skill.title}: ${MASTERY_BADGE[mastery.level === 'none' ? 'introduced' : mastery.level].label}${
              row ? `, ${percent(row.accuracy)} right on the first try` : ''
            }${mastery.next ? `. Next: ${mastery.next}` : ''}`}
          >
            <View style={styles.icon}>
              <Icon name={skill.icon} size={18} color={masteryRank(mastery.level) >= masteryRank('reliable') ? colors.star : colors.textSecondary} />
            </View>
            <View style={styles.flex}>
              <View style={styles.rowTop}>
                <AppText variant="smallStrong" style={styles.title} numberOfLines={1}>
                  {skill.title}
                  {row ? (
                    <AppText variant="caption" color="textMuted">
                      {'  '}
                      {percent(row.accuracy)}
                    </AppText>
                  ) : null}
                </AppText>
                <MasteryBadge level={mastery.level} testID={`skill-${mastery.skill}-level`} />
              </View>
              <ProgressBar progress={top ? 1 : mastery.progress} color={nextLevelColor(mastery.level)} height={6} shine={false} />
              <AppText variant="caption" color={mastery.fading ? 'streak' : 'textSecondary'}>
                {mastery.fading
                  ? 'Not practised for a while: a quick round keeps it.'
                  : top
                    ? 'Mastered. Keep playing to keep it sharp.'
                    : `Next: ${mastery.next}`}
              </AppText>
            </View>
          </View>
        );
      })}

      {focus ? (
        <View style={styles.focus} testID="skill-focus">
          <Icon name="bullseye-arrow" size={22} color="primary" />
          <View style={styles.flex}>
            <AppText variant="smallStrong">Focus next: {focus.label}</AppText>
            <AppText variant="caption" color="textSecondary">
              Your lowest first-try score so far. A few minutes of practice make the patterns stick.
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
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  flex: { flex: 1, gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { flexShrink: 1 },
  focus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
  },
});

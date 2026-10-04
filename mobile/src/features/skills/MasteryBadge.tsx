import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { colors, radii } from '@/theme';

import { MASTERY_BADGE, type MasteryLevel } from './mastery';

const TONE: Record<Exclude<MasteryLevel, 'none'>, { text: string; background: string }> = {
  introduced: { text: colors.textSecondary, background: colors.surfaceRaised },
  practised: { text: colors.info, background: colors.infoSoft },
  reliable: { text: colors.star, background: colors.primarySoft },
  mastered: { text: colors.textInverse, background: colors.star },
};

/** "✓ Learning", "✓✓ Practising", "★ Strong", "★ Mastered": where a skill stands. */
export function MasteryBadge({ level, testID }: { level: MasteryLevel; testID?: string }) {
  if (level === 'none') return null;
  const tone = TONE[level];
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: tone.background }]}>
      <Icon name={MASTERY_BADGE[level].icon} size={13} color={tone.text} />
      <AppText variant="caption" color={tone.text}>
        {MASTERY_BADGE[level].label}
      </AppText>
    </View>
  );
}

/** The colour of the level a skill is working toward, for its progress bar. */
export function nextLevelColor(level: MasteryLevel): string {
  return level === 'none' || level === 'introduced' ? colors.info : colors.star;
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill },
});

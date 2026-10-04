import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedStar } from '@/components/fx/AnimatedStar';
import { LevelUpOverlay } from '@/components/fx/LevelUpOverlay';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useCountUp } from '@/components/ui/useCountUp';
import { starsForAccuracy } from '@/features/lessons/engine/session';
import type { PracticeKind } from '@/state/practiceStore';
import { freezeLines } from '@/features/learning/streakLines';
import { colors, MAX_CONTENT_WIDTH, radii, SCREEN_GUTTER, spacing } from '@/theme';

import type { PracticeResult } from './PracticeSessionScreen';

interface PracticeCompleteProps {
  title: string;
  kind: PracticeKind;
  result: PracticeResult;
  onAgain: () => void;
  onDone: () => void;
}

const riseIn = (delay: number) => ({
  animationName: {
    from: { transform: [{ translateY: 16 }], opacity: 0 },
    to: { transform: [{ translateY: 0 }], opacity: 1 },
  },
  animationDuration: 380,
  animationDelay: delay,
  animationFillMode: 'backwards' as const,
});

/** End of a practice run: stars for accuracy, XP, and what improved. */
export function PracticeComplete({ title, kind, result, onAgain, onDone }: PracticeCompleteProps) {
  const insets = useSafeAreaInsets();
  const { outcome, reward, xp, mastered, level } = result;
  const stars = outcome.scoredSteps > 0 ? starsForAccuracy(outcome.accuracy) : 0;
  const shownXp = useCountUp(xp, 700, 1100);
  const [levelUp, setLevelUp] = useState(reward.levelAfter > reward.levelBefore);

  const lines: { icon: IconName; color: string; text: string }[] = [
    {
      icon: 'bullseye-arrow',
      color: colors.success,
      text: `${outcome.firstTryCorrect} of ${outcome.scoredSteps} right on the first try`,
    },
  ];
  if (result.levelUp && level) {
    lines.push({ icon: 'arrow-up-bold-circle', color: colors.primary, text: `Level up! Next: ${level.level.title}` });
  } else if (level?.allCleared) {
    lines.push({ icon: 'star-circle', color: colors.xp, text: 'Every level cleared: now it’s all review' });
  } else if (level) {
    lines.push({ icon: 'stairs', color: colors.info, text: `Level ${level.number} of ${level.of}: ${level.level.title}` });
  }
  if (kind === 'mistakes' && mastered > 0) {
    lines.push({ icon: 'check-decagram', color: colors.success, text: `${mastered} mistake${mastered === 1 ? '' : 's'} mastered` });
  }
  if (reward.streakExtended && reward.streak > 0) {
    lines.push({ icon: 'fire', color: colors.streak, text: `${reward.streak}-day streak!` });
  }
  lines.push(...freezeLines(reward));
  if (reward.dailyGoalReached) lines.push({ icon: 'target', color: colors.success, text: 'Daily goal reached' });

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl }]} testID="practice-complete">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.hero, riseIn(0)]}>
          <AppText variant="label" color="success">
            Practice complete
          </AppText>
          <AppText variant="display" align="center">
            {title}
          </AppText>
        </Animated.View>

        <View style={styles.stars}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={index === 1 ? styles.middleStar : undefined}>
              <AnimatedStar earned={index < stars} size={index === 1 ? 76 : 58} delay={300 + index * 280} index={index + 1} />
            </View>
          ))}
        </View>

        <Animated.View style={[styles.xpCard, riseIn(1000)]}>
          <Icon name="lightning-bolt" size={22} color={colors.xp} />
          <AppText variant="number" color={colors.xp} testID="practice-xp">
            +{shownXp} XP
          </AppText>
        </Animated.View>

        {lines.map((line, index) => (
          <Animated.View key={line.text} style={[styles.line, riseIn(1200 + index * 120)]}>
            <Icon name={line.icon} size={22} color={line.color} />
            <AppText variant="bodyStrong">{line.text}</AppText>
          </Animated.View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Button testID="practice-again" label="Practice again" icon="refresh" onPress={onAgain} />
        <Button testID="practice-done" label="Done" variant="ghost" size="medium" onPress={onDone} />
      </View>

      {levelUp ? <LevelUpOverlay level={reward.levelAfter} onClose={() => setLevelUp(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: SCREEN_GUTTER,
    paddingBottom: 200,
    gap: spacing.lg,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  stars: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: spacing.md, marginVertical: spacing.md },
  middleStar: { marginBottom: spacing.md },
  xpCard: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.xp,
    backgroundColor: 'rgba(243, 184, 71, 0.1)',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.bg,
  },
});

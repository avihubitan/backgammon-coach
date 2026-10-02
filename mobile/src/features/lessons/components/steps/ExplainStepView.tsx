import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import type { ExplainStep } from '@/curriculum';
import { boardFromSetup } from '@/features/lessons/engine/evaluate';
import { colors, radii, SCREEN_GUTTER, spacing } from '@/theme';

import { StepBoard } from '../StepBoard';
import { StepHeader } from '../StepHeader';

export function ExplainStepView({ step, boardWidth }: { step: ExplainStep; boardWidth: number }) {
  return (
    <View style={styles.container}>
      <StepHeader eyebrow={step.title} text={step.text} />
      {step.board ? (
        <StepBoard
          setup={step.board}
          board={boardFromSetup(step.board)}
          width={boardWidth}
          layoutKey={step.id}
          dice={step.board.dice ? { values: step.board.dice, player: 'player1' } : null}
        />
      ) : null}
      {step.tip ? (
        <View style={styles.tip}>
          <Icon name="lightbulb-on-outline" size={18} color="primary" />
          <AppText variant="small" color="textSecondary" style={styles.tipText}>
            {step.tip}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  tip: {
    marginHorizontal: SCREEN_GUTTER,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipText: { flex: 1 },
});

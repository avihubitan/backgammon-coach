import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import type { ChoiceStep } from '@/curriculum';
import { boardFromSetup } from '@/features/lessons/engine/evaluate';
import { haptics } from '@/services/haptics';
import { colors, radii, SCREEN_GUTTER, spacing } from '@/theme';

import { StepBoard } from '../StepBoard';
import { StepHeader } from '../StepHeader';
import type { StepViewProps } from './types';

/** Multiple choice, optionally about a position on the board. */
export function ChoiceStepView({ step, boardWidth, status, onResult }: StepViewProps<ChoiceStep>) {
  const [chosen, setChosen] = useState<string | null>(null);
  const answered = status !== 'active';

  const choose = (id: string) => {
    if (answered) return;
    const option = step.options.find((candidate) => candidate.id === id);
    if (!option) return;
    setChosen(id);
    if (option.correct) haptics.success();
    else haptics.error();
    onResult(!!option.correct, option.explanation);
  };

  return (
    <View style={styles.container}>
      <StepHeader text={step.prompt} />
      {step.board ? (
        <StepBoard
          setup={step.board}
          board={boardFromSetup(step.board)}
          width={boardWidth}
          layoutKey={step.id}
          dice={step.board.dice ? { values: step.board.dice, player: 'player1' } : null}
        />
      ) : null}
      <View style={styles.options}>
        {step.options.map((option, index) => {
          const isChosen = chosen === option.id;
          const reveal = answered && (option.correct || isChosen);
          const tone = reveal ? (option.correct ? 'right' : 'wrong') : 'idle';
          return (
            <Pressable
              key={option.id}
              testID={`option-${option.id}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: answered, selected: isChosen }}
              disabled={answered}
              onPressIn={() => haptics.tap()}
              onPress={() => choose(option.id)}
              style={({ pressed }) => [
                styles.option,
                tone === 'right' && styles.optionRight,
                tone === 'wrong' && styles.optionWrong,
                answered && tone === 'idle' && styles.optionDim,
                pressed && !answered && styles.optionPressed,
              ]}
            >
              <View
                style={[
                  styles.letter,
                  tone === 'right' && { backgroundColor: colors.success },
                  tone === 'wrong' && { backgroundColor: colors.danger },
                ]}
              >
                {tone === 'idle' ? (
                  <AppText variant="caption" color="textSecondary">
                    {String.fromCharCode(65 + index)}
                  </AppText>
                ) : (
                  <Icon name={tone === 'right' ? 'check-bold' : 'close-thick'} size={14} color="textInverse" />
                )}
              </View>
              <AppText variant="bodyStrong" style={styles.optionText}>
                {option.text}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  options: { paddingHorizontal: SCREEN_GUTTER, gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    minHeight: 56,
  },
  optionPressed: { backgroundColor: colors.surfacePressed, transform: [{ scale: 0.99 }] },
  optionRight: { borderColor: colors.success, backgroundColor: colors.successSoft },
  optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  optionDim: { opacity: 0.5 },
  letter: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  optionText: { flex: 1 },
});

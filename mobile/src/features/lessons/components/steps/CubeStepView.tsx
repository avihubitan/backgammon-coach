import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import type { CubeAnswer, CubeStep } from '@/curriculum';
import { boardFromSetup } from '@/features/lessons/engine/evaluate';
import { SCREEN_GUTTER, spacing } from '@/theme';

import { StepBoard } from '../StepBoard';
import { StepHeader } from '../StepHeader';
import type { StepViewProps } from './types';

const LABELS: Record<CubeAnswer, string> = {
  double: 'Double',
  'no-double': 'No double',
  take: 'Take',
  drop: 'Drop',
};

/** Doubling cube decisions: double / no double, or take / drop. */
export function CubeStepView({ step, boardWidth, status, onResult }: StepViewProps<CubeStep>) {
  const [chosen, setChosen] = useState<CubeAnswer | null>(null);
  const choices: CubeAnswer[] = step.decision === 'offer' ? ['double', 'no-double'] : ['take', 'drop'];

  const choose = (answer: CubeAnswer) => {
    if (status !== 'active') return;
    setChosen(answer);
    const correct = answer === step.answer;
    onResult(correct, step.explanations[answer] ?? '');
  };

  return (
    <View style={styles.container}>
      <StepHeader text={step.prompt} />
      <StepBoard
        setup={step.board}
        board={boardFromSetup(step.board)}
        width={boardWidth}
        layoutKey={step.id}
        cube={step.board.cube ?? { value: 1, owner: null }}
        dice={step.board.dice ? { values: step.board.dice, player: 'player1' } : null}
      />
      <View style={styles.row}>
        {choices.map((answer) => {
          const answered = status !== 'active';
          const variant = !answered
            ? answer === 'double' || answer === 'take'
              ? 'primary'
              : 'secondary'
            : answer === step.answer
              ? 'success'
              : answer === chosen
                ? 'danger'
                : 'secondary';
          return (
            <View key={answer} style={styles.choice}>
              <Button
                testID={`cube-${answer}`}
                label={LABELS[answer]}
                variant={variant}
                disabled={answered && answer !== step.answer && answer !== chosen}
                onPress={() => choose(answer)}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: SCREEN_GUTTER },
  choice: { flex: 1 },
});

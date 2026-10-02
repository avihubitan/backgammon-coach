import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import type { MoveStep } from '@/curriculum';
import { usedDice } from '@/features/gameplay/moveInput';
import { STEP_DELAY, useMoveInput } from '@/features/gameplay/useMoveInput';
import {
  boardFromSetup,
  evaluateMoveStep,
  expandDice,
  solutionMoves,
  usesRealRoll,
} from '@/features/lessons/engine/evaluate';
import { startCustomTurn, startTurn, type DiceRoll } from '@/game';
import { haptics } from '@/services/haptics';
import { SCREEN_GUTTER, spacing } from '@/theme';
import type { BoardArrow } from '@/types/board';

import { StepBoard } from '../StepBoard';
import { StepHeader } from '../StepHeader';
import type { StepStatus, StepViewProps } from './types';

const SETTLE_MS = 380;

/** "Move this checker 5 spaces", "Make your 5-point"…: the learner plays on a real board. */
export function MoveStepView({
  step,
  boardWidth,
  status,
  mistakes,
  onResult,
}: Omit<StepViewProps<MoveStep>, 'status'> & { status: StepStatus | 'showing' }) {
  const start = boardFromSetup(step.board);
  const initial = usesRealRoll(step)
    ? startTurn(start, 'player1', step.board.dice as DiceRoll)
    : startCustomTurn(start, 'player1', expandDice(step.board.dice));
  const solution = solutionMoves(step, start);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const input = useMoveInput(initial, {
    enabled: status === 'active',
    onComplete: (turn) => {
      const verdict = evaluateMoveStep(step, start, turn.board, turn.moves);
      if (verdict.correct) haptics.success();
      else haptics.error();
      timer.current = setTimeout(() => onResult(verdict.correct, verdict.message), SETTLE_MS);
    },
  });

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const { autoplay } = input;
  useEffect(() => {
    if (status !== 'showing') return;
    autoplay(solution, initial);
    const duration = 450 + STEP_DELAY * 1.6 * Math.max(0, solution.length - 1) + 650;
    const done = setTimeout(() => onResult(true, step.correct), duration);
    return () => clearTimeout(done);
    // Only start the demonstration when entering the "showing" state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const showArrows =
    status === 'wrong' || (status === 'active' && mistakes > 0 && input.turn.moves.length === 0);
  const arrows: BoardArrow[] = showArrows ? solution.map((move) => ({ from: move.from, to: move.to, tone: 'hint' })) : [];
  const board = status === 'wrong' ? start : input.turn.board;

  return (
    <View style={styles.container}>
      <StepHeader text={step.prompt} />
      <StepBoard
        setup={step.board}
        board={board}
        width={boardWidth}
        layoutKey={step.id}
        dice={{
          values: step.board.dice,
          player: 'player1',
          used: status === 'wrong' ? undefined : expandedUsed(step.board.dice, usedDice(input.turn)),
        }}
        selected={input.selected}
        movable={status === 'active' && input.selected === null ? input.movable : []}
        targets={input.targets}
        arrows={arrows}
        disabled={status !== 'active'}
        onPressPoint={input.tap}
        onPressBar={() => input.tap('bar')}
        onPressOff={() => input.tap('off')}
      />
      <View style={styles.controls}>
        <AppText variant="small" color={input.message ? 'danger' : 'textSecondary'} style={styles.message}>
          {input.message ??
            (status === 'active' && mistakes > 0 && step.hint ? `Hint: ${step.hint}` : diceHelp(step.board.dice))}
        </AppText>
        {status === 'active' && input.turn.moves.length > 0 && !input.complete ? (
          <Button
            testID="undo"
            label="Undo"
            icon="undo-variant"
            variant="secondary"
            size="small"
            fullWidth={false}
            onPress={input.undo}
          />
        ) : null}
      </View>
    </View>
  );
}

/** The board shows two dice for doubles; map four used flags onto them. */
function expandedUsed(dice: number[], used: boolean[]): boolean[] {
  if (dice.length === 2 && dice[0] === dice[1]) {
    const usedCount = used.filter(Boolean).length;
    return [usedCount >= 4, usedCount >= 2];
  }
  return used;
}

function diceHelp(dice: number[]): string {
  if (dice.length === 1) return `Move one checker exactly ${dice[0]}.`;
  if (dice.length === 2 && dice[0] === dice[1]) return `Doubles! You get four moves of ${dice[0]}.`;
  return `Play both numbers: ${dice.join(' and ')}.`;
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  controls: {
    paddingHorizontal: SCREEN_GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 40,
  },
  message: { flex: 1 },
});

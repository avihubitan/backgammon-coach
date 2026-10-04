import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import type { ChallengeStep } from '@/curriculum';
import { usedDice } from '@/features/gameplay/moveInput';
import { useMoveInput } from '@/features/gameplay/useMoveInput';
import { boardFromSetup, challengeGoalReached, longestWall } from '@/features/lessons/engine/evaluate';
import { checkersAt, checkersOnBoard, startTurn, type BoardState, type TurnState } from '@/game';
import { SCREEN_GUTTER, spacing } from '@/theme';

import { StepBoard } from '../StepBoard';
import { StepHeader } from '../StepHeader';
import type { StepViewProps } from './types';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** How far the learner is from the goal, in a few words. */
function standing(step: ChallengeStep, board: BoardState): string {
  const goal = step.goal;
  switch (goal.type) {
    case 'bear-off-all':
      return `${plural(checkersOnBoard(board, 'player1') + board.bar.player1, 'checker')} left`;
    case 'all-home': {
      let outside = board.bar.player1;
      for (let point = 7; point <= 24; point++) outside += checkersAt(board, point, 'player1');
      return `${plural(outside, 'checker')} still outside`;
    }
    case 'escape': {
      let theirLast = 25;
      for (let point = 24; point >= 1; point--) if (checkersAt(board, point, 'player2') > 0) theirLast = point;
      let behind = board.bar.player1;
      for (let point = theirLast + 1; point <= 24; point++) behind += checkersAt(board, point, 'player1');
      return `${plural(behind, 'checker')} still to escape`;
    }
    case 'prime':
      return `Longest wall: ${longestWall(board)} of ${goal.length}`;
    case 'hit':
      return `${board.bar.player2} of ${goal.count} hit`;
  }
}

/** A short solo game over several fixed rolls, e.g. "bear off everything in three rolls". */
export function ChallengeStepView({ step, boardWidth, status, onResult }: StepViewProps<ChallengeStep>) {
  const [round, setRound] = useState<{ index: number; board: BoardState }>(() => ({
    index: 0,
    board: boardFromSetup(step.board),
  }));

  const finishTurn = (turn: TurnState) => {
    if (challengeGoalReached(step.goal, turn.board)) {
      setTimeout(() => onResult(true, step.success), 450);
      return;
    }
    if (round.index + 1 >= step.rolls.length) {
      setTimeout(() => onResult(false, step.failure), 450);
      return;
    }
    setTimeout(() => setRound({ index: round.index + 1, board: turn.board }), 500);
  };

  return (
    <View style={styles.container}>
      <StepHeader text={step.prompt} />
      <ChallengeRound
        key={round.index}
        step={step}
        index={round.index}
        board={round.board}
        boardWidth={boardWidth}
        enabled={status === 'active'}
        onTurnDone={finishTurn}
      />
    </View>
  );
}

function ChallengeRound({
  step,
  index,
  board,
  boardWidth,
  enabled,
  onTurnDone,
}: {
  step: ChallengeStep;
  index: number;
  board: BoardState;
  boardWidth: number;
  enabled: boolean;
  onTurnDone: (turn: TurnState) => void;
}) {
  const roll = step.rolls[index];
  const input = useMoveInput(startTurn(board, 'player1', roll), { enabled, onComplete: onTurnDone });
  const blocked = input.turn.requiredMoves === 0;

  return (
    <>
      <StepBoard
        setup={step.board}
        board={input.turn.board}
        width={boardWidth}
        layoutKey={`${step.id}-${index}`}
        dice={{
          values: roll,
          player: 'player1',
          used: roll[0] === roll[1] ? undefined : usedDice(input.turn),
          rollId: index,
          animate: true,
        }}
        selected={input.selected}
        movable={enabled && input.selected === null ? input.movable : []}
        targets={input.targets}
        disabled={!enabled}
        onPressPoint={input.tap}
        onPressBar={() => input.tap('bar')}
        onPressOff={(how) => input.tap('off', how)}
      />
      <View style={styles.row}>
        <AppText variant="smallStrong" color="textSecondary" style={styles.flex}>
          Roll {index + 1} of {step.rolls.length} · {standing(step, input.turn.board)}
        </AppText>
        {blocked && enabled ? (
          <Button label="No moves · next roll" size="small" fullWidth={false} onPress={() => onTurnDone(input.turn)} />
        ) : input.turn.moves.length > 0 && !input.complete && enabled ? (
          <Button label="Undo" icon="undo-variant" variant="secondary" size="small" fullWidth={false} onPress={input.undo} />
        ) : null}
      </View>
      {input.message ? (
        <AppText variant="small" color="danger" style={styles.message}>
          {input.message}
        </AppText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_GUTTER,
    gap: spacing.md,
    minHeight: 40,
  },
  flex: { flex: 1 },
  message: { paddingHorizontal: SCREEN_GUTTER },
});

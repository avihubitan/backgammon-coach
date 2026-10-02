import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { TapStep, TapTarget } from '@/curriculum';
import { boardFromSetup, isCorrectTap, tapFeedback } from '@/features/lessons/engine/evaluate';
import { createBoard } from '@/game';
import { SCREEN_GUTTER, spacing } from '@/theme';
import type { BoardHighlight } from '@/types/board';

import { StepBoard, regionForTarget, targetHighlights } from '../StepBoard';
import { StepHeader } from '../StepHeader';
import type { StepViewProps } from './types';

/** "Tap the 6-point": position recognition on the board. */
export function TapStepView({ step, boardWidth, status, mistakes, onResult }: StepViewProps<TapStep>) {
  const [tapped, setTapped] = useState<TapTarget | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const board = boardFromSetup(step.board);
  const solved = status === 'correct';
  const shownBoard = solved && step.reveal ? createBoard(step.reveal) : board;

  const handle = (target: TapTarget) => {
    if (status !== 'active') return;
    setTapped(target);
    if (isCorrectTap(step, target)) {
      onResult(true, step.correct);
    } else {
      setShakeKey((value) => value + 1);
      onResult(false, tapFeedback(step, target, board));
    }
  };

  const highlights: BoardHighlight[] = [];
  if (status === 'wrong' && tapped) highlights.push({ region: regionForTarget(tapped), tone: 'danger' });
  if (status === 'wrong' || (status === 'active' && mistakes > 0)) {
    highlights.push(...targetHighlights(step.answers, 'success'));
  }
  if (solved && tapped) highlights.push({ region: regionForTarget(tapped), tone: 'success' });

  return (
    <View style={styles.container}>
      <StepHeader text={step.prompt} />
      <StepBoard
        setup={step.board}
        board={shownBoard}
        width={boardWidth}
        layoutKey={step.id}
        highlights={highlights}
        dice={step.board.dice ? { values: step.board.dice, player: 'player1' } : null}
        disabled={status !== 'active'}
        shakeKey={shakeKey || null}
        celebrate={solved && tapped?.kind === 'point' ? { key: step.id, spots: [tapped.point] } : null}
        onPressPoint={(point) => handle({ kind: 'point', point })}
        onPressBar={() => handle({ kind: 'bar' })}
        onPressOff={() => handle({ kind: 'off' })}
      />
      {step.hint && mistakes > 0 && status === 'active' ? (
        <AppText variant="small" color="textSecondary" style={styles.hint}>
          Hint: {step.hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  hint: { paddingHorizontal: SCREEN_GUTTER },
});

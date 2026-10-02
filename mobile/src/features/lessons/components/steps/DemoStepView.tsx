import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import type { DemoStep } from '@/curriculum';
import { boardFromSetup } from '@/features/lessons/engine/evaluate';
import { applyMove, type BoardState } from '@/game';
import { colors, radii, SCREEN_GUTTER, spacing } from '@/theme';

import { StepBoard } from '../StepBoard';
import { StepHeader } from '../StepHeader';

const STEP_MS = 900;

function boardAfter(step: DemoStep, count: number): BoardState {
  let board = boardFromSetup(step.board);
  for (const move of step.moves.slice(0, count)) {
    board = applyMove(board, move.player ?? 'player1', { from: move.from, to: move.to, die: 1, hit: false });
  }
  return board;
}

/** Plays a short scripted sequence of moves so the learner can watch before trying. */
export function DemoStepView({ step, boardWidth }: { step: DemoStep; boardWidth: number }) {
  const [run, setRun] = useState(0);
  return (
    <View style={styles.container}>
      <StepHeader eyebrow={step.title} text={step.text} />
      <DemoRun key={run} step={step} boardWidth={boardWidth} run={run} onReplay={() => setRun((value) => value + 1)} />
    </View>
  );
}

function DemoRun({
  step,
  boardWidth,
  run,
  onReplay,
}: {
  step: DemoStep;
  boardWidth: number;
  run: number;
  onReplay: () => void;
}) {
  const [played, setPlayed] = useState(0);

  useEffect(() => {
    const timers = step.moves.map((_, index) => setTimeout(() => setPlayed(index + 1), 700 + STEP_MS * index));
    return () => timers.forEach(clearTimeout);
  }, [step]);

  const caption = [...step.moves.slice(0, played)].reverse().find((move) => move.caption)?.caption;
  const finished = played >= step.moves.length;

  return (
    <>
      <StepBoard
        setup={step.board}
        board={boardAfter(step, played)}
        width={boardWidth}
        layoutKey={`${step.id}-${run}`}
        dice={step.board.dice ? { values: step.board.dice, player: 'player1' } : null}
      />
      <View style={styles.captionRow}>
        {caption ? (
          <View style={styles.caption}>
            <AppText variant="smallStrong" color="text">
              {caption}
            </AppText>
          </View>
        ) : (
          <View />
        )}
        {finished ? (
          <Button
            label="Replay"
            icon="replay"
            variant="secondary"
            size="small"
            fullWidth={false}
            onPress={onReplay}
          />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  captionRow: {
    paddingHorizontal: SCREEN_GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    gap: spacing.sm,
  },
  caption: {
    flexShrink: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
});

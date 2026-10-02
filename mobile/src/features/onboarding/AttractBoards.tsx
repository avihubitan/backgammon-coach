import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { BackgammonBoard } from '@/components/board/BackgammonBoard';
import { MOVE_STEP_MS } from '@/components/board/motion';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { START } from '@/curriculum/builders';
import { applyMove, createBoard, type BoardState } from '@/game';
import { colors, radii, spacing } from '@/theme';
import type { BoardDice } from '@/types/board';

import { ATTRACT_SCRIPT, attractStart, playAttractTurn } from './attractScript';

interface AttractState {
  board: BoardState;
  dice: BoardDice | null;
  cycle: number;
}

/** The welcome screen's board plays a short opening by itself, on a loop (silently). */
export function AttractBoard({ width }: { width: number }) {
  const [state, setState] = useState<AttractState>(() => ({ board: attractStart(), dice: null, cycle: 0 }));
  const { cycle } = state;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, update: (previous: AttractState) => AttractState) =>
      timers.push(setTimeout(() => setState(update), ms));
    let time = 900;
    let board = attractStart();
    ATTRACT_SCRIPT.forEach((turn, turnIndex) => {
      const rollId = `${cycle}-${turnIndex}`;
      at(time, (previous) => ({ ...previous, dice: { values: turn.dice, player: turn.player, rollId, animate: true } }));
      time += 1000;
      playAttractTurn(board, turn).forEach((next, moveIndex) => {
        const used = turn.dice.map((_, index) => index <= moveIndex);
        at(time, (previous) => ({
          ...previous,
          board: next,
          dice: { values: turn.dice, player: turn.player, rollId, animate: true, used },
        }));
        time += MOVE_STEP_MS + 120;
        board = next;
      });
      time += 900;
    });
    at(time + 1200, () => ({ board: attractStart(), dice: null, cycle: cycle + 1 }));
    return () => timers.forEach(clearTimeout);
  }, [cycle]);

  return (
    <BackgammonBoard
      board={state.board}
      width={width}
      layoutKey={`attract-${cycle}`}
      dice={state.dice}
      showPointNumbers={false}
      sounds={false}
    />
  );
}

/** "Interactive lessons": the board shows the best 3-1, plays it, and celebrates. */
export function DemoMoveBoard({ width }: { width: number }) {
  const start = createBoard(START);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1300),
      setTimeout(() => setPhase(2), 1300 + MOVE_STEP_MS),
      setTimeout(() => setPhase(3), 1300 + MOVE_STEP_MS * 2),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const afterFirst = applyMove(start, 'player1', { from: 8, to: 5, die: 3, hit: false });
  const afterSecond = applyMove(afterFirst, 'player1', { from: 6, to: 5, die: 1, hit: false });
  const board = phase === 0 ? start : phase === 1 ? afterFirst : afterSecond;

  return (
    <View>
      <BackgammonBoard
        board={board}
        width={width}
        showPointNumbers={false}
        sounds={false}
        arrows={
          phase === 0
            ? [
                { from: 8, to: 5, tone: 'hint' },
                { from: 6, to: 5, tone: 'hint' },
              ]
            : []
        }
        dice={{ values: [3, 1], player: 'player1', rollId: 'demo', animate: true, used: [phase >= 1, phase >= 2] }}
        celebrate={phase >= 3 ? { key: 'demo', spots: [5] } : null}
      />
      {phase >= 3 ? (
        <Animated.View
          style={[
            styles.badge,
            {
              animationName: {
                '0%': { opacity: 0, transform: [{ translateY: 12 }, { scale: 0.7 }] },
                '70%': { opacity: 1, transform: [{ translateY: 0 }, { scale: 1.06 }] },
                '100%': { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
              },
              animationDuration: 380,
            },
          ]}
        >
          <Icon name="check-bold" size={16} color="textInverse" />
          <AppText variant="smallStrong" color="textInverse">
            Great move! You made your 5-point.
          </AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: -18,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.success,
    boxShadow: '0px 6px 16px rgba(0,0,0,0.45)',
  },
});

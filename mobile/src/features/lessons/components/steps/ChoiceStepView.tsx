import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { ChoiceStep } from '@/curriculum';
import { boardFromSetup, expandDice } from '@/features/lessons/engine/evaluate';
import { chainMoves } from '@/features/lessons/engine/moves';
import { findPlayForDice } from '@/game';
import { haptics } from '@/services/haptics';
import { colors, radii, SCREEN_GUTTER, spacing } from '@/theme';
import type { BoardArrow } from '@/types/board';

import { StepBoard } from '../StepBoard';
import { StepHeader } from '../StepHeader';
import type { StepViewProps } from './types';

/**
 * Multiple choice, optionally about a position on the board. When the options
 * are moves, tapping one shows it as arrows and the learner confirms it, the
 * way they'd pick a move in a game.
 */
export function ChoiceStepView({ step, boardWidth, status, onResult }: StepViewProps<ChoiceStep>) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [previewed, setPreviewed] = useState<string | null>(null);
  const answered = status !== 'active';
  const moveChoice = step.options.some((option) => !!option.play);

  const submit = (id: string) => {
    if (answered) return;
    const option = step.options.find((candidate) => candidate.id === id);
    if (!option) return;
    setChosen(id);
    onResult(!!option.correct, option.explanation);
  };
  const choose = (id: string) => {
    if (answered) return;
    if (moveChoice) setPreviewed(id);
    else submit(id);
  };

  const arrows: BoardArrow[] = [];
  if (moveChoice && step.board) {
    const start = boardFromSetup(step.board);
    const dice = step.board.dice ?? [];
    const trips = (id: string | null | undefined, tone: BoardArrow['tone']): BoardArrow[] => {
      const notation = step.options.find((option) => option.id === id)?.play;
      if (!notation) return [];
      const play = findPlayForDice(start, 'player1', expandDice(dice), notation, { largerDieRule: dice.length === 2 && dice[0] !== dice[1] });
      return play ? chainMoves(play.moves).map((trip) => ({ ...trip, tone })) : [];
    };
    if (answered) {
      // The right move in green, and yours in red when it wasn't.
      const right = step.options.find((option) => option.correct)?.id;
      arrows.push(...trips(right, 'hint'));
      if (chosen !== right) arrows.push(...trips(chosen, 'wrong'));
    } else {
      arrows.push(...trips(previewed, 'info'));
    }
  }

  return (
    <View style={styles.container}>
      <StepHeader text={step.prompt} />
      {step.targetSeconds ? <SpeedTimer seconds={step.targetSeconds} running={!answered} /> : null}
      {step.board ? (
        <StepBoard
          setup={step.board}
          board={boardFromSetup(step.board)}
          width={boardWidth}
          layoutKey={step.id}
          arrows={arrows}
          dice={step.board.dice ? { values: step.board.dice, player: 'player1' } : null}
        />
      ) : null}
      <View style={styles.options}>
        {step.options.map((option, index) => {
          const isChosen = chosen === option.id;
          const reveal = answered && (option.correct || isChosen);
          const tone = reveal ? (option.correct ? 'right' : 'wrong') : 'idle';
          const isPreviewed = !answered && previewed === option.id;
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
                isPreviewed && styles.optionPreviewed,
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
        {moveChoice && !answered ? (
          <Button
            testID="choice-confirm"
            label={previewed ? 'Play this move' : 'Tap a move to see it'}
            icon="check"
            disabled={!previewed}
            onPress={() => previewed && submit(previewed)}
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * A speed goal: a bar that runs down over `seconds` while the learner thinks.
 * Nothing happens when it runs out; it only shows the pace to aim for.
 */
function SpeedTimer({ seconds, running }: { seconds: number; running: boolean }) {
  const reduceMotion = useReducedMotion();
  const left = useSharedValue(1);
  useEffect(() => {
    if (!running) {
      cancelAnimation(left);
      return;
    }
    if (!reduceMotion) left.value = withTiming(0, { duration: seconds * 1000, easing: Easing.linear });
  }, [running, reduceMotion, seconds, left]);
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: left.value }] }));
  return (
    <View style={styles.timer} accessibilityLabel={`Try to answer within ${seconds} seconds`}>
      <Icon name="timer-outline" size={16} color={colors.textSecondary} />
      <View style={styles.timerTrack}>
        <Animated.View style={[styles.timerBar, bar]} />
      </View>
      <AppText variant="caption" color="textSecondary">
        {seconds} s
      </AppText>
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
  optionPreviewed: { borderColor: colors.info, backgroundColor: colors.infoSoft },
  timer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: SCREEN_GUTTER },
  timerTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  timerBar: { flex: 1, backgroundColor: colors.info, transformOrigin: 'left' },
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

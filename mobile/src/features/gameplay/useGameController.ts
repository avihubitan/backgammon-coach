import { useEffect, useRef, useState } from 'react';

import {
  aiShouldDouble,
  aiShouldTake,
  canDouble,
  canEndTurn,
  chooseAiPlay,
  currentLegalMoves,
  formatPlay,
  gameReducer,
  isTurnComplete,
  rollDice,
  rollDie,
  type CheckerMove,
  type GameAction,
  type GameState,
  type MoveSource,
} from '@/game';
import { MOVE_STEP_MS } from '@/components/board/motion';
import { reportChallengeEvent } from '@/features/challenges/challengeService';
import { analytics } from '@/services/analytics';
import { feedback } from '@/services/feedback';
import { haptics } from '@/services/haptics';
import { useGameStore } from '@/state/gameStore';
import { useProgressStore } from '@/state/progressStore';

import { gameXp } from './gameModel';
import { destinationsFrom, movableSources, resolveTap, type TapPlace } from './moveInput';

const AI_DELAY = { roll: 700, think: 850, move: 520, end: 450, cube: 1100 } as const;
const HUMAN_STEP = MOVE_STEP_MS;

export interface GameOutcome {
  /** Id of the recorded game (for the coach review). */
  gameId: string | null;
  xp: number;
  matchOver: boolean;
  newAchievements: string[];
  levelUp: number | null;
}

function latestState(): GameState | null {
  return useGameStore.getState().active?.state ?? null;
}

/**
 * Drives a game against the computer: human input, AI turns, cube decisions
 * and recording the result. Game rules all live in the pure engine reducer.
 */
export function useGameController() {
  const active = useGameStore((store) => store.active);
  const updateState = useGameStore((store) => store.updateState);
  const [selected, setSelected] = useState<MoveSource | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rollId, setRollId] = useState(0);
  const [lastAiPlay, setLastAiPlay] = useState<{ moves: CheckerMove[]; text: string } | null>(null);
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const aiPlan = useRef<CheckerMove[] | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const recordedFor = useRef<string | null>(null);

  const state = active?.state ?? null;
  const level = active?.settings.level ?? 'beginner';

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /** Records a finished game exactly once and celebrates it. */
  const onFinished = (finishedState: GameState) => {
    const game = useGameStore.getState().active;
    if (!game || !finishedState.result) return;
    const key = `${game.id}-${game.gameNumber}`;
    if (recordedFor.current === key) return;
    recordedFor.current = key;
    const recorded = useGameStore.getState().finishGame();
    const xp = gameXp(game.settings.level, finishedState.result);
    const won = finishedState.result.winner === 'player1';
    analytics.track('game_completed', {
      mode: 'ai',
      level: game.settings.level,
      won,
      result: finishedState.result.type,
      points: finishedState.result.points,
      turns: finishedState.history.length,
    });
    analytics.track('ai_game_completed', {
      level: game.settings.level,
      won,
      result: finishedState.result.type,
      points: finishedState.result.points,
    });
    const reward = useProgressStore.getState().awardXp(xp, useGameStore.getState().stats);
    if (finishedState.result.winner === 'player1') {
      feedback.lessonComplete();
      reportChallengeEvent({ type: 'game-won' });
    }
    setOutcome({
      gameId: recorded?.finished.id ?? null,
      xp,
      matchOver: recorded?.matchOver ?? true,
      newAchievements: reward.newAchievements,
      levelUp: reward.levelAfter > reward.levelBefore ? reward.levelAfter : null,
    });
  };

  const dispatch = (action: GameAction, extra?: Parameters<typeof updateState>[1]): GameState | null => {
    const current = latestState();
    if (!current) return null;
    const next = gameReducer(current, action);
    updateState(next, extra);
    if (next.phase === 'finished' && current.phase !== 'finished') onFinished(next);
    return next;
  };

  const autoSelect = (next: GameState | null) => {
    if (!next || next.phase !== 'moving' || next.currentPlayer !== 'player1' || !next.turn) {
      setSelected(null);
      return;
    }
    const sources = movableSources(next.turn);
    setSelected(sources.length === 1 ? sources[0] : null);
  };

  // ---------------------------------------------------------------------------
  // Computer turns: one action per tick so every step is visible.
  useEffect(() => {
    if (!state || state.phase === 'finished') return;
    const aiResponds = state.phase === 'doubling' && state.doubleOfferedBy === 'player1';
    const aiActs = (state.phase === 'rolling' || state.phase === 'moving') && state.currentPlayer === 'player2';
    if (!aiResponds && !aiActs) return;

    const delay =
      state.phase === 'doubling'
        ? AI_DELAY.cube
        : state.phase === 'rolling'
          ? AI_DELAY.roll
          : state.turn && state.turn.moves.length === 0 && !aiPlan.current
            ? AI_DELAY.think
            : state.turn && isTurnComplete(state.turn)
              ? AI_DELAY.end
              : AI_DELAY.move;

    const timer = setTimeout(() => {
      const current = latestState();
      if (!current) return;
      if (current.phase === 'doubling') {
        const take = aiShouldTake(current.board, 'player1', level);
        setMessage(take ? 'The computer takes your double.' : 'The computer drops. You win the game!');
        dispatch({ type: take ? 'take' : 'drop' });
        return;
      }
      if (current.phase === 'rolling') {
        if (canDouble(current) && aiShouldDouble(current.board, 'player2', current.cube, level)) {
          setMessage(null);
          dispatch({ type: 'double' });
          haptics.warning();
          return;
        }
        aiPlan.current = null;
        setLastAiPlay(null);
        dispatch({ type: 'roll', dice: rollDice() });
        setRollId((id) => id + 1);
        return;
      }
      if (current.phase === 'moving' && current.turn) {
        if (isTurnComplete(current.turn)) {
          const moves = current.turn.moves;
          setLastAiPlay(
            moves.length > 0
              ? { moves, text: `Computer played ${formatPlay('player2', moves)}` }
              : { moves, text: 'The computer couldn’t move.' },
          );
          aiPlan.current = null;
          dispatch({ type: 'end-turn' });
          return;
        }
        if (!aiPlan.current) {
          aiPlan.current = chooseAiPlay(current.board, 'player2', current.turn.roll!, level, Math.random).moves.slice();
        }
        const move = aiPlan.current.shift();
        if (move) dispatch({ type: 'move', move });
      }
    }, delay);
    return () => clearTimeout(timer);
    // `state` changes after every action, which schedules the next AI step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, level]);

  // Human dance: nothing to move, so the turn passes after a moment.
  const dancing =
    !!state && state.phase === 'moving' && state.currentPlayer === 'player1' && state.turn?.requiredMoves === 0;
  useEffect(() => {
    if (!dancing) return;
    const timer = setTimeout(() => dispatch({ type: 'end-turn' }), 1800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dancing, state]);

  // ---------------------------------------------------------------------------
  // Human actions

  const rollOpening = () => {
    const current = latestState();
    if (!current || current.phase !== 'opening') return;
    const dice: [ReturnType<typeof rollDie>, ReturnType<typeof rollDie>] = [rollDie(), rollDie()];
    const next = dispatch({ type: 'opening-roll', dice }, { openingRoll: { player1: dice[0], player2: dice[1] } });
    setRollId((id) => id + 1);
    if (dice[0] === dice[1]) setMessage(`You both rolled ${dice[0]}. Roll again!`);
    else if (dice[0] > dice[1]) setMessage(`You rolled ${dice[0]}, the computer rolled ${dice[1]}. You start!`);
    else setMessage(`The computer rolled ${dice[1]}, you rolled ${dice[0]}. The computer starts.`);
    autoSelect(next);
  };

  const roll = () => {
    const current = latestState();
    if (!current || current.phase !== 'rolling' || current.currentPlayer !== 'player1') return;
    setMessage(null);
    setLastAiPlay(null);
    const next = dispatch({ type: 'roll', dice: rollDice() });
    setRollId((id) => id + 1);
    autoSelect(next);
  };

  const double = () => {
    const current = latestState();
    if (!current || !canDouble(current) || current.currentPlayer !== 'player1') return;
    haptics.medium();
    setMessage('You offered a double…');
    dispatch({ type: 'double' });
  };

  const respondToDouble = (take: boolean) => {
    const current = latestState();
    if (!current || current.phase !== 'doubling' || current.doubleOfferedBy !== 'player2') return;
    setMessage(take ? 'You took. The stakes are doubled and you own the cube.' : null);
    dispatch({ type: take ? 'take' : 'drop' });
  };

  const runHumanMoves = (moves: CheckerMove[]) => {
    moves.forEach((move, index) => {
      const step = () => {
        const next = dispatch({ type: 'move', move });
        if (index === moves.length - 1) {
          setBusy(false);
          autoSelect(next);
        } else {
          setSelected(null);
        }
      };
      if (index === 0) step();
      else timers.current.push(setTimeout(step, HUMAN_STEP * index));
    });
    if (moves.length > 1) setBusy(true);
  };

  const tap = (place: TapPlace) => {
    const current = latestState();
    if (busy || !current || current.phase !== 'moving' || current.currentPlayer !== 'player1' || !current.turn) return;
    const result = resolveTap(current.turn, selected, place);
    switch (result.kind) {
      case 'select':
        feedback.checkerSelect();
        setMessage(null);
        setSelected(result.source);
        break;
      case 'deselect':
        setSelected(null);
        break;
      case 'move':
        setMessage(null);
        runHumanMoves(result.moves);
        break;
      case 'invalid':
        haptics.warning();
        setSelected(null);
        setMessage(result.reason);
        break;
      case 'ignore':
        break;
    }
  };

  const undo = () => {
    const current = latestState();
    if (busy || !current || current.phase !== 'moving' || !current.turn || current.turn.moves.length === 0) return;
    const next = dispatch({ type: 'undo' });
    setMessage(null);
    autoSelect(next);
  };

  const endTurn = () => {
    const current = latestState();
    if (!current || !canEndTurn(current) || current.currentPlayer !== 'player1') return;
    haptics.tap();
    // Hits count once the move is confirmed (undo can't farm them).
    for (const move of current.turn?.moves ?? []) if (move.hit) reportChallengeEvent({ type: 'hit' });
    setSelected(null);
    dispatch({ type: 'end-turn' });
  };

  const resign = () => {
    const current = latestState();
    if (!current || current.phase === 'finished') return;
    dispatch({ type: 'resign', player: 'player1' });
  };

  const humanMoving = !!state && state.phase === 'moving' && state.currentPlayer === 'player1' && !!state.turn;
  const legal = humanMoving && state ? currentLegalMoves(state) : [];
  const movable = humanMoving && state?.turn && !busy ? movableSources(state.turn) : [];
  const targets =
    humanMoving && state?.turn && selected !== null && !busy ? Array.from(destinationsFrom(state.turn, selected).keys()) : [];

  return {
    active,
    state,
    level,
    selected,
    movable,
    targets,
    legal,
    message: dancing ? 'No legal moves. Your turn passes.' : message,
    dancing,
    busy,
    rollId,
    lastAiPlay,
    outcome,
    clearOutcome: () => setOutcome(null),
    rollOpening,
    roll,
    double,
    respondToDouble,
    tap,
    undo,
    endTurn,
    resign,
  };
}

export type GameController = ReturnType<typeof useGameController>;

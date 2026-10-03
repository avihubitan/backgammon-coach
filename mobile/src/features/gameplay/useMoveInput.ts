import { useEffect, useRef, useState } from 'react';

import { MOVE_STEP_MS } from '@/components/board/motion';
import { isTurnComplete, playMove, undoLastMove, type CheckerMove, type MoveSource, type TurnState } from '@/game';
import { feedback } from '@/services/feedback';
import { haptics } from '@/services/haptics';

import { destinationsFrom, movableSources, resolveTap, type TapPlace } from './moveInput';

/** Time between the steps of a multi-step move, matching the board's checker animation. */
export const STEP_DELAY = MOVE_STEP_MS;

interface Options {
  enabled?: boolean;
  onComplete?: (turn: TurnState) => void;
  onMove?: (move: CheckerMove, turn: TurnState) => void;
}

function autoSelection(turn: TurnState): MoveSource | null {
  if (isTurnComplete(turn)) return null;
  const sources = movableSources(turn);
  return sources.length === 1 ? sources[0] : null;
}

/** React state around tap-to-move: selection, legal targets, multi-step moves and undo. */
export function useMoveInput(initial: TurnState, { enabled = true, onComplete, onMove }: Options = {}) {
  const [turn, setTurn] = useState(initial);
  const [selected, setSelected] = useState<MoveSource | null>(() => autoSelection(initial));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const commit = (next: TurnState) => {
    setTurn(next);
    setSelected(autoSelection(next));
    if (isTurnComplete(next)) onComplete?.(next);
  };

  const runMoves = (start: TurnState, moves: CheckerMove[], instant = false) => {
    let current = start;
    if (instant) {
      // A dragged checker goes straight to where it was dropped.
      for (const move of moves) {
        current = playMove(current, move);
        onMove?.(move, current);
      }
      commit(current);
      return;
    }
    moves.forEach((move, index) => {
      const step = () => {
        current = playMove(current, move);
        onMove?.(move, current);
        if (index === moves.length - 1) {
          setBusy(false);
          commit(current);
        } else {
          setTurn(current);
          setSelected(null);
        }
      };
      if (index === 0) step();
      else timers.current.push(setTimeout(step, STEP_DELAY * index));
    });
    if (moves.length > 1) setBusy(true);
  };

  const tap = (place: TapPlace, how?: { dragged?: boolean }) => {
    if (!enabled || busy) return;
    const result = resolveTap(turn, selected, place);
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
        runMoves(turn, result.moves, !!how?.dragged);
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
    if (busy || turn.moves.length === 0) return;
    const previous = undoLastMove(turn);
    setTurn(previous);
    setSelected(autoSelection(previous));
    setMessage(null);
  };

  const reset = (next: TurnState = initial) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setBusy(false);
    setTurn(next);
    setSelected(autoSelection(next));
    setMessage(null);
  };

  /** Plays a list of moves automatically (e.g. "show me"). */
  const autoplay = (moves: CheckerMove[], from: TurnState = initial) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMessage(null);
    setSelected(null);
    setTurn(from);
    setBusy(true);
    let current = from;
    moves.forEach((move, index) => {
      timers.current.push(
        setTimeout(() => {
          current = playMove(current, move);
          setTurn(current);
          if (index === moves.length - 1) setBusy(false);
        }, 450 + STEP_DELAY * 1.25 * index),
      );
    });
    if (moves.length === 0) setBusy(false);
  };

  const sources = enabled && !busy ? movableSources(turn) : [];
  const targets = selected !== null && enabled && !busy ? Array.from(destinationsFrom(turn, selected).keys()) : [];

  return {
    turn,
    selected,
    movable: sources,
    targets,
    message,
    busy,
    complete: isTurnComplete(turn),
    tap,
    undo,
    reset,
    autoplay,
  };
}

export type MoveInput = ReturnType<typeof useMoveInput>;

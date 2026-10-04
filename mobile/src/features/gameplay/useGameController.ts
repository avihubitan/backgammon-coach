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
  GameRuleError,
  isTurnComplete,
  rollDice,
  rollDie,
  sameMove,
  type CheckerMove,
  type GameAction,
  type GameState,
  type MoveSource,
} from '@/game';
import { DICE_SETTLE_MS, hopDelays } from '@/components/board/motion';
import { scheduleReviews } from '@/features/coach/reviewQueue';
import type { Reward } from '@/features/learning/progressModel';
import { reportChallengeEvent } from '@/features/challenges/challengeService';
import { currentFeatureAccess, useFeatureAccess } from '@/features/monetization/useFeatureAccess';
import { analytics } from '@/services/analytics';
import { crashReporter } from '@/services/crash';
import { feedback } from '@/services/feedback';
import { haptics } from '@/services/haptics';
import { useGameStore } from '@/state/gameStore';
import { useProgressStore } from '@/state/progressStore';
import { useSettingsStore } from '@/state/settingsStore';

import { coachHint, remainingHintMoves, type CoachHint } from './coachHint';
import { coachWatchApplies, watchPlay, type CoachWatchVerdict, watchSpacingAllows } from './coachWatch';
import { gameXp } from './gameModel';
import { pickLine, seedFrom, shouldSpeak, type Moment } from './opponentLines';
import { opponentFor } from './opponents';
import { aiStepDelay, OPENING_REVEAL_MS, PLAYER_PASS_MS } from './turnPacing';
import { destinationsFrom, movableSources, resolveTap, type TapPlace } from './moveInput';

/** How long a line stays next to the opponent's seat. */
const SPEECH_MS = 2800;
/** The greeting waits for the board to settle in. */
const GREETING_DELAY_MS = 700;

export interface GameOutcome {
  /** Id of the recorded game (for the coach review). */
  gameId: string | null;
  /** The computer level played. */
  level: string;
  xp: number;
  matchOver: boolean;
  newAchievements: string[];
  levelUp: number | null;
  /** The streak after this game, and any freeze it spent or earned. */
  streak: Pick<Reward, 'streak' | 'streakExtended' | 'freezesUsed' | 'freezeEarned'>;
}

const turnKey = (gameId: string, gameNumber: number, turnsPlayed: number) => `${gameId}-${gameNumber}-${turnsPlayed}`;

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
  const [messageTone, setMessageTone] = useState<'info' | 'warning'>('info');
  // The last refused tap, so the board can say "no" where it happened.
  const [refusal, setRefusal] = useState<{ key: number; place: TapPlace } | null>(null);
  // The decisive opening roll: each die stays on its owner's half for a moment.
  const [openingReveal, setOpeningReveal] = useState(false);
  // What the opponent just said, and when it last spoke (in finished turns).
  const [speech, setSpeech] = useState<{ key: number; text: string } | null>(null);
  const lastSpoke = useRef<number | null>(null);
  const greeted = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rollId, setRollId] = useState(0);
  const [lastAiPlay, setLastAiPlay] = useState<{ moves: CheckerMove[]; text: string } | null>(null);
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const aiPlan = useRef<CheckerMove[] | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const recordedFor = useRef<string | null>(null);
  // A hint belongs to one turn: it stops showing as soon as the turn changes.
  const [hint, setHint] = useState<{ turn: string; hint: CoachHint } | null>(null);
  const access = useFeatureAccess();
  const hintLimit = access.hintsPerGame();
  const watchLimit = access.coachWatchPerGame();
  // Coach Watch: the check waiting for an answer, and the last turn already checked (once per turn).
  const [watch, setWatch] = useState<{ turn: string; verdict: CoachWatchVerdict } | null>(null);
  const checkedTurn = useRef<string | null>(null);

  const state = active?.state ?? null;
  const level = active?.settings.level ?? 'beginner';
  const opponent = opponentFor(level);

  const say = (text: string, tone: 'info' | 'warning' = 'info') => {
    setMessage(text);
    setMessageTone(tone);
  };

  /** The opponent says something fitting, unless it spoke too recently. */
  const speak = (moment: Moment, turnsPlayed: number, delay = 0) => {
    const game = useGameStore.getState().active;
    if (!game || !shouldSpeak(moment, turnsPlayed, lastSpoke.current)) return;
    lastSpoke.current = turnsPlayed;
    const text = pickLine(game.settings.level, moment, seedFrom(game.id) + game.gameNumber + turnsPlayed);
    timers.current.push(
      setTimeout(() => {
        setSpeech((last) => ({ key: (last?.key ?? 0) + 1, text }));
        timers.current.push(setTimeout(() => setSpeech((now) => (now?.text === text ? null : now)), SPEECH_MS));
      }, delay),
    );
  };

  // A new game: the opponent says hello once the board has settled.
  const gameKey = active ? `${active.id}-${active.gameNumber}` : null;
  useEffect(() => {
    const current = latestState();
    if (!gameKey || greeted.current === gameKey || !current || current.phase !== 'opening' || current.openingTies.length > 0) return;
    greeted.current = gameKey;
    lastSpoke.current = null;
    if (useGameStore.getState().active?.gameNumber === 1) speak('greeting', 0, GREETING_DELAY_MS);
  }, [gameKey]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /** Records a finished game exactly once and celebrates it. */
  const onFinished = (finishedState: GameState) => {
    const game = useGameStore.getState().active;
    if (!game || !finishedState.result) return;
    const key = `${game.id}-${game.gameNumber}`;
    if (recordedFor.current === key) return;
    recordedFor.current = key;
    const recorded = useGameStore.getState().finishGame();
    // The coach reviews the game in the background (move quality, mistakes to practise).
    scheduleReviews();
    const xp = gameXp(game.settings.level, finishedState.result);
    const won = finishedState.result.winner === 'player1';
    const startedAt = new Date(game.startedAt).getTime();
    analytics.track('game_completed', {
      mode: 'ai',
      level: game.settings.level,
      won,
      result: finishedState.result.type,
      points: finishedState.result.points,
      turns: finishedState.history.length,
      duration_s: Number.isFinite(startedAt) ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0,
      hints_used: game.hintsUsed ?? 0,
      coach_watch_shown: game.watchUsed ?? 0,
    });
    const gammon = finishedState.result.type !== 'single';
    speak(won ? (gammon ? 'youGammon' : 'youWin') : gammon ? 'theyGammon' : 'theyWin', finishedState.history.length);
    const reward = useProgressStore.getState().awardXp(xp, { games: useGameStore.getState().stats });
    // The win sound and haptic come with the end banner on the game screen.
    if (finishedState.result.winner === 'player1') reportChallengeEvent({ type: 'game-won' });
    setOutcome({
      gameId: recorded?.finished.id ?? null,
      level: game.settings.level,
      xp,
      matchOver: recorded?.matchOver ?? true,
      newAchievements: reward.newAchievements,
      levelUp: reward.levelAfter > reward.levelBefore ? reward.levelAfter : null,
      streak: reward,
    });
  };

  const dispatch = (action: GameAction, extra?: Parameters<typeof updateState>[1]): GameState | null => {
    const current = latestState();
    if (!current) return null;
    let next: GameState;
    try {
      next = gameReducer(current, action);
    } catch (error) {
      // The rules refused a stale action (a tap that raced the game): the game stays as it was.
      if (!(error instanceof GameRuleError)) throw error;
      crashReporter.captureException(error, { action: action.type, phase: current.phase });
      return null;
    }
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

    const delay = aiStepDelay(state, { planned: aiPlan.current !== null, level });

    const timer = setTimeout(() => {
      const current = latestState();
      if (!current) return;
      if (current.phase === 'doubling') {
        const take = aiShouldTake(current.board, 'player1', level);
        say(take ? `${opponent.name} takes your double.` : `${opponent.name} drops. You win the game!`);
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
        const rolled = dispatch({ type: 'roll', dice: rollDice() });
        setRollId((id) => id + 1);
        if (rolled?.turn && rolled.turn.dice.length === 4) speak('theyDoubles', rolled.history.length, DICE_SETTLE_MS);
        return;
      }
      if (current.phase === 'moving' && current.turn) {
        if (isTurnComplete(current.turn)) {
          const moves = current.turn.moves;
          setLastAiPlay(
            moves.length > 0
              ? {
                  moves,
                  text: moves.some((move) => move.hit)
                    ? `${opponent.name} hit you (${formatPlay('player2', moves)}). Your checker is on the bar.`
                    : `${opponent.name} played ${formatPlay('player2', moves)}.`,
                }
              : { moves, text: `${opponent.name} couldn’t move.` },
          );
          aiPlan.current = null;
          dispatch({ type: 'end-turn' });
          return;
        }
        if (!aiPlan.current && current.turn.moves.length > 0) {
          // The plan isn't saved: the game was left (or the app closed) partway
          // through the computer's turn. It takes those moves back and starts over.
          for (let undo = current.turn.moves.length; undo > 0; undo--) dispatch({ type: 'undo' });
          return;
        }
        if (!aiPlan.current) {
          aiPlan.current = chooseAiPlay(current.board, 'player2', current.turn.roll!, level, Math.random).moves.slice();
        }
        // A planned move the rules refuse would throw here and crash the app;
        // it's reported and a legal move is played instead.
        const legal = currentLegalMoves(current);
        const planned = aiPlan.current.shift();
        const move = planned && legal.find((candidate) => sameMove(candidate, planned));
        if (!move) {
          crashReporter.captureException(new Error('The computer planned a move it can’t play'), {
            planned: planned ? `${String(planned.from)}->${String(planned.to)}/${planned.die}` : 'none',
          });
        }
        const next = move ?? legal[0];
        if (next?.hit) speak('theyHit', current.history.length, 300);
        if (next) dispatch({ type: 'move', move: next });
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
    const timer = setTimeout(() => dispatch({ type: 'end-turn' }), PLAYER_PASS_MS);
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
    if (dice[0] === dice[1]) say(`You both rolled ${dice[0]}. Roll again!`);
    else if (dice[0] > dice[1]) say(`You rolled ${dice[0]}, ${opponent.name} rolled ${dice[1]}. You start!`);
    else say(`${opponent.name} rolled ${dice[1]}, you rolled ${dice[0]}. ${opponent.name} starts.`);
    if (dice[0] !== dice[1]) {
      setOpeningReveal(true);
      timers.current.push(setTimeout(() => setOpeningReveal(false), OPENING_REVEAL_MS));
    }
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
    if (next?.turn && next.turn.dice.length === 4) speak('youDoubles', next.history.length, DICE_SETTLE_MS);
  };

  const double = () => {
    const current = latestState();
    if (!current || !canDouble(current) || current.currentPlayer !== 'player1') return;
    haptics.medium();
    say('You offered a double…');
    dispatch({ type: 'double' });
  };

  const respondToDouble = (take: boolean) => {
    const current = latestState();
    if (!current || current.phase !== 'doubling' || current.doubleOfferedBy !== 'player2') return;
    if (take) say('You took. The stakes are doubled and you own the cube.');
    else setMessage(null);
    dispatch({ type: take ? 'take' : 'drop' });
  };

  const runHumanMoves = (moves: CheckerMove[], instant = false) => {
    // A hit changes the game: say so, in words as well as on the board.
    if (moves.some((move) => move.hit)) {
      say(`Hit! ${opponent.name}’s checker goes to the bar.`);
      speak('youHit', latestState()?.history.length ?? 0, 350);
    }
    if (instant) {
      // A dragged checker goes straight to where it was dropped.
      let next = latestState();
      for (const move of moves) next = dispatch({ type: 'move', move });
      if (next) autoSelect(next);
      return;
    }
    // One hop per die: each lands and rests a moment before the next takes off.
    const start = latestState();
    const delays = start?.turn ? hopDelays(start.turn.board, 'player1', moves) : [];
    moves.forEach((move, index) => {
      const step = () => {
        // The game may have moved on meanwhile (a resign): only play a hop the rules still allow.
        const current = latestState();
        const stillLegal =
          !!current && current.phase === 'moving' && current.currentPlayer === 'player1' && currentLegalMoves(current).some((legal) => sameMove(legal, move));
        const next = stillLegal ? dispatch({ type: 'move', move }) : null;
        if (index === moves.length - 1 || !next) {
          setBusy(false);
          autoSelect(next ?? latestState());
        } else {
          setSelected(null);
        }
      };
      if (index === 0) step();
      else timers.current.push(setTimeout(step, delays[index] ?? 0));
    });
    if (moves.length > 1) setBusy(true);
  };

  const tap = (place: TapPlace, how?: { dragged?: boolean }) => {
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
        runHumanMoves(result.moves, !!how?.dragged);
        break;
      case 'invalid':
        haptics.warning();
        setSelected(null);
        say(result.reason, 'warning');
        setRefusal((last) => ({ key: (last?.key ?? 0) + 1, place }));
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

  /** Coach Watch's check before a move is confirmed; true when it stopped to ask. */
  const coachStops = (current: GameState): boolean => {
    const game = useGameStore.getState().active;
    if (!game || !current.turn) return false;
    const key = turnKey(game.id, game.gameNumber, current.history.length);
    const limit = currentFeatureAccess().coachWatchPerGame();
    const applies = coachWatchApplies({
      enabled: useSettingsStore.getState().coachWatch,
      alreadyChecked: checkedTurn.current === key,
      askedForHint: hint?.turn === key,
      used: game.watchUsed ?? 0,
      limit,
    });
    checkedTurn.current = key;
    if (!applies) return false;
    const verdict = watchPlay(current.turn);
    if (!verdict) return false;
    if (!watchSpacingAllows({ history: current.history, lastStopPly: game.watchLastPly, severity: verdict.severity })) return false;
    useGameStore.getState().countWatch(current.history.length);
    analytics.track('coach_watch_triggered', { level: game.settings.level, severity: verdict.severity, premium: limit === null });
    haptics.tap();
    setSelected(null);
    setWatch({ turn: key, verdict });
    return true;
  };

  const endTurn = () => {
    const current = latestState();
    if (!current || !canEndTurn(current) || current.currentPlayer !== 'player1') return;
    if (coachStops(current)) return;
    haptics.tap();
    // Hits count once the move is confirmed (undo can't farm them).
    for (const move of current.turn?.moves ?? []) if (move.hit) reportChallengeEvent({ type: 'hit' });
    setSelected(null);
    dispatch({ type: 'end-turn' });
  };

  /** The player's answer to Coach Watch. */
  const answerWatch = (choice: 'show' | 'retry' | 'play') => {
    const pending = watch;
    setWatch(null);
    if (choice === 'play') analytics.track('coach_watch_ignored', {});
    else analytics.track('coach_watch_accepted', { choice });
    if (choice === 'play') {
      endTurn();
      return;
    }
    let next = latestState();
    while (next?.turn && next.turn.moves.length > 0) next = dispatch({ type: 'undo' });
    autoSelect(next);
    if (!pending) return;
    if (choice === 'show') setHint({ turn: pending.turn, hint: pending.verdict.hint });
    else say(`Have another look. ${pending.verdict.clue}`);
  };

  const resign = () => {
    const current = latestState();
    if (!current || current.phase === 'finished') return;
    dispatch({ type: 'resign', player: 'player1' });
  };

  /**
   * The coach's play for this roll. Asking again on the same turn is free and
   * takes back moves that don't follow it, so the arrows start from the right place.
   */
  const requestHint = (): 'shown' | 'locked' | 'unavailable' => {
    const current = latestState();
    const game = useGameStore.getState().active;
    if (busy || !current || !game || current.phase !== 'moving' || current.currentPlayer !== 'player1') return 'unavailable';
    if (!current.turn || current.turn.requiredMoves === 0) return 'unavailable';
    const key = turnKey(game.id, game.gameNumber, current.history.length);
    let shown = hint?.turn === key ? hint.hint : null;
    if (!shown) {
      const limit = currentFeatureAccess().hintsPerGame();
      const used = game.hintsUsed ?? 0;
      if (limit !== null && used >= limit) return 'locked';
      shown = coachHint(current.turn);
      if (!shown) return 'unavailable';
      useGameStore.getState().countHint();
      analytics.track('game_hint_used', { level: game.settings.level, hints_used: used + 1, premium: limit === null });
      setHint({ turn: key, hint: shown });
    }
    if (remainingHintMoves(shown, current.turn.moves) === null) {
      let next: GameState | null = current;
      while (next?.turn && next.turn.moves.length > 0) next = dispatch({ type: 'undo' });
    }
    haptics.tap();
    setSelected(null);
    setMessage(null);
    return 'shown';
  };

  const humanMoving = !!state && state.phase === 'moving' && state.currentPlayer === 'player1' && !!state.turn;
  const currentHint =
    humanMoving && active && state && hint?.turn === turnKey(active.id, active.gameNumber, state.history.length) ? hint.hint : null;
  const hintsLeft = hintLimit === null ? null : Math.max(0, hintLimit - (active?.hintsUsed ?? 0));
  const currentWatch =
    humanMoving && active && state && watch?.turn === turnKey(active.id, active.gameNumber, state.history.length) ? watch.verdict : null;
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
    messageTone: dancing ? ('info' as const) : messageTone,
    /** The last tap the rules refused (a new key each time). */
    refusal,
    /** The opening roll's dice are still on their owners' halves. */
    openingReveal,
    /** What the opponent is saying right now, if anything. */
    speech,
    opponent,
    dancing,
    busy,
    rollId,
    lastAiPlay,
    /** The coach's suggestion for this turn, and what is left of it (null once the player plays something else). */
    hint: currentHint,
    hintMoves: currentHint && state?.turn ? remainingHintMoves(currentHint, state.turn.moves) : null,
    /** Hints left in this game (null: unlimited). */
    hintsLeft,
    requestHint,
    /** Coach Watch's question about the move just made (waiting for an answer). */
    watch: currentWatch,
    /** Checks left in this game (null: every move). */
    watchLeft: watchLimit === null ? null : Math.max(0, watchLimit - (active?.watchUsed ?? 0)),
    answerWatch,
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

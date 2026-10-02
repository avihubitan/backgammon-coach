import { initialBoard, opponentOf } from '../board/board';
import { acceptDouble, canOfferDouble, initialCube } from '../cube/cube';
import { isDouble, type DiceRoll } from '../dice/dice';
import { hasBorneOffAll } from '../rules/movement';
import { resultForBearOff, WIN_MULTIPLIER } from '../rules/outcome';
import {
  isTurnComplete,
  legalMovesNow,
  playMove,
  startTurn,
  undoLastMove,
  type TurnState,
} from '../rules/turn';
import type {
  BoardState,
  CheckerMove,
  CubeState,
  DieValue,
  GameResult,
  Player,
  WinType,
} from '../types';

export type GamePhase =
  /** Each player rolls one die to decide who starts. */
  | 'opening'
  /** The current player may double (if allowed) or roll. */
  | 'rolling'
  /** The current player is moving checkers. */
  | 'moving'
  /** A double has been offered; the opponent must take or drop. */
  | 'doubling'
  | 'finished';

export interface GameOptions {
  cubeEnabled: boolean;
  /** Gammons only count after the cube has been turned (money games). */
  jacoby: boolean;
  /** This is the Crawford game of a match: doubling is not allowed. */
  crawford: boolean;
}

export const DEFAULT_GAME_OPTIONS: GameOptions = {
  cubeEnabled: true,
  jacoby: false,
  crawford: false,
};

export type CubeAction = 'double' | 'take' | 'drop';

export interface TurnRecord {
  player: Player;
  roll: DiceRoll | null;
  boardBefore: BoardState;
  moves: CheckerMove[];
  cubeAction?: CubeAction;
}

export interface GameState {
  board: BoardState;
  currentPlayer: Player;
  phase: GamePhase;
  /** The turn currently being played (phase 'moving'). */
  turn: TurnState | null;
  cube: CubeState;
  /** Who offered the pending double (phase 'doubling'). */
  doubleOfferedBy: Player | null;
  options: GameOptions;
  /** Completed turns and cube actions in order. */
  history: TurnRecord[];
  /** Tied opening rolls, kept so the opening sequence can be shown. */
  openingTies: DieValue[];
  result: GameResult | null;
}

export type GameAction =
  /** dice[0] is player1's die, dice[1] is player2's die. */
  | { type: 'opening-roll'; dice: DiceRoll }
  | { type: 'roll'; dice: DiceRoll }
  | { type: 'move'; move: Pick<CheckerMove, 'from' | 'to' | 'die'> }
  | { type: 'undo' }
  | { type: 'end-turn' }
  | { type: 'double' }
  | { type: 'take' }
  | { type: 'drop' }
  | { type: 'resign'; player: Player; winType?: WinType };

export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameRuleError';
  }
}

export function createGame(
  options: Partial<GameOptions> = {},
  board: BoardState = initialBoard(),
): GameState {
  return {
    board,
    currentPlayer: 'player1',
    phase: 'opening',
    turn: null,
    cube: initialCube(),
    doubleOfferedBy: null,
    options: { ...DEFAULT_GAME_OPTIONS, ...options },
    history: [],
    openingTies: [],
    result: null,
  };
}

/** Starts a game from an arbitrary position with `player` to roll (used by lessons and drills). */
export function createGameFromPosition(
  board: BoardState,
  player: Player,
  options: Partial<GameOptions> = {},
  cube: CubeState = initialCube(),
): GameState {
  return { ...createGame(options, board), currentPlayer: player, phase: 'rolling', cube };
}

export function canDouble(state: GameState): boolean {
  return (
    state.phase === 'rolling' &&
    state.options.cubeEnabled &&
    canOfferDouble(state.cube, state.currentPlayer, { crawford: state.options.crawford })
  );
}

export function canEndTurn(state: GameState): boolean {
  return state.phase === 'moving' && state.turn !== null && isTurnComplete(state.turn);
}

export function canUndo(state: GameState): boolean {
  return state.phase === 'moving' && (state.turn?.moves.length ?? 0) > 0;
}

export function currentLegalMoves(state: GameState): CheckerMove[] {
  return state.phase === 'moving' && state.turn ? legalMovesNow(state.turn) : [];
}

function finish(state: GameState, result: GameResult): GameState {
  return { ...state, phase: 'finished', turn: null, doubleOfferedBy: null, result };
}

function beginTurn(state: GameState, player: Player, dice: DiceRoll): GameState {
  return {
    ...state,
    currentPlayer: player,
    phase: 'moving',
    turn: startTurn(state.board, player, dice),
  };
}

/**
 * Pure state transition for a game. Throws `GameRuleError` for actions that
 * are not allowed in the current state so bugs surface immediately.
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'opening-roll': {
      if (state.phase !== 'opening') throw new GameRuleError('The opening roll has already happened');
      const [p1, p2] = action.dice;
      if (p1 === p2) return { ...state, openingTies: [...state.openingTies, p1] };
      const starter: Player = p1 > p2 ? 'player1' : 'player2';
      return beginTurn(state, starter, [p1, p2]);
    }

    case 'roll': {
      if (state.phase !== 'rolling') throw new GameRuleError('You cannot roll right now');
      return beginTurn(state, state.currentPlayer, action.dice);
    }

    case 'move': {
      if (state.phase !== 'moving' || !state.turn) throw new GameRuleError('You cannot move right now');
      let turn: TurnState;
      try {
        turn = playMove(state.turn, action.move);
      } catch (error) {
        throw new GameRuleError((error as Error).message);
      }
      const next: GameState = { ...state, turn, board: turn.board };
      if (hasBorneOffAll(turn.board, state.currentPlayer)) {
        const record: TurnRecord = {
          player: state.currentPlayer,
          roll: turn.roll,
          boardBefore: turn.startBoard,
          moves: turn.moves,
        };
        return finish(
          { ...next, history: [...state.history, record] },
          resultForBearOff(turn.board, state.currentPlayer, state.cube.value, {
            jacoby: state.options.jacoby,
          }),
        );
      }
      return next;
    }

    case 'undo': {
      if (!canUndo(state) || !state.turn) throw new GameRuleError('Nothing to undo');
      const turn = undoLastMove(state.turn);
      return { ...state, turn, board: turn.board };
    }

    case 'end-turn': {
      if (!canEndTurn(state) || !state.turn) throw new GameRuleError('You still have dice to play');
      const record: TurnRecord = {
        player: state.currentPlayer,
        roll: state.turn.roll,
        boardBefore: state.turn.startBoard,
        moves: state.turn.moves,
      };
      return {
        ...state,
        currentPlayer: opponentOf(state.currentPlayer),
        phase: 'rolling',
        turn: null,
        history: [...state.history, record],
      };
    }

    case 'double': {
      if (!canDouble(state)) throw new GameRuleError('You cannot double right now');
      return {
        ...state,
        phase: 'doubling',
        doubleOfferedBy: state.currentPlayer,
        history: [
          ...state.history,
          { player: state.currentPlayer, roll: null, boardBefore: state.board, moves: [], cubeAction: 'double' },
        ],
      };
    }

    case 'take': {
      if (state.phase !== 'doubling' || !state.doubleOfferedBy) throw new GameRuleError('No double to take');
      const taker = opponentOf(state.doubleOfferedBy);
      return {
        ...state,
        phase: 'rolling',
        cube: acceptDouble(state.cube, taker),
        doubleOfferedBy: null,
        history: [
          ...state.history,
          { player: taker, roll: null, boardBefore: state.board, moves: [], cubeAction: 'take' },
        ],
      };
    }

    case 'drop': {
      if (state.phase !== 'doubling' || !state.doubleOfferedBy) throw new GameRuleError('No double to drop');
      const dropper = opponentOf(state.doubleOfferedBy);
      return finish(
        {
          ...state,
          history: [
            ...state.history,
            { player: dropper, roll: null, boardBefore: state.board, moves: [], cubeAction: 'drop' },
          ],
        },
        {
          winner: state.doubleOfferedBy,
          type: 'single',
          cubeValue: state.cube.value,
          points: state.cube.value,
          reason: 'dropped-double',
        },
      );
    }

    case 'resign': {
      if (state.phase === 'finished') throw new GameRuleError('The game is already over');
      const winType = action.winType ?? 'single';
      return finish(state, {
        winner: opponentOf(action.player),
        type: winType,
        cubeValue: state.cube.value,
        points: state.cube.value * WIN_MULTIPLIER[winType],
        reason: 'resigned',
      });
    }
  }
}

/** Convenience: apply several actions in order. */
export function applyActions(state: GameState, actions: GameAction[]): GameState {
  return actions.reduce(gameReducer, state);
}

export function isDoubleRoll(dice: DiceRoll | null): boolean {
  return dice !== null && isDouble(dice);
}

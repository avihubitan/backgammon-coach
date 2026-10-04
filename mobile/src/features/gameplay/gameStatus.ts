import { allCheckersHome, canEndTurn, type GameState } from '@/game';

export interface StatusInput {
  state: GameState;
  /** Something the game just said: an opening roll, a refused tap, a cube answer. */
  message: string | null;
  messageTone: 'info' | 'warning';
  /** What the opponent did on its last turn, shown until the player rolls. */
  lastAiPlay: { text: string } | null;
  opponentName: string;
  /** The player is new to games: say how moving works. */
  showHowTo: boolean;
}

export interface Status {
  text: string;
  tone: 'neutral' | 'info' | 'warning';
}

/**
 * The one line under the board. It speaks when there's something to say (a
 * rule that applies right now, what just happened) and stays quiet otherwise:
 * the seats show whose turn it is and the buttons what to do next.
 */
export function gameStatus({ state, message, messageTone, lastAiPlay, opponentName, showHowTo }: StatusInput): Status | null {
  if (state.phase === 'finished') return null;
  if (message) return { text: message, tone: messageTone };
  if (state.phase === 'opening') return { text: 'Roll to see who goes first.', tone: 'neutral' };
  if (state.phase === 'doubling') {
    return state.doubleOfferedBy === 'player2'
      ? { text: `${opponentName} doubles to ${state.cube.value * 2}. Take or drop?`, tone: 'info' }
      : { text: `Waiting for ${opponentName}’s answer…`, tone: 'neutral' };
  }
  if (state.currentPlayer !== 'player1') return null;
  if (state.phase === 'rolling') return lastAiPlay ? { text: lastAiPlay.text, tone: 'neutral' } : null;

  const turn = state.turn;
  if (!turn) return null;
  if (canEndTurn(state)) return showHowTo ? { text: 'Happy with it? Tap Done, or Undo to try again.', tone: 'neutral' } : null;
  if (state.board.bar.player1 > 0) {
    return { text: `You’re on the bar: come back in on ${opponentName}’s side first.`, tone: 'info' };
  }
  // The first bear-off turn of the game: say how it works.
  if (turn.moves.length === 0 && state.board.off.player1 === 0 && allCheckersHome(state.board, 'player1')) {
    return { text: 'All your checkers are home: bear them off! Move a checker onto the tray.', tone: 'info' };
  }
  return showHowTo ? { text: 'Drag a checker where it should go, or tap it, then its spot.', tone: 'neutral' } : null;
}

/** Games against the computer after which the board stops explaining how to move. */
export const HOW_TO_GAMES = 2;

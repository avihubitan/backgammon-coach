import { getLegalPlays, positionKey } from '@/game';

import { ATTRACT_SCRIPT, attractStart, playAttractTurn } from '../attractScript';

describe('welcome screen demo', () => {
  it('plays only legal moves, including a hit and an entry from the bar', () => {
    let board = attractStart();
    let sawHit = false;
    let sawEntry = false;
    for (const turn of ATTRACT_SCRIPT) {
      const boards = playAttractTurn(board, turn);
      const end = boards[boards.length - 1];
      const legal = getLegalPlays(board, turn.player, turn.dice).map((play) => positionKey(play.board));
      expect(legal).toContain(positionKey(end));
      if (end.bar.player1 + end.bar.player2 > board.bar.player1 + board.bar.player2) sawHit = true;
      if (turn.moves.some((move) => move.from === 'bar')) sawEntry = true;
      board = end;
    }
    expect(sawHit).toBe(true);
    expect(sawEntry).toBe(true);
  });
});

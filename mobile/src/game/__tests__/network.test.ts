import {
  chooseAiPlay,
  createBoard,
  createRng,
  evaluateNetwork,
  HEURISTIC_THRESHOLDS,
  initialBoard,
  installNetwork,
  loadDefaultNetwork,
  NETWORK_THRESHOLDS,
  positionKey,
  rankByEquity,
  severityThresholds,
} from '@/game';

const net = loadDefaultNetwork();

afterEach(() => installNetwork(null));

describe('shipped network', () => {
  it('loads and produces probabilities', () => {
    expect(net.hidden).toBe(64);
    const evaluation = evaluateNetwork(net, initialBoard(), 'player1');
    for (const value of [evaluation.win, evaluation.winGammon, evaluation.loseGammon]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    // The starting position is roughly even for the side that just moved.
    expect(evaluation.win).toBeGreaterThan(0.3);
    expect(evaluation.win).toBeLessThan(0.7);
  });

  it('recognises a race that is won and one that is lost', () => {
    const winning = createBoard({ player1: { 1: 2 }, player2: { 1: 0, 13: 15 }, off: { player1: 13 } });
    expect(evaluateNetwork(net, winning, 'player1').win).toBeGreaterThan(0.9);
    const losing = createBoard({ player1: { 24: 15 }, player2: { 24: 0, 23: 2 }, off: { player2: 13 } });
    expect(evaluateNetwork(net, losing, 'player1').win).toBeLessThan(0.1);
  });

  it('powers the advanced level only; the gentle levels stay on the heuristic', () => {
    const board = createBoard({
      player1: { 24: 2, 13: 4, 9: 1, 8: 2, 6: 5, 4: 1 },
      player2: { 1: 2, 12: 4, 17: 3, 19: 4, 20: 2 },
    });
    const roll: [3, 1] = [3, 1];
    const gentle = (level: 'beginner' | 'intermediate') => positionKey(chooseAiPlay(board, 'player1', roll, level, createRng(5)).board);
    const before = { beginner: gentle('beginner'), intermediate: gentle('intermediate') };
    installNetwork(net);
    expect(gentle('beginner')).toBe(before.beginner);
    expect(gentle('intermediate')).toBe(before.intermediate);
    const advanced = chooseAiPlay(board, 'player1', roll, 'advanced', createRng(5));
    expect(positionKey(advanced.board)).toBe(positionKey(rankByEquity(board, 'player1', roll)[0].play.board));
  });

  it('grades moves on the scale of the evaluator in use', () => {
    expect(severityThresholds()).toBe(HEURISTIC_THRESHOLDS);
    installNetwork(net);
    expect(severityThresholds()).toBe(NETWORK_THRESHOLDS);
  });
});

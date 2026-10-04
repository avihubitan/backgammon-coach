import type { IconName } from '@/components/ui/Icon';
import type { BoardSpec, DieValue } from '@/game';
import { OPENING_PLAYS } from '@/game';

import { START } from './builders';
import type { SkillId } from './skills';
import type { MoveGoal } from './types';

/**
 * Repeatable tactical drills. Each drill states a concrete objective (find the
 * hit, play safe, make a point…) that is checked by the rules engine, so the
 * answer is never a matter of opinion.
 */
export type DrillCategory =
  | 'board'
  | 'read'
  | 'hitting'
  | 'shots'
  | 'safety'
  | 'points'
  | 'primes'
  | 'anchors'
  | 'escape'
  | 'race'
  | 'bear-off'
  | 'opening';

export interface TacticalDrill {
  id: string;
  category: DrillCategory;
  difficulty: 1 | 2 | 3;
  prompt: string;
  position: BoardSpec;
  dice: [DieValue, DieValue];
  goal: MoveGoal;
  solution: string;
  /** Why the solution works, shown after the answer. */
  explanation: string;
  /** The skill this drill trains, when it isn't its category's. */
  skill?: SkillId;
  /** A lesson this drill needs beyond its category's, when it uses a later idea. */
  requiresLesson?: string;
  /** The level it belongs to (default: the category's hand-picked 'classics'). */
  level?: string;
}

/**
 * A step up within a drill: first contact with the idea, then harder
 * versions. Levels unlock with lessons and open one by one as the learner
 * gets them right.
 */
export interface DrillLevel {
  id: string;
  title: string;
  /** A lesson this level needs beyond the category's own. */
  requiresLesson?: string;
  /** The skill this level trains, when it isn't its category's. */
  skill?: SkillId;
  /** A speed level: answer within this many seconds. */
  targetSeconds?: number;
}

export interface DrillCategoryInfo {
  id: DrillCategory;
  title: string;
  description: string;
  icon: IconName;
  color: string;
  /** The skill the drills train. */
  skill: SkillId;
  /** Other skills some of its items train: the coach can send those here too. */
  alsoTrains?: SkillId[];
  /** The lesson that teaches it: the drills unlock once it's completed. */
  requiresLesson: string;
  /** Easiest first. Generated levels make fresh positions every time; 'classics' are hand-picked. */
  levels: DrillLevel[];
  /** Every session mixes all open levels (a routine to rehearse, rather than steps to climb). */
  mixLevels?: boolean;
}

/** In learning-path order. */
export const DRILL_CATEGORIES: DrillCategoryInfo[] = [
  {
    id: 'board',
    title: 'Find the point',
    description: 'Spot any point at a glance.',
    icon: 'map-marker-radius',
    color: '#38BDF8',
    skill: 'board',
    requiresLesson: 'board-2',
    levels: [
      { id: 'numbers', title: 'Numbers on' },
      { id: 'hidden', title: 'Numbers off' },
      { id: 'landing', title: 'Where does it land?', requiresLesson: 'board-5', skill: 'rules' },
      { id: 'names', title: 'Points by name', requiresLesson: 'points-1' },
    ],
  },
  {
    id: 'read',
    title: 'Position check',
    description: 'Ask the right questions before you move.',
    icon: 'magnify',
    color: '#FBBF24',
    skill: 'board',
    requiresLesson: 'hitting-1',
    mixLevels: true,
    levels: [
      { id: 'blots', title: 'Where are your blots?', skill: 'hitting' },
      { id: 'can-hit', title: 'Can you hit?', requiresLesson: 'hitting-2', skill: 'hitting' },
      { id: 'shots', title: 'How many shots?', requiresLesson: 'hitting-4', skill: 'shots' },
      { id: 'make-point', title: 'Can you make a point?', requiresLesson: 'points-1', skill: 'points' },
      { id: 'wall', title: 'How long is your wall?', requiresLesson: 'points-3', skill: 'primes' },
      { id: 'anchor', title: 'Do you have an anchor?', requiresLesson: 'position-1', skill: 'anchors' },
      { id: 'trapped', title: 'Are you getting trapped?', requiresLesson: 'position-2', skill: 'escaping' },
      { id: 'bear-off', title: 'Can you bear off?', requiresLesson: 'bearoff-1', skill: 'bear-off' },
      { id: 'race', title: 'Race or fight?', requiresLesson: 'bearoff-4', skill: 'racing' },
      { id: 'leader', title: 'Who leads the race?', requiresLesson: 'bearoff-4', skill: 'pips' },
    ],
  },
  {
    id: 'hitting',
    title: 'Find the hit',
    description: 'Spot every way to hit a blot.',
    icon: 'target',
    color: '#FF8A3D',
    skill: 'hitting',
    requiresLesson: 'hitting-3',
    levels: [
      { id: 'one-number', title: 'One number hits' },
      { id: 'both-dice', title: 'Both dice together' },
      { id: 'from-bar', title: 'Enter and hit' },
      { id: 'hunt', title: 'Hunt them down' },
      { id: 'classics', title: 'Hand-picked hits' },
    ],
  },
  {
    id: 'shots',
    title: 'Count the shots',
    description: 'How risky is that blot?',
    icon: 'crosshairs-question',
    color: '#FF6B8A',
    skill: 'shots',
    requiresLesson: 'hitting-4',
    levels: [
      { id: 'can-hit', title: 'Can they hit it?' },
      { id: 'direct', title: 'Direct or indirect?' },
      { id: 'count', title: 'Count the rolls' },
      { id: 'fewer', title: 'Which leaves fewer shots?', requiresLesson: 'points-2' },
    ],
  },
  {
    id: 'safety',
    title: 'Play it safe',
    description: 'Leave no blots behind.',
    icon: 'shield-check',
    color: '#62B6FF',
    skill: 'safety',
    requiresLesson: 'points-2',
    levels: [
      { id: 'classics', title: 'Hand-picked' },
      { id: 'no-blots', title: 'Leave no blots' },
    ],
  },
  {
    id: 'points',
    title: 'Make points',
    description: 'Make the points that matter.',
    icon: 'wall',
    color: '#B98CFF',
    skill: 'points',
    requiresLesson: 'points-1',
    levels: [
      { id: 'classics', title: 'Hand-picked' },
      { id: 'make', title: 'Make the point' },
    ],
  },
  {
    id: 'primes',
    title: 'Walls & primes',
    description: 'Spot the wall, then finish it.',
    icon: 'fence',
    color: '#A78BFA',
    skill: 'primes',
    requiresLesson: 'points-3',
    levels: [
      { id: 'length', title: 'How long is the wall?' },
      { id: 'gap', title: 'Find the gap' },
      { id: 'build', title: 'Complete the prime' },
      { id: 'wall-race', title: 'Build it in time' },
    ],
  },
  {
    id: 'anchors',
    title: 'Anchors',
    description: 'Find and make a safe base.',
    icon: 'anchor',
    color: '#22D3EE',
    skill: 'anchors',
    requiresLesson: 'position-1',
    levels: [
      { id: 'spot', title: 'Spot the anchor' },
      { id: 'make', title: 'Make an anchor' },
      { id: 'classics', title: 'Hand-picked' },
    ],
  },
  {
    id: 'escape',
    title: 'Run for it',
    description: 'Get your back checkers out in time.',
    icon: 'run-fast',
    color: '#F472B6',
    skill: 'escaping',
    requiresLesson: 'position-2',
    levels: [
      { id: 'classics', title: 'Hand-picked' },
      { id: 'run', title: 'Escape in time' },
    ],
  },
  {
    id: 'race',
    title: 'Who’s ahead?',
    description: 'Count the race and read it.',
    icon: 'counter',
    color: '#3DD68C',
    skill: 'pips',
    alsoTrains: ['racing'],
    requiresLesson: 'bearoff-4',
    levels: [
      { id: 'closer', title: 'Who’s closer?' },
      { id: 'small', title: 'Count a few checkers' },
      { id: 'contact', title: 'Race or not?', skill: 'racing' },
      { id: 'home', title: 'Race home', skill: 'racing' },
      { id: 'compare', title: 'Compare two sides' },
      { id: 'full', title: 'Count a full board' },
      { id: 'quick', title: 'Quick count', targetSeconds: 20 },
      { id: 'favourite', title: 'Who’s the favourite?', requiresLesson: 'racing-1', skill: 'racing' },
    ],
  },
  {
    id: 'bear-off',
    title: 'Bear-off speed',
    description: 'Take checkers off efficiently.',
    icon: 'home-export-outline',
    color: '#F3B847',
    skill: 'bear-off',
    requiresLesson: 'bearoff-3',
    levels: [
      { id: 'classics', title: 'Hand-picked' },
      { id: 'most', title: 'Most checkers off' },
      { id: 'clear', title: 'Clear the board' },
    ],
  },
  {
    id: 'opening',
    title: 'Opening moves',
    description: 'Play the standard first moves.',
    icon: 'book-open-variant',
    color: '#5FD3E8',
    skill: 'openings',
    requiresLesson: 'openings-2',
    levels: [
      { id: 'point-makers', title: 'Point-making rolls' },
      { id: 'every-roll', title: 'Every roll' },
    ],
  },
];

export const getDrillCategory = (id: string): DrillCategoryInfo | undefined => DRILL_CATEGORIES.find((info) => info.id === id);

const BASE_P2: BoardSpec['player2'] = { 1: 2, 12: 4, 17: 3, 19: 5 };

export const TACTICAL_DRILLS: TacticalDrill[] = [
  // Hitting --------------------------------------------------------------------
  {
    id: 'hit-1',
    category: 'hitting',
    difficulty: 1,
    prompt: 'You rolled **3-1**. Find a move that hits.',
    position: { player1: { 24: 2, 13: 4, 8: 3, 6: 5 }, player2: { ...BASE_P2, 10: 1 } },
    dice: [3, 1],
    goal: { type: 'hit', point: 10 },
    solution: '13/10* 6/5',
    explanation: 'The blot on the 10-point is exactly 3 away from your mid-point: 13/10* sends it back.',
  },
  {
    id: 'hit-2',
    category: 'hitting',
    difficulty: 2,
    prompt: 'You rolled **4-2**. Can your back checkers hit something?',
    position: { player1: { 24: 2, 13: 5, 8: 3, 6: 5 }, player2: { 1: 2, 12: 5, 17: 3, 18: 1, 19: 4 } },
    dice: [4, 2],
    goal: { type: 'hit', point: 18 },
    solution: '24/18*',
    explanation: 'Add the dice: 4 + 2 = 6. A back checker reaches the 18-point by stopping on 20 or 22 first.',
  },
  {
    id: 'hit-3',
    category: 'hitting',
    difficulty: 2,
    prompt: 'You’re on the bar with **5-3**. Enter **and** hit.',
    position: {
      player1: { 24: 1, 13: 5, 8: 3, 6: 5 },
      player2: { 1: 2, 12: 4, 17: 3, 19: 5, 22: 1 },
      bar: { player1: 1 },
    },
    dice: [5, 3],
    goal: { type: 'hit', point: 22 },
    solution: 'bar/22* 13/8',
    explanation: 'A 3 enters on the 22-point, right where the blot sits. Entering and hitting in one move!',
  },
  {
    id: 'hit-4',
    category: 'hitting',
    difficulty: 3,
    prompt: 'You rolled **3-1**. Hit **two** blots at once.',
    position: { player1: { 24: 2, 13: 5, 8: 3, 6: 5 }, player2: { 1: 2, 12: 3, 17: 3, 19: 5, 10: 1, 7: 1 } },
    dice: [3, 1],
    goal: { type: 'plays', plays: ['13/10* 8/7*'] },
    solution: '13/10* 8/7*',
    explanation: 'Two hits: 13/10* with the 3 and 8/7* with the 1. Your opponent has two checkers to bring back.',
  },
  {
    id: 'hit-5',
    category: 'hitting',
    difficulty: 2,
    prompt: 'You rolled **2-2**. Find the hit.',
    position: { player1: { 24: 2, 13: 5, 8: 3, 6: 5 }, player2: { ...BASE_P2, 9: 1 } },
    dice: [2, 2],
    goal: { type: 'hit', point: 9 },
    solution: '13/9* 6/4(2)',
    explanation: 'Doubles give you four 2s: two of them carry a checker from 13 to 9 and hit.',
  },
  {
    id: 'hit-6',
    category: 'hitting',
    difficulty: 3,
    prompt: 'You rolled **4-2**. Hit **and** make the point in the same move.',
    position: { player1: { 24: 2, 13: 4, 9: 1, 8: 3, 6: 4 }, player2: { ...BASE_P2, 4: 1 } },
    dice: [4, 2],
    goal: { type: 'plays', plays: ['8/4* 6/4'] },
    solution: '8/4* 6/4',
    explanation: 'Pointing on the blot: one checker hits, the other joins it, so nothing is left for a return hit.',
    requiresLesson: 'position-2',
  },

  // Safety ---------------------------------------------------------------------
  {
    id: 'safe-1',
    category: 'safety',
    difficulty: 1,
    prompt: 'You rolled **5-2**. Leave **no blots**.',
    position: { player1: { 13: 3, 10: 1, 7: 1, 6: 3, 5: 2 }, player2: BASE_P2 },
    dice: [5, 2],
    goal: { type: 'safe' },
    solution: '10/5 7/5',
    explanation: 'Both loose checkers can join the 5-point: 10/5 with the 5 and 7/5 with the 2.',
  },
  {
    id: 'safe-2',
    category: 'safety',
    difficulty: 1,
    prompt: 'You rolled **5-1**. Tidy up your blots.',
    position: { player1: { 13: 3, 11: 1, 7: 1, 6: 3 }, player2: BASE_P2 },
    dice: [5, 1],
    goal: { type: 'safe' },
    solution: '11/6 7/6',
    explanation: 'Both blots can reach the 6-point: the 11 is 5 away and the 7 is 1 away.',
  },
  {
    id: 'safe-3',
    category: 'safety',
    difficulty: 2,
    prompt: 'You rolled **4-2**. Play safely.',
    position: { player1: { 13: 2, 8: 3, 6: 3, 4: 1 }, player2: BASE_P2 },
    dice: [4, 2],
    goal: { type: 'safe' },
    solution: '8/4 6/4',
    explanation: 'Covering the 4-point with two checkers leaves every point with at least two.',
  },
  {
    id: 'safe-4',
    category: 'safety',
    difficulty: 2,
    prompt: 'You rolled **2-2**. Play all four 2s without leaving a blot.',
    position: { player1: { 13: 2, 10: 1, 8: 1, 6: 3, 4: 1 }, player2: BASE_P2 },
    dice: [2, 2],
    goal: { type: 'safe' },
    solution: '13/11(2) 10/8 6/4',
    explanation: 'Pair everything up: 10/8 and 6/4 cover your blots, and both mid-point checkers move together to 11.',
  },
  {
    id: 'safe-5',
    category: 'escape',
    difficulty: 2,
    prompt: 'You rolled **6-5**. Get your last back checker to safety.',
    position: { player1: { 24: 1, 13: 5, 8: 3, 6: 5 }, player2: BASE_P2 },
    dice: [6, 5],
    goal: { type: 'safe' },
    solution: '24/13',
    explanation: 'The lover’s leap: 24/18/13 brings the straggler all the way to your mid-point.',
  },
  {
    id: 'escape-2',
    category: 'escape',
    difficulty: 2,
    prompt: 'You rolled **6-5**. Their wall is growing: get your last back checker out to safety.',
    position: { player1: { 21: 1, 13: 4, 10: 2, 8: 3, 6: 5 }, player2: { 22: 2, 20: 2, 19: 3, 17: 2, 16: 2, 12: 4 } },
    dice: [6, 5],
    goal: { type: 'safe' },
    solution: '21/10',
    explanation: '21/15/10 jumps their points and lands on your own: out, and safe.',
  },
  {
    id: 'escape-3',
    category: 'escape',
    difficulty: 2,
    prompt: 'You rolled **5-4**. Run your back checker all the way to safety.',
    position: { player1: { 22: 1, 13: 5, 8: 3, 6: 4, 4: 2 }, player2: { 23: 2, 20: 2, 19: 3, 16: 2, 12: 4, 1: 2 } },
    dice: [5, 4],
    goal: { type: 'safe' },
    solution: '22/13',
    explanation: '22/17/13 slips past their points and joins your mid-point.',
  },

  // Making points --------------------------------------------------------------
  {
    id: 'points-1',
    category: 'points',
    difficulty: 1,
    prompt: 'You rolled **4-3**. Make your **5-point**.',
    position: { player1: { 24: 2, 13: 4, 9: 1, 8: 2, 6: 5 }, player2: BASE_P2 },
    dice: [4, 3],
    goal: { type: 'make-point', point: 5 },
    solution: '9/5 8/5',
    explanation: 'Bring a checker from the 9-point (4 away) and one from the 8-point (3 away) together.',
  },
  {
    id: 'points-2',
    category: 'points',
    difficulty: 1,
    prompt: 'You rolled **6-1**. Make your **bar point** (the 7-point).',
    position: { player1: { 24: 2, 13: 5, 8: 2, 6: 4, 3: 2 }, player2: BASE_P2 },
    dice: [6, 1],
    goal: { type: 'make-point', point: 7 },
    solution: '13/7 8/7',
    explanation: '13/7 and 8/7 build a wall right in front of your opponent’s back checkers.',
  },
  {
    id: 'points-3',
    category: 'anchors',
    difficulty: 2,
    prompt: 'You rolled **3-2**. Make an **anchor** in your opponent’s home board.',
    position: { player1: { 24: 1, 21: 1, 13: 5, 8: 3, 6: 5 }, player2: BASE_P2 },
    dice: [3, 2],
    goal: { type: 'make-point', point: 21 },
    solution: '24/21 13/11',
    explanation: 'Your back checkers team up on the 21-point: an anchor they can always land on.',
  },
  {
    id: 'anchor-2',
    category: 'anchors',
    difficulty: 2,
    prompt: 'You rolled **4-4**. Make an anchor on their **5-point** (your 20-point).',
    position: { player1: { 24: 2, 13: 5, 8: 3, 6: 5 }, player2: BASE_P2 },
    dice: [4, 4],
    goal: { type: 'make-point', point: 20 },
    solution: '24/20(2) 13/9(2)',
    explanation: 'Both back checkers step up together: their best point becomes your safe base.',
  },
  {
    id: 'anchor-3',
    category: 'anchors',
    difficulty: 3,
    prompt: 'You’re on the bar with **5-3**. Enter and make an anchor.',
    position: { player1: { 22: 1, 13: 5, 8: 3, 6: 5 }, player2: { 1: 2, 12: 4, 17: 3, 19: 4, 21: 1 }, bar: { player1: 1 } },
    dice: [5, 3],
    goal: { type: 'make-point', point: 22 },
    solution: 'bar/22 13/8',
    explanation: 'The 3 enters on the 22-point, right beside your other back checker: an anchor in one move.',
  },
  {
    id: 'points-4',
    category: 'points',
    difficulty: 2,
    prompt: 'You rolled **4-2**. Make a new home-board point.',
    position: { player1: { 24: 2, 13: 4, 10: 1, 8: 3, 6: 5 }, player2: BASE_P2 },
    dice: [4, 2],
    goal: { type: 'make-point', point: 4 },
    solution: '8/4 6/4',
    explanation: '8/4 and 6/4 make your 4-point. Home-board points make it hard for hit checkers to come back in.',
  },
  {
    id: 'points-5',
    category: 'points',
    difficulty: 3,
    prompt: 'You rolled **3-3**. Make your **5-point** (and more if you can).',
    position: START,
    dice: [3, 3],
    goal: { type: 'make-point', point: 5 },
    solution: '8/5(2) 6/3(2)',
    explanation: 'Two checkers 8/5 make the 5-point; the other two 3s can make the 3-point too.',
  },

  // Bear-off --------------------------------------------------------------------
  {
    id: 'bear-1',
    category: 'bear-off',
    difficulty: 1,
    prompt: 'You rolled **6-5**. Bear off as many checkers as you can.',
    position: { player1: { 6: 2, 5: 1, 3: 2 }, player2: { 20: 4 }, off: { player1: 10 } },
    dice: [6, 5],
    goal: { type: 'bear-off', count: 2 },
    solution: '6/off 5/off',
    explanation: 'Use each number exactly: the 6 from the 6-point and the 5 from the 5-point.',
  },
  {
    id: 'bear-2',
    category: 'bear-off',
    difficulty: 2,
    prompt: 'You rolled **3-2**. Bear off as many checkers as you can.',
    position: { player1: { 5: 1, 3: 1, 2: 1 }, player2: { 20: 4 }, off: { player1: 12 } },
    dice: [3, 2],
    goal: { type: 'bear-off', count: 2 },
    solution: '3/off 2/off',
    explanation: 'Both numbers are exact: 3/off and 2/off. Moving the 5-point checker would only take one off.',
  },
  {
    id: 'bear-3',
    category: 'bear-off',
    difficulty: 1,
    prompt: 'You rolled **6-1**. Bear off two checkers.',
    position: { player1: { 6: 1, 5: 2, 1: 1 }, player2: { 20: 4 }, off: { player1: 11 } },
    dice: [6, 1],
    goal: { type: 'bear-off', count: 2 },
    solution: '6/off 1/off',
    explanation: 'Exact numbers: the 6 takes off the 6-point checker and the 1 the 1-point checker.',
  },
  {
    id: 'bear-4',
    category: 'bear-off',
    difficulty: 2,
    prompt: 'You rolled **4-1**. Take off two checkers.',
    position: { player1: { 5: 1, 4: 1, 1: 2 }, player2: { 20: 4 }, off: { player1: 11 } },
    dice: [4, 1],
    goal: { type: 'bear-off', count: 2 },
    solution: '4/off 1/off',
    explanation: 'Use both numbers exactly: 4/off and 1/off. Moving the 5-point checker wastes a die.',
  },
  {
    id: 'bear-5',
    category: 'bear-off',
    difficulty: 3,
    prompt: 'You rolled **5-2**. Bear off two checkers.',
    position: { player1: { 5: 1, 4: 2, 2: 1 }, player2: { 20: 4 }, off: { player1: 11 } },
    dice: [5, 2],
    goal: { type: 'bear-off', count: 2 },
    solution: '5/off 2/off',
    explanation: 'The 5 bears off exactly from the 5-point, and the 2 exactly from the 2-point.',
  },
];

const OPENING_REASONS: Record<string, string> = {
  '2-1': 'Slotting your 5-point (6/5) aims to make it next turn, while 13/11 adds a builder.',
  '3-1': 'Making your 5-point is the best possible start.',
  '4-1': 'Split your back checkers (24/23) and bring a builder down (13/9).',
  '5-1': 'Split the back checkers and play a safe 13/8.',
  '6-1': 'Make your bar point: a three-point wall from 6 to 8.',
  '3-2': 'Split to the 21-point and bring a builder to the 11-point.',
  '4-2': 'Make your 4-point: another strong home-board point.',
  '5-2': 'Bring two builders down from the mid-point.',
  '6-2': 'Step a back checker up to your opponent’s bar point and add a builder.',
  '4-3': 'Advance a back checker and bring a builder into play.',
  '5-3': 'Make your 3-point. It’s deep, but every home point counts.',
  '6-3': 'Advance a back checker to the 18-point and add a builder.',
  '5-4': 'Step a back checker to the 20-point and play 13/8 safely.',
  '6-4': 'Run a back checker to the 18-point and bring a builder to 9.',
  '6-5': 'The lover’s leap: one back checker escapes all the way to safety.',
};

/** One drill per non-double opening roll, built from the opening book. */
export const OPENING_DRILLS: TacticalDrill[] = Object.entries(OPENING_PLAYS)
  .filter(([key]) => key[0] !== key[2])
  .map(([key, play]) => {
    const [a, b] = key.split('-').map(Number) as [DieValue, DieValue];
    return {
      id: `opening-${key}`,
      category: 'opening' as const,
      difficulty: (['3-1', '4-2', '6-1', '6-5', '5-3'].includes(key) ? 1 : 2) as 1 | 2,
      prompt: `Opening roll: **${key}**. Play the standard move.`,
      position: START,
      dice: [a, b],
      goal: { type: 'plays', plays: [play] },
      solution: play,
      explanation: `${play}. ${OPENING_REASONS[key]}`,
      level: ['3-1', '4-2', '6-1', '5-3'].includes(key) ? 'point-makers' : 'every-roll',
    };
  });

export const ALL_MOVE_DRILLS: TacticalDrill[] = [...TACTICAL_DRILLS, ...OPENING_DRILLS];

export function drillsFor(category: DrillCategory): TacticalDrill[] {
  return ALL_MOVE_DRILLS.filter((drill) => drill.category === category);
}

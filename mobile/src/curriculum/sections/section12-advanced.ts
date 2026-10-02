import type { BoardSpec } from '@/game';

import { highlightPoint, quadrant } from '../builders';
import type { Section } from '../types';

/** Same checkers of yours; only their home board changes. */
const YOU = { 24: 2, 13: 4, 9: 1, 8: 3, 6: 5 };
const WEAK_BOARD: BoardSpec = { player1: YOU, player2: { 1: 1, 5: 1, 12: 4, 14: 1, 17: 3, 19: 5 } };
const STRONG_BOARD: BoardSpec = { player1: YOU, player2: { 1: 1, 5: 1, 12: 2, 17: 2, 19: 3, 20: 2, 21: 2, 22: 2 } };

/** They still hold your 1-point while you bear off. */
const ACE_ANCHOR = { 1: 2, 19: 3, 20: 3, 21: 3, 22: 2, 23: 2 };

export const ADVANCED_CUBE_POSITIONS = {
  /** Two of theirs on the bar against your closed board: a gammon most of the time. */
  closedOut: {
    player1: { 13: 1, 8: 1, 6: 3, 5: 2, 4: 2, 3: 2, 2: 2, 1: 2 },
    player2: { 12: 3, 17: 3, 19: 3, 20: 2, 21: 2 },
    bar: { player2: 2 },
  },
  /** One checker trapped behind a full prime: a big favorite, but few gammons. */
  fullPrime: {
    player1: { 13: 2, 9: 2, 8: 2, 7: 2, 6: 3, 5: 2, 4: 2 },
    player2: { 2: 1, 12: 3, 17: 2, 19: 3, 20: 3, 21: 3 },
  },
} satisfies Record<string, BoardSpec>;

export const advancedSection: Section = {
  id: 'advanced',
  title: 'Advanced Strategy',
  subtitle: 'Think like a strong player',
  icon: 'brain',
  color: '#FBBF24',
  goal: 'Make expert decisions in tricky positions.',
  lessons: [
    {
      id: 'advanced-1',
      sectionId: 'advanced',
      title: 'Bold or Safe?',
      description: 'Their home board decides how much risk to take.',
      icon: 'scale',
      difficulty: 4,
      category: 'strategy',
      passingScore: 0.6,
      xp: 35,
      objectives: [
        { id: 'distance', text: 'Know direct and indirect shots' },
        { id: 'board', text: 'Weigh the risk by their home board' },
        { id: 'choose', text: 'Choose between a bold and a safe play' },
      ],
      steps: [
        {
          id: 'distance',
          kind: 'explain',
          title: 'Distance matters',
          text: 'A blot **6 pips or closer** to their checker is hit about **1 time in 3**. From 7 pips or more, it’s usually **1 in 6** or less.',
        },
        {
          id: 'which-blot',
          kind: 'choice',
          prompt: 'You have to leave one blot. Where is it safer?',
          options: [
            {
              id: 'far',
              text: '8 pips away from their checker',
              correct: true,
              explanation: 'Right: from 8 pips away only 6 rolls hit. From 3 pips away, 14 rolls do.',
            },
            {
              id: 'near',
              text: '3 pips away from their checker',
              explanation: 'Every 3, plus 2-1 and 1-1: 14 rolls hit. From 8 pips away only 6 rolls do.',
            },
          ],
        },
        {
          id: 'risk',
          kind: 'explain',
          title: 'Count their board',
          text: 'Before leaving a blot, look at **their home board**. The more points they’ve made, the more a hit will cost you.',
          board: { position: STRONG_BOARD, highlights: [quadrant('player2-home', 'danger', 'Their board')] },
        },
        {
          id: 'bold',
          kind: 'move',
          prompt: 'Their board is **weak**: just one point. You rolled **3-2**. Find the bold play.',
          board: { position: WEAK_BOARD, dice: [3, 2], highlights: [quadrant('player2-home', 'success', 'Weak')] },
          goal: { type: 'plays', plays: ['24/22 8/5*', '13/11 8/5*'] },
          solution: '24/22 8/5*',
          correct: 'Bold and right. If they hit back, you’ll come in easily against their weak board.',
          wrong: 'Hit their blot on your 5-point with 8/5*. Getting hit back costs little against a weak board.',
          wrongPlays: [
            {
              plays: ['9/6 8/6'],
              text: 'Safe, but too timid. Their board is weak, so a return hit costs little. Hit: 8/5*.',
            },
          ],
          coachFeedback: true,
        },
        {
          id: 'safe',
          kind: 'move',
          prompt: 'Now their board is **strong**: four points. Same roll, **3-2**. Leave no blots.',
          board: { position: STRONG_BOARD, dice: [3, 2], highlights: [quadrant('player2-home', 'danger', 'Strong')] },
          goal: { type: 'safe' },
          solution: '9/6 8/6',
          correct: 'Wise. Against four made points, being hit could cost you the game.',
          wrong: 'Tidy up instead: 9/6 8/6 leaves no blots at all.',
          wrongPlays: [
            {
              plays: ['13/11 8/5*'],
              text: 'Against four made points, a return hit could cost you the game. Play safe: 9/6 8/6.',
            },
          ],
        },
        {
          id: 'rule',
          kind: 'choice',
          prompt: 'When can you best afford to leave a blot?',
          options: [
            {
              id: 'weak',
              text: 'When their home board is weak',
              correct: true,
              explanation: 'Right. If you’re hit, you’ll come back in quickly and lose little.',
            },
            {
              id: 'strong',
              text: 'When their home board is strong',
              explanation: 'That’s when a hit hurts most: you may be stuck on the bar for turns.',
            },
            {
              id: 'never',
              text: 'Never: blots are always bad',
              explanation: 'Blots are a risk, not a crime. Against a weak board, the risk is often worth it.',
            },
          ],
        },
      ],
    },
    {
      id: 'advanced-2',
      sectionId: 'advanced',
      title: 'Bearing Off Safely',
      description: 'Don’t let a won race slip away.',
      icon: 'shield-alert',
      difficulty: 4,
      category: 'bearing-off',
      passingScore: 0.6,
      xp: 35,
      objectives: [
        { id: 'danger', text: 'See the danger of an enemy anchor' },
        { id: 'safe', text: 'Bear off without leaving blots' },
        { id: 'even', text: 'Clear from the back, keep points even' },
      ],
      steps: [
        {
          id: 'danger',
          kind: 'explain',
          title: 'Contact at the end',
          text: 'They still hold your **1-point**. Any blot you leave can be hit, and one hit can turn a won race into a loss.',
          board: {
            position: { player1: { 6: 3, 5: 3, 4: 3, 3: 2, 2: 2 }, player2: ACE_ANCHOR, off: { player1: 2 } },
            highlights: [highlightPoint(1, 'danger', 'Their anchor')],
          },
        },
        {
          id: 'six-three',
          kind: 'move',
          prompt: 'You rolled **6-3**. Bear off **safely**: leave no blots.',
          board: {
            position: { player1: { 6: 3, 5: 3, 4: 3, 3: 2, 2: 2 }, player2: ACE_ANCHOR, off: { player1: 2 } },
            dice: [6, 3],
          },
          goal: { type: 'safe' },
          solution: '6/off 5/2',
          correct: 'Safe! One checker off instead of two is a small price for leaving no shots.',
          wrong: 'Bear one off from your 6-point, then play 5/2: every point keeps two or more checkers.',
          wrongPlays: [
            {
              plays: ['6/off 3/off'],
              text: 'Two off, but the lone checker on 3 can be hit from their anchor. 6/off 5/2 leaves no blots.',
            },
            {
              plays: ['6/off 6/3'],
              text: 'That leaves one checker alone on your 6-point. 6/off 5/2 keeps every point paired.',
            },
          ],
        },
        {
          id: 'even',
          kind: 'explain',
          title: 'Keep them even',
          text: 'Clear your points from the **back**, and keep an **even** number of checkers on the points you still hold.',
          board: {
            position: { player1: { 6: 4, 5: 2, 4: 2, 3: 2, 2: 2 }, player2: ACE_ANCHOR, off: { player1: 3 } },
            highlights: [highlightPoint(6, 'gold', 'Clear first')],
          },
        },
        {
          id: 'six-four',
          kind: 'move',
          prompt: 'You rolled **6-4**. Leave no blots.',
          board: {
            position: { player1: { 6: 4, 5: 2, 4: 2, 3: 2, 2: 2 }, player2: ACE_ANCHOR, off: { player1: 3 } },
            dice: [6, 4],
          },
          goal: { type: 'safe' },
          solution: '6/off 6/2',
          correct: 'Clean. Two checkers left on your 6-point, and not a single blot.',
          wrong: 'Take both numbers from your 6-point: 6/off with the 6 and 6/2 with the 4.',
          wrongPlays: [
            {
              plays: ['6/off 4/off'],
              text: 'Two off, but a lone checker now sits on your 4-point within reach of their anchor.',
            },
          ],
        },
        {
          id: 'why',
          kind: 'choice',
          prompt: 'You’re far ahead in the race. Why play safe instead of bearing off as fast as you can?',
          options: [
            {
              id: 'hit',
              text: 'A hit could cost you a game you’re winning',
              correct: true,
              explanation: 'Exactly. A hit sends a checker all the way back while they finish building their board.',
            },
            { id: 'rules', text: 'Bearing off fast is against the rules', explanation: 'It’s allowed, just risky while they hold a point in your home.' },
            { id: 'faster', text: 'Playing safe bears off faster', explanation: 'It’s usually a little slower. You trade a bit of speed for safety.' },
          ],
        },
      ],
    },
    {
      id: 'advanced-3',
      sectionId: 'advanced',
      title: 'Too Good to Double',
      description: 'When a gammon is worth more than a double.',
      icon: 'cards-playing-outline',
      difficulty: 5,
      category: 'cube',
      passingScore: 0.6,
      xp: 40,
      objectives: [
        { id: 'value', text: 'See how gammons change cube decisions' },
        { id: 'too-good', text: 'Play on when you’re too good to double' },
        { id: 'double', text: 'Double when gammons are unlikely' },
      ],
      steps: [
        {
          id: 'worth',
          kind: 'explain',
          title: 'Gammons change everything',
          text: 'A gammon is worth **2 points**. When you’ll win one often, your position is worth **more** than the 1 point a drop gives you.',
          board: { position: ADVANCED_CUBE_POSITIONS.closedOut, cube: { value: 1, owner: null } },
        },
        {
          id: 'too-good',
          kind: 'explain',
          title: 'Too good to double',
          text: 'So when a gammon is likely, **don’t double**: they’d simply drop. Play on and collect 2 points instead.',
          board: {
            position: ADVANCED_CUBE_POSITIONS.closedOut,
            cube: { value: 1, owner: null },
            highlights: [quadrant('player1-home', 'gold', 'Closed'), { region: { kind: 'bar' }, tone: 'danger' }],
          },
        },
        {
          id: 'closed-out',
          kind: 'cube',
          prompt: 'Two of their checkers are on the bar against your **closed board**. Do you double?',
          board: { position: ADVANCED_CUBE_POSITIONS.closedOut },
          decision: 'offer',
          answer: 'no-double',
          explanations: {
            'no-double': 'Right: you’re too good to double. You win a gammon most of the time, so play on for 2 points.',
            double: 'They’d happily drop and lose just 1 point. You win a gammon most of the time: play on!',
          },
        },
        {
          id: 'full-prime',
          kind: 'cube',
          prompt: 'One of their checkers is trapped behind your **full prime**. Do you double?',
          board: { position: ADVANCED_CUBE_POSITIONS.fullPrime },
          decision: 'offer',
          answer: 'double',
          explanations: {
            double: 'Yes. You win about 3 games in 4 but rarely a gammon: a classic double.',
            'no-double': 'You’re a big favorite but rarely win a gammon. That’s exactly when to double.',
          },
        },
        {
          id: 'rule',
          kind: 'choice',
          prompt: 'You expect to win a **gammon** more often than not. Should you double?',
          options: [
            { id: 'no', text: 'No: play on for the gammon', correct: true, explanation: 'Right. A double would let them drop for 1 point.' },
            { id: 'always', text: 'Yes: always double when far ahead', explanation: 'Not when a gammon is likely. They’d drop and save a point.' },
            { id: 'take', text: 'Yes: they might take', explanation: 'They won’t. A drop costs them 1 point instead of 2 or more.' },
          ],
        },
      ],
    },
  ],
};

import { highlightPoint, highlightPoints, START } from '../builders';
import type { Section } from '../types';

export const pointsSection: Section = {
  id: 'points',
  title: 'Blocking & Making Points',
  subtitle: 'Safety in numbers',
  icon: 'wall',
  color: '#B98CFF',
  goal: 'Make points to stay safe and block your opponent.',
  lessons: [
    {
      id: 'points-1',
      sectionId: 'points',
      title: 'Making Points',
      description: 'Two checkers together change everything.',
      icon: 'shield-half-full',
      difficulty: 2,
      category: 'positioning',
      passingScore: 0,
      xp: 20,
      objectives: [
        { id: 'make', text: 'Make a point with two checkers' },
        { id: 'five', text: 'See why the 5-point is so valuable' },
      ],
      steps: [
        {
          id: 'made',
          kind: 'explain',
          title: 'A made point',
          text: 'Two or more of your checkers on one point **make** that point. It’s safe, and it **blocks** your opponent.',
          board: {
            position: START,
            highlights: [highlightPoints([13, 8, 6], 'success')],
          },
        },
        {
          id: 'make-5',
          kind: 'move',
          prompt: 'You rolled **3-1**. Make your **5-point**.',
          board: { position: START, dice: [3, 1] },
          goal: { type: 'make-point', point: 5 },
          solution: '8/5 6/5',
          correct: 'That’s the best opening move in backgammon: you made the 5-point!',
          wrong: 'Bring two checkers to the 5-point: one from the 8-point (3) and one from the 6-point (1).',
          wrongPlays: [
            {
              plays: ['24/21 24/23', '24/20'],
              text: 'Running a back checker is fine, but here you can make a strong point instead. Look at your 5-point.',
            },
          ],
        },
        {
          id: 'why-5',
          kind: 'explain',
          title: 'The golden point',
          text: 'The **5-point** blocks your opponent’s back checkers and is a safe landing spot in your home board.',
          board: {
            position: {
              player1: { 24: 2, 13: 5, 8: 2, 6: 4, 5: 2 },
              player2: { 1: 2, 12: 5, 17: 3, 19: 5 },
            },
            highlights: [highlightPoint(5, 'gold', 'Your 5-point')],
          },
        },
        {
          id: 'make-7',
          kind: 'move',
          prompt: 'You rolled **6-1**. Make a point that blocks the dark back checkers.',
          board: { position: START, dice: [6, 1] },
          goal: { type: 'make-point', point: 7 },
          solution: '13/7 8/7',
          correct: 'You made your 7-point, the “bar point”. Now there’s a wall from 6 to 8.',
          wrong: 'Bring a checker from the 13-point (6) and one from the 8-point (1) together on the 7-point.',
        },
        {
          id: 'blocked-quiz',
          kind: 'choice',
          prompt: 'What does a made point do to your opponent?',
          options: [
            {
              id: 'block',
              text: 'They can’t land on it',
              correct: true,
              explanation: 'Right. Every point you make is one less place for your opponent to land.',
            },
            {
              id: 'pass',
              text: 'They can’t move past it',
              explanation: 'They can jump over a single point. Only six in a row (a prime) stops them completely.',
            },
            { id: 'nothing', text: 'Nothing, it only protects you', explanation: 'It also blocks: your opponent can’t land there.' },
          ],
        },
      ],
    },
    {
      id: 'points-2',
      sectionId: 'points',
      title: 'Safe or Risky?',
      description: 'Leave fewer targets for your opponent.',
      icon: 'shield-check',
      difficulty: 2,
      category: 'positioning',
      passingScore: 0.5,
      xp: 20,
      objectives: [
        { id: 'count', text: 'Count the blots you leave' },
        { id: 'safe', text: 'Find the safe play' },
      ],
      steps: [
        {
          id: 'targets',
          kind: 'explain',
          title: 'Every blot is a target',
          text: 'A blot within reach of your opponent’s checkers might get hit. The fewer blots you leave, the safer you are.',
          board: {
            position: { player1: { 13: 2, 9: 1, 8: 1, 6: 2 }, player2: { 19: 3, 17: 3, 12: 3, 1: 2 } },
            highlights: [highlightPoints([9, 8], 'danger', 'Blots')],
          },
        },
        {
          id: 'clean-up',
          kind: 'move',
          prompt: 'You rolled **3-2**. Play it so you leave **no blots** at all.',
          board: {
            position: { player1: { 13: 2, 9: 1, 8: 1, 6: 2 }, player2: { 19: 3, 17: 3, 12: 3, 1: 2 } },
            dice: [3, 2],
          },
          goal: { type: 'safe' },
          solution: '9/6 8/6',
          correct: 'Clean! Both blots joined the 6-point. Nothing for your opponent to hit.',
          wrong: 'That still leaves a blot. Can both loose checkers reach the same safe point?',
          wrongPlays: [
            {
              plays: ['13/10 13/11'],
              text: 'That breaks your 13-point and leaves four blots. Look for a move that gathers your loose checkers instead.',
            },
          ],
          hint: 'The 9-point is 3 away from the 6-point, and the 8-point is 2 away.',
        },
        {
          id: 'cover',
          kind: 'move',
          prompt: 'You rolled **4-1**. Cover your blot on the 5-point and stay safe.',
          board: {
            position: { player1: { 13: 2, 9: 3, 6: 3, 5: 1 }, player2: { 19: 3, 17: 3, 12: 3, 1: 2 } },
            dice: [4, 1],
          },
          goal: { type: 'safe' },
          solution: '9/5 6/5',
          correct: 'Covered! The 5-point is made and nothing is left loose.',
          wrong: 'A blot is still exposed. Bring a second checker onto the 5-point, and don’t leave a new blot behind.',
        },
        {
          id: 'which-safer',
          kind: 'choice',
          prompt: 'Your opponent’s checkers are close by. Which position is safer?',
          options: [
            {
              id: 'pairs',
              text: 'Checkers stacked in pairs on made points',
              correct: true,
              explanation: 'Yes. Made points can’t be hit.',
            },
            {
              id: 'spread',
              text: 'Checkers spread out one per point',
              explanation: 'Spreading out creates blots, and every blot can be hit.',
            },
          ],
        },
      ],
    },
    {
      id: 'points-3',
      sectionId: 'points',
      title: 'Walls & Primes',
      description: 'Points in a row trap your opponent.',
      icon: 'wall',
      difficulty: 3,
      category: 'positioning',
      passingScore: 0.5,
      xp: 20,
      objectives: [
        { id: 'wall', text: 'Build points next to each other' },
        { id: 'prime', text: 'Know what a prime is' },
      ],
      steps: [
        {
          id: 'wall',
          kind: 'explain',
          title: 'Walls',
          text: 'Made points **side by side** form a wall. The longer the wall, the harder it is to get past.',
          board: {
            position: { player1: { 8: 2, 7: 2, 6: 3, 5: 2, 13: 4 }, player2: { 2: 2, 19: 5, 17: 4 } },
            highlights: [highlightPoints([8, 7, 6, 5], 'gold', 'A 4-point wall')],
          },
        },
        {
          id: 'prime',
          kind: 'explain',
          title: 'The prime',
          text: '**Six points in a row** make a **prime**. Nothing can jump over it: those dark checkers are trapped!',
          board: {
            position: { player1: { 9: 2, 8: 2, 7: 2, 6: 3, 5: 2, 4: 2 }, player2: { 2: 2, 19: 5, 17: 4 } },
            highlights: [highlightPoints([9, 8, 7, 6, 5, 4], 'gold', 'Prime!')],
          },
        },
        {
          id: 'extend',
          kind: 'move',
          prompt: 'You rolled **6-3**. Make the **7-point** to lengthen your wall.',
          board: {
            position: { player1: { 13: 1, 10: 1, 9: 2, 8: 2, 6: 3, 5: 2, 4: 2 }, player2: { 2: 2, 19: 3, 17: 3 } },
            dice: [6, 3],
          },
          goal: { type: 'make-point', point: 7 },
          solution: '13/7 10/7',
          correct: 'Six points in a row, from 9 down to 4. That’s a full prime: the back checkers are stuck.',
          wrong: 'Bring two checkers to the 7-point: one from 13 (6 away) and one from 10 (3 away).',
        },
        {
          id: 'trapped',
          kind: 'choice',
          prompt: 'Can the dark checkers on your **2-point** escape this prime?',
          board: {
            position: { player1: { 9: 2, 8: 2, 7: 2, 6: 3, 5: 2, 4: 2 }, player2: { 2: 2, 19: 3, 17: 3 } },
            highlights: [highlightPoint(2, 'danger')],
          },
          options: [
            {
              id: 'no',
              text: 'No, not until the prime breaks',
              correct: true,
              explanation: 'Right. Six points in a row can’t be jumped: even a 6 lands on a blocked point.',
            },
            {
              id: 'six',
              text: 'Yes, with a 6',
              explanation: 'A 6 from the 2-point lands on the 8-point, which is blocked. Six in a row can’t be jumped.',
            },
          ],
        },
      ],
    },
  ],
};

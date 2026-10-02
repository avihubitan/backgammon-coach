import { highlightPoint, highlightPoints, pointTargets, quadrant, START } from '../builders';
import type { Section } from '../types';

/** A checker of theirs trapped on your 2-point, behind your growing wall. */
const PRIMING_THEM = { 2: 1, 12: 3, 17: 2, 19: 3, 20: 3, 21: 3 };

/** They have one checker on the bar and two blots in your home board. */
const BLITZ = {
  player1: { 13: 3, 10: 1, 8: 3, 7: 2, 6: 4, 5: 2 },
  player2: { 4: 1, 3: 1, 12: 3, 17: 3, 19: 5, 20: 1 },
  bar: { player2: 1 },
};

/** You hold their 5-point (your 20-point) and trail in the race. */
const HOLDING = {
  player1: { 20: 2, 13: 4, 8: 3, 7: 2, 6: 2, 4: 2 },
  player2: { 10: 2, 12: 3, 15: 2, 19: 3, 21: 3, 22: 2 },
};

export const middleGameSection: Section = {
  id: 'middle-game',
  title: 'The Middle Game',
  subtitle: 'Primes, blitzes and holding games',
  icon: 'sword-cross',
  color: '#2DD4BF',
  goal: 'Pick the right plan once the armies meet.',
  tier: 'premium',
  lessons: [
    {
      id: 'middle-1',
      sectionId: 'middle-game',
      title: 'The Priming Game',
      description: 'Trap a checker behind a wall.',
      icon: 'fence',
      difficulty: 3,
      category: 'strategy',
      passingScore: 0.6,
      xp: 30,
      objectives: [
        { id: 'extend', text: 'Extend your wall into a full prime' },
        { id: 'roll', text: 'Roll the prime forward' },
        { id: 'why', text: 'See why a trapped checker hurts them' },
      ],
      steps: [
        {
          id: 'plan',
          kind: 'explain',
          title: 'The priming game',
          text: 'Trap a checker behind a **wall** of points, then grow the wall into a full six-point **prime**.',
          board: {
            position: { player1: { 13: 3, 10: 1, 8: 2, 7: 2, 6: 3, 5: 2, 4: 2 }, player2: PRIMING_THEM },
            highlights: [highlightPoints([8, 7, 6, 5, 4], 'gold', 'Wall'), highlightPoint(2, 'danger', 'Trapped')],
          },
        },
        {
          id: 'extend',
          kind: 'move',
          prompt: 'You rolled **4-1**. Make the **9-point** for a full six-point prime.',
          board: {
            position: { player1: { 13: 3, 10: 1, 8: 2, 7: 2, 6: 3, 5: 2, 4: 2 }, player2: PRIMING_THEM },
            dice: [4, 1],
          },
          goal: { type: 'make-point', point: 9 },
          solution: '13/9 10/9',
          correct: 'Six points in a row, 9 down to 4: a full prime! Their checker can’t get past.',
          wrong: 'A 4 from the 13-point and a 1 from the 10-point both land on the 9-point.',
          wrongPlays: [
            {
              plays: ['13/9 6/5'],
              text: 'You started the 9-point but left blots on 9 and 10. Use the 1 to cover it: 13/9 10/9.',
            },
          ],
        },
        {
          id: 'rolling',
          kind: 'explain',
          title: 'Rolling the prime',
          text: 'Bring your prime home by making the point **in front** of it and releasing the back one. That’s **rolling** the prime.',
          board: {
            position: { player1: { 13: 2, 9: 2, 8: 2, 7: 2, 6: 3, 5: 2, 4: 2 }, player2: PRIMING_THEM },
            highlights: [highlightPoint(3, 'gold', 'Next'), highlightPoint(9, 'info', 'Release')],
          },
        },
        {
          id: 'roll',
          kind: 'move',
          prompt: 'You rolled **6-3**. Roll your prime forward: make the **3-point** and keep six points in a row.',
          board: {
            position: { player1: { 13: 2, 9: 2, 8: 2, 7: 2, 6: 3, 5: 2, 4: 2 }, player2: PRIMING_THEM },
            dice: [6, 3],
          },
          goal: { type: 'plays', plays: ['9/3 6/3'] },
          solution: '9/3 6/3',
          correct: 'The prime now runs from 8 to 3, right in front of their checker. The blot on 9 is out of their reach.',
          wrong: 'The 6 moves a checker from the 9-point to the 3-point, and the 3 brings your spare from the 6-point.',
          wrongPlays: [
            {
              plays: ['13/7 13/10'],
              text: 'A fine move too, but this lesson is about rolling the prime: 9/3 6/3 makes the 3-point.',
            },
          ],
        },
        {
          id: 'why',
          kind: 'choice',
          prompt: 'Why is a trapped checker such good news for you?',
          options: [
            {
              id: 'must-move',
              text: 'Their other checkers must do all the moving',
              correct: true,
              explanation: 'Right. Every roll they play with other checkers, so their position slowly falls apart.',
            },
            {
              id: 'skip',
              text: 'They skip their next turn',
              explanation: 'They still roll and move, just not that checker. That’s what wrecks their position.',
            },
            {
              id: 'off',
              text: 'It counts as one of your checkers borne off',
              explanation: 'No, but it’s still great: they must play every roll with their other checkers.',
            },
          ],
        },
      ],
    },
    {
      id: 'middle-2',
      sectionId: 'middle-game',
      title: 'The Blitz',
      description: 'Attack before they can anchor.',
      icon: 'lightning-bolt',
      difficulty: 4,
      category: 'strategy',
      passingScore: 0.6,
      xp: 30,
      objectives: [
        { id: 'attack', text: 'Know when to attack' },
        { id: 'double-hit', text: 'Hit two checkers at once' },
        { id: 'close', text: 'Close your board' },
      ],
      steps: [
        {
          id: 'blitz',
          kind: 'explain',
          title: 'The blitz',
          text: 'A **blitz** is an all-out attack: hit blots in your home board and make points before they can build an anchor.',
          board: {
            position: BLITZ,
            highlights: [highlightPoints([4, 3], 'danger', 'Targets'), { region: { kind: 'bar' }, tone: 'info' }],
          },
        },
        {
          id: 'double-hit',
          kind: 'move',
          prompt: 'You rolled **6-5**. Hit **both** blots in your home board.',
          board: { position: BLITZ, dice: [6, 5] },
          goal: { type: 'plays', plays: ['10/4* 8/3*'] },
          solution: '10/4* 8/3*',
          correct: 'Double hit! Three checkers on the bar, and every turn they spend entering is a turn they can’t build.',
          wrong: 'The 6 hits on 4 from the 10-point, and the 5 hits on 3 from the 8-point.',
          wrongPlays: [
            {
              plays: ['13/8 10/4*'],
              text: 'Safe, but gentle. In a blitz, two hits beat one: 10/4* 8/3*.',
            },
          ],
        },
        {
          id: 'closed',
          kind: 'explain',
          title: 'A closed board',
          text: 'Make all six home points and they **can’t enter** from the bar. A **closed board** leaves them stuck until you open it.',
          board: {
            position: {
              player1: { 8: 2, 6: 3, 5: 2, 4: 2, 3: 2, 2: 2, 1: 2 },
              player2: { 13: 3, 17: 3, 19: 4, 20: 2, 21: 2 },
              bar: { player2: 1 },
            },
            highlights: [quadrant('player1-home', 'gold', 'Closed')],
          },
        },
        {
          id: 'close-out',
          kind: 'move',
          prompt: 'You rolled **5-3**. Hit on your **3-point** and close your board.',
          board: {
            position: {
              player1: { 13: 2, 8: 2, 6: 3, 5: 2, 4: 2, 2: 2, 1: 2 },
              player2: { 3: 1, 14: 2, 17: 3, 19: 4, 21: 2, 22: 2 },
              bar: { player2: 1 },
            },
            dice: [5, 3],
          },
          goal: { type: 'make-point', point: 3 },
          solution: '8/3* 6/3',
          correct: 'Closed out! Two checkers on the bar and nowhere to enter. They can’t move until you open a point.',
          wrong: 'Bring a 5 from the 8-point and a 3 from the 6-point onto the 3-point, hitting as you land.',
          wrongPlays: [
            {
              plays: ['13/8 6/3*'],
              text: 'You hit, but left your own blot on the 3-point. Point on it instead: 8/3* 6/3.',
            },
          ],
        },
        {
          id: 'when',
          kind: 'choice',
          prompt: 'When is a blitz a good idea?',
          options: [
            {
              id: 'targets',
              text: 'They have blots in your home and you have builders nearby',
              correct: true,
              explanation: 'Right: targets to hit, and checkers ready to attack with.',
            },
            {
              id: 'anchor',
              text: 'When they already hold an anchor in your home',
              explanation: 'An anchor stops a blitz cold: they always have a safe place to land.',
            },
            {
              id: 'race',
              text: 'Whenever you’re behind in the race',
              explanation: 'The race matters less here. A blitz needs targets and builders.',
            },
          ],
        },
      ],
    },
    {
      id: 'middle-3',
      sectionId: 'middle-game',
      title: 'The Holding Game',
      description: 'Keep an anchor and wait for your shot.',
      icon: 'shield-sword',
      difficulty: 4,
      category: 'strategy',
      passingScore: 0.6,
      xp: 30,
      objectives: [
        { id: 'best', text: 'Know the best anchor' },
        { id: 'make', text: 'Make an advanced anchor' },
        { id: 'hold', text: 'Hold it while you wait for a shot' },
      ],
      steps: [
        {
          id: 'holding',
          kind: 'explain',
          title: 'The holding game',
          text: 'Behind in the race? Hold an **anchor** high in their home board. They must bring checkers past it, and **blots** appear.',
          board: { position: HOLDING, highlights: [highlightPoint(20, 'gold', 'Anchor')] },
        },
        {
          id: 'best-anchor',
          kind: 'tap',
          prompt: 'Tap the **best** point for an anchor in your opponent’s home board.',
          board: { position: START },
          answers: pointTargets(20),
          correct: 'Their 5-point, your 20-point. It blocks their best point and watches their outfield.',
          wrong: 'The best anchor is their 5-point: your 20-point. It’s the hardest point for them to lose.',
          wrongCases: [
            {
              targets: pointTargets(21),
              text: 'Their 4-point is a good anchor too, but their 5-point (your 20) is even better.',
            },
            {
              targets: pointTargets(24),
              text: 'An anchor on 24 is safe but so deep that you can easily get primed behind it.',
            },
          ],
        },
        {
          id: 'make-anchor',
          kind: 'move',
          prompt: 'You rolled **4-2**. Make the best anchor with your back checkers.',
          board: {
            position: {
              player1: { 24: 1, 22: 1, 13: 4, 8: 3, 6: 5, 5: 1 },
              player2: { 1: 2, 12: 4, 17: 4, 18: 2, 19: 3 },
            },
            dice: [4, 2],
          },
          goal: { type: 'make-point', point: 20 },
          solution: '24/20 22/20',
          correct: 'The golden anchor! Your back checkers are safe, and you’ll always have a place to land.',
          wrong: 'Move the checker on 24 by 4 and the one on 22 by 2: they meet on the 20-point.',
          wrongPlays: [
            {
              plays: ['8/4 6/4'],
              text: 'A nice home point, but your two back checkers stay open to attack. The anchor on 20 comes first.',
            },
          ],
        },
        {
          id: 'timing',
          kind: 'explain',
          title: 'Timing',
          text: 'Holding needs **timing**: spare checkers to move while you wait, so you never have to break your anchor.',
          board: { position: HOLDING, highlights: [highlightPoint(13, 'info', 'Spares'), highlightPoint(20, 'gold')] },
        },
        {
          id: 'hold',
          kind: 'move',
          prompt: 'You rolled **6-5**. Keep your anchor and leave **no blots**.',
          board: { position: HOLDING, dice: [6, 5] },
          goal: { type: 'safe' },
          solution: '13/7 13/8',
          correct: 'Patience pays. Your anchor stays, and their checkers still have to come past it.',
          wrong: 'Use your spare mid-point checkers: 13/7 13/8 keeps everything safe.',
          wrongPlays: [
            {
              plays: ['20/9'],
              text: 'Running breaks your anchor and leaves two blots. You’re behind: hold on and wait for a shot.',
            },
          ],
        },
        {
          id: 'behind',
          kind: 'choice',
          prompt: 'You’re **far behind** in the race. What should your back checkers do?',
          options: [
            {
              id: 'hold',
              text: 'Hold an anchor and wait for a shot',
              correct: true,
              explanation: 'Yes. A pure race is probably lost, so keep hitting chances alive.',
            },
            {
              id: 'run',
              text: 'Run home as fast as possible',
              explanation: 'Far behind, a race is likely lost. Holding an anchor keeps your chances.',
            },
            {
              id: 'blots',
              text: 'Split them up all over their board',
              explanation: 'Loose checkers just get attacked. Hold a safe anchor and wait.',
            },
          ],
        },
      ],
    },
  ],
};

import { highlightPoint, highlightPoints, pointTargets, quadrant, START } from '../builders';
import type { Section } from '../types';

/** Everyone home on their side: no contact left. */
const THEM_HOME = { 19: 3, 20: 3, 21: 3, 22: 3, 23: 3 };

/** Your last checker on their 6-point; you lead the race 83 to 105. */
const RUN = {
  player1: { 19: 1, 6: 4, 5: 4, 4: 3, 3: 2, 2: 1 },
  player2: { 12: 2, 14: 3, 16: 2, 20: 2, 21: 2, 22: 2, 23: 2 },
};

export const racingSection: Section = {
  id: 'racing',
  title: 'Racing & Pip Count',
  subtitle: 'Count the race, then run or wait',
  icon: 'run-fast',
  color: '#A3E635',
  goal: 'Know who’s ahead, and race home efficiently.',
  tier: 'premium',
  lessons: [
    {
      id: 'racing-1',
      sectionId: 'racing',
      title: 'Counting Pips',
      description: 'Measure the race in numbers.',
      icon: 'counter',
      difficulty: 3,
      category: 'racing',
      passingScore: 0.6,
      xp: 25,
      objectives: [
        { id: 'one', text: 'Count pips for one checker' },
        { id: 'all', text: 'Count a whole position' },
        { id: 'ahead', text: 'Tell who’s ahead in a race' },
      ],
      steps: [
        {
          id: 'pips',
          kind: 'explain',
          title: 'Pips',
          text: 'Each checker needs as many **pips** as its point number to bear off. This one on your 8-point needs **8**.',
          board: {
            position: { player1: { 8: 1 }, player2: { 20: 1, 22: 1 }, off: { player1: 14, player2: 13 } },
            highlights: [highlightPoint(8, 'gold', '8 pips')],
          },
        },
        {
          id: 'count',
          kind: 'explain',
          title: 'Your pip count',
          text: 'Add up all your checkers to get your **pip count**: how far you still have to go. At the start, both sides need **167**.',
          board: { position: START },
        },
        {
          id: 'count-small',
          kind: 'choice',
          prompt: 'What’s your pip count here?',
          board: {
            position: { player1: { 6: 2, 5: 1, 3: 1 }, player2: { 19: 2, 20: 2, 22: 1 }, off: { player1: 11, player2: 10 } },
          },
          options: [
            { id: '18', text: '18 pips', explanation: 'Count each checker: 6 + 6 + 5 + 3 = 20.' },
            { id: '20', text: '20 pips', correct: true, explanation: 'Right: 6 + 6 + 5 + 3 = 20 pips.' },
            { id: '22', text: '22 pips', explanation: 'Count each checker: 6 + 6 + 5 + 3 = 20.' },
          ],
        },
        {
          id: 'farthest',
          kind: 'tap',
          prompt: 'Tap the checker with the **longest** way home.',
          board: { position: { player1: { 13: 1, 9: 1, 6: 4, 5: 3, 4: 3, 3: 2, 2: 1 }, player2: THEM_HOME } },
          answers: pointTargets(13),
          correct: 'Right: 13 pips to go. Your stragglers are the checkers to bring home first.',
          wrong: 'Look for the checker farthest from home: the one on your 13-point.',
          wrongCases: [{ targets: pointTargets(9), text: 'That one needs 9 pips. One checker is even farther away, on 13.' }],
        },
        {
          id: 'who-leads',
          kind: 'choice',
          prompt: 'Count both sides. Who’s ahead in this race?',
          board: {
            position: {
              player1: { 6: 3, 5: 3, 4: 2, 3: 2 },
              player2: { 19: 3, 20: 3, 21: 3, 22: 3 },
              off: { player1: 5, player2: 3 },
            },
          },
          options: [
            { id: 'you', text: 'You', correct: true, explanation: 'Yes. You need 47 pips, they need 54. Lower is better in a race.' },
            { id: 'them', text: 'Your opponent', explanation: 'Count again: you need 47, they need 54. The lower count leads.' },
            { id: 'even', text: 'It’s exactly even', explanation: 'Not quite: you need 47 pips and they need 54.' },
          ],
        },
        {
          id: 'on-roll',
          kind: 'choice',
          prompt: 'Both players need **60 pips** and it’s your turn to roll. Who’s the favorite?',
          options: [
            {
              id: 'you',
              text: 'You, because you roll first',
              correct: true,
              explanation: 'Right. Rolling first is like a head start of about 4 pips.',
            },
            { id: 'even', text: 'Nobody: it’s exactly 50-50', explanation: 'Close, but rolling first is a head start worth about 4 pips.' },
            { id: 'them', text: 'Your opponent', explanation: 'The player who rolls first gets the head start: that’s you.' },
          ],
        },
      ],
    },
    {
      id: 'racing-2',
      sectionId: 'racing',
      title: 'Race or Fight?',
      description: 'Run when you’re ahead, wait when behind.',
      icon: 'arrow-decision-outline',
      difficulty: 3,
      category: 'racing',
      passingScore: 0.6,
      xp: 25,
      objectives: [
        { id: 'contact', text: 'Spot when the game becomes a race' },
        { id: 'run', text: 'Break contact when you’re ahead' },
      ],
      steps: [
        {
          id: 'race',
          kind: 'explain',
          title: 'A pure race',
          text: 'Once both armies have passed each other, there’s **no contact**. Nobody can hit: it’s a pure **race**.',
          board: {
            position: {
              player1: { 10: 2, 8: 3, 6: 3, 5: 3, 4: 2, 3: 2 },
              player2: { 13: 2, 15: 2, 19: 4, 20: 3, 21: 2, 22: 2 },
            },
            highlights: [quadrant('player1-home', 'info'), quadrant('player2-home', 'info')],
          },
        },
        {
          id: 'contact',
          kind: 'choice',
          prompt: 'Is this a pure race yet?',
          board: { position: RUN },
          options: [
            {
              id: 'no',
              text: 'Not yet',
              correct: true,
              explanation: 'Right. Your checker on 19 still has to get past their checkers on 12, 14 and 16.',
            },
            {
              id: 'yes',
              text: 'Yes, nobody can be hit',
              explanation: 'Your checker on 19 still has to pass their checkers on 12, 14 and 16, so hits can happen.',
            },
          ],
        },
        {
          id: 'plan',
          kind: 'explain',
          title: 'Run or wait?',
          text: 'Count first. **Ahead**? Break contact and race home. **Far behind**? Keep a checker back and hope for a shot.',
          board: { position: RUN, highlights: [highlightPoint(19, 'gold', 'Last one back')] },
        },
        {
          id: 'run',
          kind: 'move',
          prompt: 'You lead the race 83 to 105. You rolled **6-4**: get your last checker past their army.',
          board: { position: RUN, dice: [6, 4] },
          goal: { type: 'plays', plays: ['19/9'] },
          solution: '19/9',
          correct: 'Contact broken! It’s a pure race now, and you lead by 32 pips.',
          wrong: 'Run the checker on 19 all the way to 9: 6 and 4 together get it past their last checker.',
          wrongPlays: [
            {
              plays: ['19/13 6/2'],
              text: 'That leaves a blot right in front of their checkers. Run all the way: 19/9 breaks contact.',
            },
          ],
        },
        {
          id: 'ahead',
          kind: 'choice',
          prompt: 'You lead the race by **20 pips**, but one of your checkers is still back. What’s the plan?',
          options: [
            {
              id: 'run',
              text: 'Get it out and race home',
              correct: true,
              explanation: 'Yes. Ahead in the race, every hit is a risk you don’t need. Turn it into a race.',
            },
            {
              id: 'wait',
              text: 'Leave it there and wait for a shot',
              explanation: 'Waiting is for when you’re behind. Ahead, a pure race is what you want.',
            },
          ],
        },
      ],
    },
    {
      id: 'racing-3',
      sectionId: 'racing',
      title: 'Bearing In Smart',
      description: 'Bring them home without wasting pips.',
      icon: 'home-import-outline',
      difficulty: 3,
      category: 'racing',
      passingScore: 0.6,
      xp: 30,
      objectives: [
        { id: 'home', text: 'Bring stragglers home first' },
        { id: 'in-off', text: 'Come in and bear off in one roll' },
        { id: 'race', text: 'Win a bear-off race' },
      ],
      steps: [
        {
          id: 'bear-in',
          kind: 'explain',
          title: 'Bearing in',
          text: 'In a race, bring every checker **home** first. Land on your **6-, 5- and 4-points**: going deeper wastes pips.',
          board: {
            position: { player1: { 11: 1, 9: 1, 6: 3, 5: 3, 4: 3, 3: 2, 2: 2 }, player2: THEM_HOME },
            highlights: [highlightPoints([6, 5, 4], 'gold', 'Land here')],
          },
        },
        {
          id: 'cross-over',
          kind: 'move',
          prompt: 'You rolled **5-3**. Bring **both** outside checkers home.',
          board: { position: { player1: { 11: 1, 9: 1, 6: 3, 5: 3, 4: 3, 3: 2, 2: 2 }, player2: THEM_HOME }, dice: [5, 3] },
          goal: { type: 'plays', plays: ['11/6 9/6'] },
          solution: '11/6 9/6',
          correct: 'Both home, on your 6-point. Next turn you can start bearing off.',
          wrong: 'The 5 brings the checker on 11 to 6, and the 3 brings the checker on 9 to 6.',
          wrongPlays: [
            {
              plays: ['11/3'],
              text: 'One checker went deep and the other is still outside on 9. Bring both home: 11/6 9/6.',
            },
          ],
        },
        {
          id: 'in-and-off',
          kind: 'move',
          prompt: 'You rolled **4-2** with one checker left outside. Bring it home **and** bear one off.',
          board: { position: { player1: { 8: 1, 6: 3, 5: 3, 4: 3, 3: 2, 2: 3 }, player2: THEM_HOME }, dice: [4, 2] },
          goal: { type: 'plays', plays: ['8/4 2/off', '8/6 4/off'] },
          solution: '8/4 2/off',
          correct: 'In and off! One number brings the last checker home, the other takes one off.',
          wrong: 'Use one number to bring the checker on 8 home, then the other to bear a checker off.',
          wrongPlays: [
            {
              plays: ['8/2'],
              text: 'Home, but you spent both numbers on one checker. Come in with one and bear off with the other.',
            },
          ],
        },
        {
          id: 'race-home',
          kind: 'challenge',
          prompt: 'Bear off all **5 checkers** in **3 rolls**. Use one die to come in and the other to bear off!',
          board: { position: { player1: { 9: 1, 6: 1, 5: 1, 4: 1, 2: 1 }, player2: THEM_HOME, off: { player1: 10 } } },
          rolls: [
            [4, 3],
            [6, 2],
            [6, 5],
          ],
          goal: { type: 'bear-off-all' },
          success: 'All off in three rolls! Coming in with the 3 and bearing off with the 4 made it possible.',
          failure: 'Close! With 4-3, bring the 9 in with the 3 (9/6) and bear off from the 4-point with the 4.',
        },
      ],
    },
  ],
};

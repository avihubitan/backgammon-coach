import type { BoardSpec } from '@/game';

import { quadrant, START } from '../builders';
import type { Section } from '../types';

/**
 * Cube positions are checked against the trained network in
 * __tests__/cubeAnswers.test.ts, so every answer matches what the AI believes.
 */
export const CUBE_POSITIONS = {
  /** A 69 to 69 race with you on roll: about 59%. */
  evenRace: {
    player1: { 7: 2, 6: 3, 5: 3, 4: 3, 3: 2, 2: 2 },
    player2: { 18: 2, 19: 3, 20: 3, 21: 3, 22: 2, 23: 2 },
  },
  /** You need 69, they need 76, you're on roll: about 75%. */
  raceLead: {
    player1: { 7: 2, 6: 3, 5: 3, 4: 3, 3: 2, 2: 2 },
    player2: { 13: 1, 16: 1, 19: 3, 20: 3, 21: 3, 22: 2, 23: 2 },
  },
  /** Two of their checkers stuck behind your five-point prime. */
  primed: {
    player1: { 13: 3, 8: 3, 7: 2, 6: 3, 5: 2, 4: 2 },
    player2: { 1: 2, 12: 3, 17: 3, 19: 3, 20: 2, 21: 2 },
  },
  /** They lead 69 to 71 and are on roll: you still win about 35%. */
  closeRace: {
    player1: { 9: 1, 7: 1, 6: 3, 5: 3, 4: 3, 3: 2, 2: 2 },
    player2: { 18: 2, 19: 3, 20: 3, 21: 3, 22: 2, 23: 2 },
  },
  /** They need 57, you need 78: you win under 10%. */
  lostRace: {
    player1: { 12: 1, 11: 1, 6: 3, 5: 3, 4: 3, 3: 2, 2: 2 },
    player2: { 19: 3, 20: 3, 21: 3, 22: 2, 23: 2, 24: 2 },
  },
  /** You're on the bar against their closed board. */
  closedOut: {
    player1: { 13: 2, 8: 3, 6: 4, 5: 3, 4: 2 },
    player2: { 12: 3, 19: 2, 20: 2, 21: 2, 22: 2, 23: 2, 24: 2 },
    bar: { player1: 1 },
  },
} satisfies Record<string, BoardSpec>;

const OFFERED = { value: 2, owner: null };

export const cubeSection: Section = {
  id: 'cube',
  title: 'The Doubling Cube',
  subtitle: 'Raise the stakes at the right moment',
  icon: 'cube-outline',
  color: '#E879F9',
  goal: 'Double at the right time, and know when to take.',
  tier: 'premium',
  lessons: [
    {
      id: 'cube-1',
      sectionId: 'cube',
      title: 'Raising the Stakes',
      description: 'How the doubling cube works.',
      icon: 'numeric-2-box-multiple-outline',
      difficulty: 3,
      skill: 'cube',
      purpose: {
        outcome: 'Know what a double, a take and a drop mean, and score a cube game.',
        requires: ['rules'],
        shows: 'cube',
        decision: 'owner',
        inGame: 'In money games and matches, the cube can turn a good position into a quick win.',
      },
      passingScore: 0.6,
      xp: 25,
      objectives: [
        { id: 'double', text: 'Offer a double' },
        { id: 'respond', text: 'Know what a take and a drop mean' },
        { id: 'score', text: 'Score a game played with the cube' },
      ],
      steps: [
        {
          id: 'cube',
          kind: 'explain',
          title: 'The doubling cube',
          text: 'The **doubling cube** raises the stakes of a game. It starts in the middle: nobody owns it yet.',
          board: { position: START, cube: { value: 1, owner: null } },
        },
        {
          id: 'double',
          kind: 'explain',
          title: 'Doubling',
          text: 'Before you roll, you may **double**: offer to play on for **twice** the stakes.',
          board: { position: START, cube: OFFERED },
        },
        {
          id: 'drop',
          kind: 'choice',
          prompt: 'You double. Your opponent won’t play on for twice the stakes, so they **drop**. What happens?',
          options: [
            { id: '1', text: 'You win 1 point', correct: true, explanation: 'Right: a drop ends the game at once, for the current stake.' },
            { id: '2', text: 'You win 2 points', explanation: 'Only if they take and then lose. A drop costs them the current stake: 1 point.' },
            { id: 'on', text: 'The game goes on at 2', explanation: 'That’s what a take does. A drop ends the game right away.' },
          ],
        },
        {
          id: 'take-drop',
          kind: 'explain',
          title: 'Or they take',
          text: 'Instead of dropping, your opponent can **take**: the game goes on, now worth **2 points**.',
          board: { position: START, cube: { value: 2, owner: 'player2' } },
        },
        {
          id: 'owner',
          kind: 'choice',
          prompt: 'They **take** your double. Who can double next?',
          board: { position: START, cube: { value: 2, owner: 'player2' } },
          options: [
            { id: 'them', text: 'Only them: they own the cube', correct: true, explanation: 'Yes. Taking gives them the cube, so only they can double to 4.' },
            { id: 'you', text: 'Only you', explanation: 'You just used your double. Now they own the cube.' },
            { id: 'both', text: 'Either player', explanation: 'Once the cube has an owner, only that player can double.' },
          ],
        },
        {
          id: 'gammon',
          kind: 'choice',
          prompt: 'The cube is on **2** and you win a **gammon**. How many points do you score?',
          board: {
            position: { player2: { 19: 5, 20: 4, 22: 3, 15: 3 }, off: { player1: 15 } },
            cube: { value: 2, owner: 'player2' },
            highlights: [quadrant('player2-home', 'danger', 'Nothing off')],
          },
          options: [
            { id: '2', text: '2 points', explanation: 'A gammon counts double: 2 × 2 = 4 points.' },
            { id: '3', text: '3 points', explanation: 'Multiply: a gammon (×2) with the cube on 2 is 4 points.' },
            { id: '4', text: '4 points', correct: true, explanation: 'Right: the gammon doubles the cube value. 2 × 2 = 4.' },
          ],
        },
      ],
    },
    {
      id: 'cube-2',
      sectionId: 'cube',
      title: 'When to Double',
      description: 'Not too early, not too late.',
      icon: 'trending-up',
      difficulty: 4,
      skill: 'cube',
      purpose: {
        outcome: 'Double when you are a clear favourite, and not before.',
        requires: ['cube', 'pips'],
        shows: 'when',
        decision: 'race-lead',
        inGame: 'Double when you are clearly ahead but your opponent still has a reason to take.',
      },
      passingScore: 0.6,
      xp: 30,
      objectives: [
        { id: 'early', text: 'Don’t double without an edge' },
        { id: 'race', text: 'Use the race rule of thumb' },
        { id: 'strong', text: 'Double a strong position' },
      ],
      steps: [
        {
          id: 'when',
          kind: 'explain',
          title: 'When to double',
          text: 'Double when you’re a **clear favorite**, about 70% or more, before your lead grows so big that they’ll just drop.',
          tip: 'Double too early and you hand them the cube for nothing.',
          board: { position: CUBE_POSITIONS.primed, cube: { value: 1, owner: null } },
        },
        {
          id: 'start',
          kind: 'cube',
          prompt: 'The game has just started and it’s your turn. Do you double?',
          board: { position: START },
          decision: 'offer',
          answer: 'no-double',
          explanations: {
            'no-double': 'Right. At the start it’s about 50-50, so a double just hands over the cube.',
            double: 'Too early: nobody is a favorite yet. Doubling now just gives them the cube.',
          },
        },
        {
          id: 'race-rule',
          kind: 'explain',
          title: 'Racing rule of thumb',
          text: 'In a race, double when you’re on roll and lead by about **10%** of your pip count. Less than that: wait.',
          board: { position: CUBE_POSITIONS.raceLead, cube: { value: 1, owner: null } },
        },
        {
          id: 'even-race',
          kind: 'cube',
          prompt: 'A race: you both need **69 pips**, and you’re on roll. Do you double?',
          board: { position: CUBE_POSITIONS.evenRace },
          decision: 'offer',
          answer: 'no-double',
          explanations: {
            'no-double': 'Right. Rolling first helps, but you win only about 59%. Wait for a bigger lead.',
            double: 'Too soon: even on roll you win only about 59% here. Wait for a bigger lead.',
          },
        },
        {
          id: 'race-lead',
          kind: 'cube',
          prompt: 'A race: you need **69**, they need **76**, and you’re on roll. Do you double?',
          board: { position: CUBE_POSITIONS.raceLead },
          decision: 'offer',
          answer: 'double',
          explanations: {
            double: 'Yes! A 7-pip lead is about 10%, and you’re on roll: you win about 75%.',
            'no-double': 'Too timid. You lead by about 10% and win about 75%: time to double.',
          },
        },
        {
          id: 'primed',
          kind: 'cube',
          prompt: 'Two of their checkers are stuck behind your **five-point prime**. Do you double?',
          board: { position: CUBE_POSITIONS.primed },
          decision: 'offer',
          answer: 'double',
          explanations: {
            double: 'Yes. You win about 3 games in 4, and things can only get better for you.',
            'no-double': 'You’re a big favorite: about 3 wins in 4. If you wait, they may escape.',
          },
        },
      ],
    },
    {
      id: 'cube-3',
      sectionId: 'cube',
      title: 'Take or Drop',
      description: 'The 25% rule.',
      icon: 'scale-balance',
      difficulty: 4,
      skill: 'cube',
      purpose: {
        outcome: 'Take with at least one chance in four; drop with less.',
        requires: ['cube'],
        shows: 'quarter',
        decision: 'lost-race',
        inGame: 'Facing a double, ask: will I win at least one game in four from here?',
      },
      passingScore: 0.6,
      xp: 30,
      objectives: [
        { id: 'rule', text: 'Know the 25% rule' },
        { id: 'take', text: 'Take when you still have chances' },
        { id: 'drop', text: 'Drop when you’re far behind' },
      ],
      steps: [
        {
          id: 'quarter',
          kind: 'explain',
          title: 'The 25% rule',
          text: 'Facing a double? **Take** if you’ll win at least **1 game in 4** (25%). If not, **drop**.',
          board: { position: CUBE_POSITIONS.closeRace, cube: OFFERED },
        },
        {
          id: 'why',
          kind: 'explain',
          title: 'Why 25%?',
          text: 'Drop 4 times: you lose 4 points. Take 4 times and win once: −2 −2 −2 +2 = **−4**. The same, so 25% is the line.',
        },
        {
          id: 'take',
          kind: 'cube',
          prompt: 'They double. You need **71** pips, they need **69**, and they’re on roll. Take or drop?',
          board: { position: CUBE_POSITIONS.closeRace, cube: OFFERED },
          decision: 'respond',
          answer: 'take',
          explanations: {
            take: 'Take! You still win about 1 game in 3, well above the 25% you need.',
            drop: 'Too timid: you still win about 1 game in 3 here. That’s more than 25%, so take.',
          },
        },
        {
          id: 'lost-race',
          kind: 'cube',
          prompt: 'They double. You need **78** pips, they need only **57**. Take or drop?',
          board: { position: CUBE_POSITIONS.lostRace, cube: OFFERED },
          decision: 'respond',
          answer: 'drop',
          explanations: {
            drop: 'Right: 21 pips behind, you win less than 1 game in 10. Drop and save a point.',
            take: 'A costly take: you win less than 1 game in 10, far below the 25% you need.',
          },
        },
        {
          id: 'closed-out',
          kind: 'cube',
          prompt: 'They double. You’re on the bar against a **closed board**. Take or drop?',
          board: { position: CUBE_POSITIONS.closedOut, cube: OFFERED },
          decision: 'respond',
          answer: 'drop',
          explanations: {
            drop: 'Right. Stuck on the bar, you win less than 1 game in 10, and you could lose a gammon too.',
            take: 'You can’t even move until they open a point. Far below 25%: drop.',
          },
        },
        {
          id: 'least',
          kind: 'choice',
          prompt: 'What’s the smallest chance of winning that still makes a take right?',
          options: [
            { id: '10', text: '1 game in 10', explanation: 'Too low. You need to win at least 1 game in 4 to take.' },
            { id: '25', text: '1 game in 4', correct: true, explanation: 'Right: 25%. Below that, dropping costs you less.' },
            { id: '50', text: '1 game in 2', explanation: 'Much stricter than needed. Taking is right from 25%.' },
          ],
        },
      ],
    },
  ],
};

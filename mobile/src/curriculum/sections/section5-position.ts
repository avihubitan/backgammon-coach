import { highlightPoint, pointTargets, START } from '../builders';
import type { Section } from '../types';

export const positionSection: Section = {
  id: 'position',
  title: 'Building a Position',
  subtitle: 'Anchors, attacks and escapes',
  icon: 'chess-rook',
  color: '#5FD3E8',
  goal: 'Use simple plans to build a strong position.',
  lessons: [
    {
      id: 'position-1',
      sectionId: 'position',
      title: 'Anchors',
      description: 'A safe base in enemy territory.',
      icon: 'anchor',
      difficulty: 3,
      skill: 'anchors',
      purpose: {
        outcome: 'Recognise an anchor and make one with your back checkers.',
        requires: ['points'],
        shows: 'what',
        decision: 'make',
        inGame: 'When your back checkers can land together in their home board, an anchor keeps them safe.',
      },
      passingScore: 0.5,
      xp: 20,
      objectives: [
        { id: 'what', text: 'Know what an anchor is' },
        { id: 'make', text: 'Make an anchor with your back checkers' },
      ],
      steps: [
        {
          id: 'what',
          kind: 'explain',
          title: 'Anchors',
          text: 'A point you hold in your **opponent’s home board** is an **anchor**. It keeps your back checkers safe.',
          board: {
            position: { player1: { 20: 2, 13: 5, 8: 3, 6: 5 }, player2: { 1: 2, 12: 5, 17: 3, 19: 5 } },
            highlights: [highlightPoint(20, 'gold', 'Anchor')],
          },
        },
        {
          id: 'tap-anchor',
          kind: 'tap',
          prompt: 'Tap your **anchor**.',
          board: { position: { player1: { 24: 1, 21: 2, 13: 4, 8: 3, 6: 5 }, player2: { 1: 2, 12: 4, 17: 3, 19: 4, 20: 2 } } },
          answers: pointTargets(21),
          correct: 'Yes: two of your checkers on their 4-point. Nothing can hit them there.',
          wrong: 'An anchor is two or more of your checkers in **their** home board, top right.',
          wrongCases: [
            { targets: pointTargets(24), text: 'That checker is alone: a blot, not an anchor. An anchor needs two.' },
            { targets: pointTargets(13, 8, 6), text: 'Those points are on your side of the board. An anchor sits in their home board.' },
          ],
        },
        {
          id: 'make',
          kind: 'move',
          prompt: 'You rolled **3-2**. Make an anchor with your two back checkers.',
          board: {
            position: {
              player1: { 24: 1, 22: 1, 13: 5, 8: 3, 6: 5 },
              player2: { 1: 2, 12: 4, 17: 3, 18: 2, 19: 4 },
            },
            dice: [3, 2],
          },
          goal: { type: 'make-point', point: 22 },
          solution: '24/22 13/10',
          correct: 'Anchored! Your back checkers are safe, and they always have a place to land.',
          wrong: 'Your back checkers are on the 24- and 22-points. Which number brings one onto the other?',
        },
        {
          id: 'better-anchor',
          kind: 'choice',
          prompt: 'Your back checkers start as an anchor on the **24-point**. Where would an anchor serve them better?',
          board: {
            position: START,
            highlights: [highlightPoint(24, 'info', 'Now'), highlightPoint(20, 'gold', 'Higher')],
          },
          options: [
            {
              id: 'twenty',
              text: 'Higher up, on the 20-point',
              correct: true,
              explanation: 'Yes. From the 20-point your checkers are closer to escaping, and you hold their best point.',
            },
            {
              id: 'stay',
              text: 'The 24-point is best: it’s furthest from danger',
              explanation: 'It’s safe, but deep. They can build points in front of it and trap your checkers there.',
            },
          ],
        },
        {
          id: 'why',
          kind: 'choice',
          prompt: 'Why is an anchor so useful?',
          options: [
            {
              id: 'safe',
              text: 'Back checkers are safe and have a landing spot',
              correct: true,
              explanation: 'Yes. They can’t be hit there, and if another checker is hit it has a safe place to enter.',
            },
            {
              id: 'win',
              text: 'It counts as a checker borne off',
              explanation: 'Not at all. It’s about safety: anchored checkers can’t be hit.',
            },
            {
              id: 'block-all',
              text: 'It stops your opponent from moving',
              explanation: 'It blocks one point, but its main job is keeping your back checkers safe.',
            },
          ],
        },
      ],
    },
    {
      id: 'position-2',
      sectionId: 'position',
      title: 'Attack & Escape',
      description: 'Pointing on blots and running to safety.',
      icon: 'sword-cross',
      difficulty: 3,
      skill: 'hitting',
      alsoTrains: ['escaping'],
      purpose: {
        outcome: 'Hit and make the point in one move, and run a back checker to safety.',
        requires: ['hitting', 'points', 'primes'],
        shows: 'pointing',
        decision: 'point-on-5',
        inGame: 'A blot in your home board is a target: hit it with two checkers when you can.',
      },
      passingScore: 0.5,
      xp: 25,
      objectives: [
        { id: 'point-on', text: 'Hit and make a point at the same time' },
        { id: 'run', text: 'Escape a back checker' },
      ],
      steps: [
        {
          id: 'pointing',
          kind: 'explain',
          title: 'Pointing on a blot',
          text: 'The strongest hit uses **two checkers**: you hit the blot **and** make the point, so you can’t be hit back.',
          board: {
            position: {
              player1: { 24: 2, 13: 5, 8: 3, 6: 5 },
              player2: { 1: 1, 5: 1, 12: 5, 17: 3, 19: 5 },
            },
            highlights: [highlightPoint(5, 'danger', 'Their blot')],
          },
        },
        {
          id: 'point-on-5',
          kind: 'move',
          prompt: 'You rolled **3-1**. Hit the blot on your 5-point **and** make the point.',
          board: {
            position: {
              player1: { 24: 2, 13: 5, 8: 3, 6: 5 },
              player2: { 1: 1, 5: 1, 12: 5, 17: 3, 19: 5 },
            },
            dice: [3, 1],
          },
          goal: { type: 'plays', plays: ['8/5* 6/5'] },
          solution: '8/5* 6/5',
          correct: 'Powerful! The dark checker is on the bar and your 5-point is made: your opponent can’t hit back there.',
          wrong: 'Hit with one checker and land a second one on the same point: the 8 (3 away) and the 6 (1 away).',
          wrongPlays: [
            {
              plays: ['6/5* 24/21'],
              text: 'You hit, but left your own checker alone on the 5-point. Bring a second checker there too.',
            },
          ],
        },
        {
          id: 'escape',
          kind: 'explain',
          title: 'Escape!',
          text: 'Back checkers can get trapped behind your opponent’s points. Running one out early can be wise.',
          board: {
            position: START,
            highlights: [highlightPoint(24, 'gold', 'Back checkers')],
          },
        },
        {
          id: 'run-6-5',
          kind: 'move',
          skill: 'escaping',
          prompt: 'You rolled **6-5**. Run one back checker all the way to safety.',
          board: { position: START, dice: [6, 5] },
          goal: { type: 'plays', plays: ['24/13'] },
          solution: '24/13',
          correct: 'The classic “lover’s leap”: one back checker escapes to your mid-point, safe and sound.',
          wrong: 'Move one back checker from the 24-point 6, then 5 more: it lands safely on the 13-point.',
        },
        {
          id: 'which-hit',
          kind: 'choice',
          prompt: 'You can hit a blot with **one** checker or **point on it** with two. Which is usually better?',
          options: [
            {
              id: 'two',
              text: 'Point on it with two',
              correct: true,
              explanation: 'Yes. You get the hit and a made point: no blot left for your opponent to hit back.',
            },
            {
              id: 'one',
              text: 'Hit with one checker',
              explanation: 'That leaves your own blot where it can be hit straight back. Two checkers are safer.',
            },
          ],
        },
      ],
    },
  ],
};

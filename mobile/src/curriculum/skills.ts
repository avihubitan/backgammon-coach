import type { IconName } from '@/components/ui/Icon';

/**
 * The skills a backgammon player builds, as data. Lessons say which skill
 * each exercise trains, drills train one skill each, and the coach files
 * every mistake in a game under one, so lessons, practice, games and
 * recommendations all speak the same language.
 *
 * Kept small on purpose: each skill has a lesson that teaches it, practice
 * that repeats it, and something in a game that shows whether it stuck.
 */
export type SkillId =
  | 'board'
  | 'rules'
  | 'hitting'
  | 'shots'
  | 'safety'
  | 'points'
  | 'primes'
  | 'anchors'
  | 'escaping'
  | 'pips'
  | 'racing'
  | 'bear-off'
  | 'openings'
  | 'plans'
  | 'cube';

export type SkillGroupId = 'fundamentals' | 'tactical' | 'positional' | 'racing' | 'strategic' | 'cube';

export interface SkillDefinition {
  id: SkillId;
  group: SkillGroupId;
  title: string;
  /** What being good at it looks like, in one line. */
  summary: string;
  /** The skill as something you do, for sentences: "You practised {doing} in …". */
  doing: string;
  icon: IconName;
  /** The question this skill answers when you look at a position, if it's one to ask before every move. */
  question?: string;
  /** Skills that have to come first: the curriculum tests check that lessons teach them in this order. */
  requires: SkillId[];
}

export interface SkillGroup {
  id: SkillGroupId;
  title: string;
  skills: SkillId[];
}

const define = (skills: SkillDefinition[]) => Object.fromEntries(skills.map((skill) => [skill.id, skill])) as Record<SkillId, SkillDefinition>;

/** In the order a learner meets them. */
export const SKILLS: Record<SkillId, SkillDefinition> = define([
  {
    id: 'board',
    group: 'fundamentals',
    title: 'Reading the board',
    summary: 'Find any point, both home boards and the bar at a glance.',
    doing: 'reading the board',
    icon: 'checkerboard',
    requires: [],
  },
  {
    id: 'rules',
    group: 'fundamentals',
    title: 'Moves & rules',
    summary: 'Play every roll legally: both dice, doubles, the bar and scoring.',
    doing: 'moving by the rules',
    icon: 'dice-multiple',
    requires: ['board'],
  },
  {
    id: 'hitting',
    group: 'tactical',
    title: 'Hitting',
    summary: 'Spot blots and hit them when it helps.',
    doing: 'hitting blots',
    icon: 'target',
    question: 'Can I hit?',
    requires: ['rules'],
  },
  {
    id: 'shots',
    group: 'tactical',
    title: 'Counting shots',
    summary: 'Know how many rolls hit a blot before you leave it.',
    doing: 'counting shots',
    icon: 'crosshairs-question',
    question: 'How many shots will my opponent have?',
    requires: ['hitting'],
  },
  {
    id: 'safety',
    group: 'tactical',
    title: 'Playing safe',
    summary: 'Leave as few shots as you can when a hit would hurt.',
    doing: 'playing safe',
    icon: 'shield-check',
    question: 'Do I have blots, and can they be hit?',
    requires: ['hitting'],
  },
  {
    id: 'points',
    group: 'positional',
    title: 'Making points',
    summary: 'Make the points that matter, starting with your 5-point.',
    doing: 'making points',
    icon: 'wall',
    question: 'Can I make a point?',
    requires: ['rules'],
  },
  {
    id: 'primes',
    group: 'positional',
    title: 'Walls & primes',
    summary: 'Build walls of points that trap your opponent’s checkers.',
    doing: 'building walls',
    icon: 'fence',
    question: 'Is anyone trapped behind a wall?',
    requires: ['points'],
  },
  {
    id: 'anchors',
    group: 'positional',
    title: 'Anchors',
    summary: 'Hold a safe point in your opponent’s home board.',
    doing: 'making anchors',
    icon: 'anchor',
    question: 'Do I have an anchor?',
    requires: ['points'],
  },
  {
    id: 'escaping',
    group: 'positional',
    title: 'Escaping',
    summary: 'Bring your back checkers out before a wall shuts them in.',
    doing: 'running your back checkers',
    icon: 'run-fast',
    question: 'Are my back checkers getting trapped?',
    requires: ['primes'],
  },
  {
    id: 'pips',
    group: 'racing',
    title: 'Pip counting',
    summary: 'Count the race and know who is ahead.',
    doing: 'counting the race',
    icon: 'counter',
    question: 'Who leads the race?',
    requires: ['rules'],
  },
  {
    id: 'racing',
    group: 'racing',
    title: 'Racing',
    summary: 'Know when it’s a race, and race home without wasting pips.',
    doing: 'racing home',
    icon: 'speedometer',
    question: 'Is this a race or a fight?',
    requires: ['pips'],
  },
  {
    id: 'bear-off',
    group: 'racing',
    title: 'Bearing off',
    summary: 'Take checkers off fast, and safely while there’s contact.',
    doing: 'bearing off',
    icon: 'home-export-outline',
    requires: ['rules'],
  },
  {
    id: 'openings',
    group: 'strategic',
    title: 'Openings',
    summary: 'Play a strong first move with any roll.',
    doing: 'opening moves',
    icon: 'book-open-page-variant',
    requires: ['points', 'hitting'],
  },
  {
    id: 'plans',
    group: 'strategic',
    title: 'Game plans',
    summary: 'Pick a plan that fits the position: race, prime, blitz or hold.',
    doing: 'choosing a plan',
    icon: 'strategy',
    question: 'What is my plan?',
    requires: ['primes', 'anchors', 'hitting'],
  },
  {
    id: 'cube',
    group: 'cube',
    title: 'Doubling cube',
    summary: 'Double with a clear edge, and take when you still have chances.',
    doing: 'using the cube',
    icon: 'cube-outline',
    requires: ['rules'],
  },
]);

export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

export const SKILL_GROUPS: SkillGroup[] = [
  { id: 'fundamentals', title: 'Fundamentals', skills: ['board', 'rules'] },
  { id: 'tactical', title: 'Tactics', skills: ['hitting', 'shots', 'safety'] },
  { id: 'positional', title: 'Position', skills: ['points', 'primes', 'anchors', 'escaping'] },
  { id: 'racing', title: 'Racing', skills: ['pips', 'racing', 'bear-off'] },
  { id: 'strategic', title: 'Strategy', skills: ['openings', 'plans'] },
  { id: 'cube', title: 'The cube', skills: ['cube'] },
];

export const isSkillId = (value: unknown): value is SkillId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(SKILLS, value);

export const skillTitle = (skill: SkillId): string => SKILLS[skill].title;

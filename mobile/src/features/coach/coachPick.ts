import type { IconName } from '@/components/ui/Icon';
import { getLesson, SKILL_IDS, SKILLS, type SkillId } from '@/curriculum';
import { getDrillCategory, type DrillCategory } from '@/curriculum/drills';
import { dayKey, daysBetween, type LessonRecords } from '@/features/learning/progression';
import type { SkillStats } from '@/features/learning/progressModel';
import { DRILL_MINUTES, lessonMinutes, POSITION_MINUTES, reviewMinutes } from '@/features/learning/timeEstimates';
import { dueMistakes, isMastered, pickForPractice, type UserMistake } from '@/features/practice/mistakes';
import { skillRows } from '@/features/profile/profileStats';
import { skillOfMistake, trainingFor } from '@/features/skills/extract';
import type { PracticeKind } from '@/state/practiceStore';

/**
 * The coach's suggestions for what to work on next, from what the player
 * actually did, best first:
 *  1. positions from their games that are due for review (Premium),
 *  2. patterns in their games, recent ones first,
 *  3. a drill that just opened and hasn't been tried,
 *  4. a skill their latest answers show is slipping,
 *  5. their weakest skill overall,
 *  6. a skill they haven't practised in a while.
 * Pure, so the rules are testable; the Home card only renders the result.
 */

export type CoachAction =
  | { kind: 'mistakes' }
  /** One of the player's own positions ("mistake:<id>") about `skill`, free: for a weakness nothing else trains yet. */
  | { kind: 'position'; position: string; skill: SkillId }
  | { kind: 'drill'; drill: DrillCategory }
  | { kind: 'lesson'; lessonId: string };

/** Why the coach picked something. */
export type CoachTrigger = 'review' | 'pattern' | 'new-drill' | 'slipping' | 'weak-skill' | 'fading';

export interface CoachPick {
  /** What to work on, in plain words (one pick per topic). */
  topic: string;
  /** The card's headline: "Let’s work on playing safe." */
  title: string;
  /** Why the coach picked it, citing the evidence. */
  reason: string;
  action: CoachAction;
  actionLabel: string;
  icon: IconName;
  /** The pick needs Premium (only ever practising your own mistakes). */
  premium: boolean;
  /** About how long it takes. */
  minutes: number;
  trigger: CoachTrigger;
}

/** Open mistakes of one kind before the coach calls it a pattern. */
export const PATTERN_THRESHOLD = 3;
/** Mistakes from games in this many days count as "recent", and recent patterns come first. */
export const RECENT_DAYS = 21;
/** A drill counts as new for this many days after the lesson that opens it. */
export const NEW_DRILL_DAYS = 3;
/** A skill is slipping when this many of its latest answers hold less than this share right first time. */
export const SLIPPING = { answers: 6, share: 0.6 };
/** A skill practised on two days or more, but not for this many days, is fading. */
export const FADING_DAYS = 10;

export interface CoachInput {
  mistakes: UserMistake[];
  bySkill: Partial<Record<SkillId, SkillStats>>;
  lessons: LessonRecords;
  unlockedDrills: DrillCategory[];
  canPracticeMistakes: boolean;
  canAccessLesson: (lessonId: string) => boolean;
  /** Today (YYYY-MM-DD): recent mistakes weigh more, and a pick practised today counts as done. */
  today?: string;
  /** When each kind of practice was last played (ISO timestamps). */
  practiced?: Partial<Record<PracticeKind, { lastPlayedAt: string | null }>>;
  /** Today's Position of the Day ("mistake:<id>"), so the pick offers a different position. */
  dailyPosition?: string | null;
}

type Training = Pick<CoachPick, 'action' | 'actionLabel' | 'minutes'>;

/** How to train a skill: its drill if the player has unlocked it, else a replay of a lesson they've done. */
function train(skill: SkillId, input: CoachInput): Training | null {
  const { drill, lesson } = trainingFor(skill);
  if (drill && input.unlockedDrills.includes(drill)) {
    return { action: { kind: 'drill', drill }, actionLabel: 'Start the drill', minutes: DRILL_MINUTES };
  }
  // Only suggest lessons the player has reached and can open.
  const lessonOpen = !!lesson && !!input.lessons[lesson.id]?.completed && input.canAccessLesson(lesson.id);
  if (lesson && lessonOpen) {
    return { action: { kind: 'lesson', lessonId: lesson.id }, actionLabel: 'Replay the lesson', minutes: lessonMinutes(lesson) };
  }
  return null;
}

/** A pick about one skill, trained the usual way (null when there's nothing open to train it with). */
function skillPick(skill: SkillId, input: CoachInput, trigger: CoachTrigger, title: string, reason: string): CoachPick | null {
  const training = train(skill, input);
  if (!training) return null;
  return { topic: SKILLS[skill].title, title, reason, ...training, icon: SKILLS[skill].icon, premium: false, trigger };
}

const workOn = (skill: SkillId) => `Let’s work on ${SKILLS[skill].title.toLowerCase()}.`;

/**
 * One of the player's own positions about `skill`, when no drill or finished
 * lesson trains it yet (a beginner's first games): practising the position
 * teaches the idea, free.
 */
function positionPick(skill: SkillId, mistakes: UserMistake[], reason: string, input: CoachInput): CoachPick | null {
  const about = mistakes.filter((mistake) => skillOfMistake(mistake) === skill);
  const ordered = input.today ? pickForPractice(about, about.length, input.today) : about;
  // Not the one Position of the Day already shows.
  const next = ordered.find((mistake) => `mistake:${mistake.id}` !== input.dailyPosition);
  if (!next) return null;
  return {
    topic: SKILLS[skill].title,
    title: workOn(skill),
    reason,
    action: { kind: 'position', position: `mistake:${next.id}`, skill },
    actionLabel: 'Practise one of them',
    icon: SKILLS[skill].icon,
    premium: false,
    minutes: POSITION_MINUTES,
    trigger: 'pattern',
  };
}

/** Positions from the player's games that spaced repetition says are due today. */
function reviewPicks(input: CoachInput): CoachPick[] {
  if (!input.canPracticeMistakes || !input.today) return [];
  const due = dueMistakes(input.mistakes, input.today).length;
  if (due === 0) return [];
  const what = due === 1 ? 'A position you got wrong in a game is' : `${due} positions you got wrong in your games are`;
  return [
    {
      topic: 'Your review',
      title: 'Time for your review.',
      reason: `${what} due today. Finding the better move again is what makes it stick.`,
      action: { kind: 'mistakes' },
      actionLabel: 'Start the review',
      icon: 'history',
      premium: true,
      minutes: reviewMinutes(due),
      trigger: 'review',
    },
  ];
}

const countBySkill = (mistakes: UserMistake[]) => {
  const counts = new Map<SkillId, number>();
  for (const mistake of mistakes) {
    const skill = skillOfMistake(mistake);
    counts.set(skill, (counts.get(skill) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count >= PATTERN_THRESHOLD).sort((a, b) => b[1] - a[1]);
};

/** Patterns in the player's games: recent games first, then all of them. */
function patternPicks(input: CoachInput, reviewing: boolean): CoachPick[] {
  const open = input.mistakes.filter((mistake) => !isMastered(mistake));
  const today = input.today;
  const recent = today
    ? open.filter((mistake) => {
        const day = mistake.createdAt ? dayKey(new Date(mistake.createdAt)) : null;
        return !!day && daysBetween(day, today) <= RECENT_DAYS;
      })
    : [];
  let patterns = countBySkill(recent);
  let games = 'your recent games';
  let source = recent;
  if (patterns.length === 0) {
    patterns = countBySkill(open);
    games = 'your games';
    source = open;
  }
  return patterns.flatMap(([skill, count], index): CoachPick[] => {
    const topic = SKILLS[skill].title;
    const reason = `${count} of the moves the coach flagged in ${games} were about ${topic.toLowerCase()}.`;
    // Premium practises the actual positions (one pick for all of them), unless the review already does.
    if (input.canPracticeMistakes && index === 0 && !reviewing) {
      return [
        {
          topic,
          title: workOn(skill),
          reason,
          action: { kind: 'mistakes' },
          actionLabel: 'Practise those positions',
          icon: SKILLS[skill].icon,
          premium: true,
          minutes: reviewMinutes(count),
          trigger: 'pattern',
        },
      ];
    }
    const pick = skillPick(skill, input, 'pattern', workOn(skill), reason) ?? positionPick(skill, source, reason, input);
    return pick ? [pick] : [];
  });
}

const ago = (days: number) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`);

/** Drills that opened in the last few days and haven't been tried: practice while the lesson is fresh. */
function newDrillPicks(input: CoachInput): CoachPick[] {
  const today = input.today;
  if (!today) return [];
  return input.unlockedDrills
    .flatMap((drill) => {
      const info = getDrillCategory(drill);
      const learned = info ? input.lessons[info.requiresLesson]?.firstCompletedAt : null;
      const lesson = info ? getLesson(info.requiresLesson) : undefined;
      if (!info || !learned || !lesson || input.practiced?.[drill]?.lastPlayedAt) return [];
      const days = daysBetween(learned, today);
      if (days < 0 || days > NEW_DRILL_DAYS) return [];
      const pick: CoachPick = {
        topic: info.title,
        title: `New drill: “${info.title}”.`,
        reason: `It opened when you finished “${lesson.title}” ${ago(days)}. A few quick positions now help it stick.`,
        action: { kind: 'drill', drill },
        actionLabel: 'Try the drill',
        icon: SKILLS[info.skill].icon,
        premium: false,
        minutes: DRILL_MINUTES,
        trigger: 'new-drill',
      };
      return [{ days, pick }];
    })
    .sort((a, b) => a.days - b.days)
    .map(({ pick }) => pick);
}

/** Skills whose latest answers are mostly wrong, even if they used to go well. */
function slippingPicks(input: CoachInput): CoachPick[] {
  return SKILL_IDS.flatMap((skill) => {
    const recent = input.bySkill[skill]?.recent ?? '';
    if (recent.length < SLIPPING.answers) return [];
    const right = [...recent].filter((answer) => answer === '1').length;
    if (right / recent.length >= SLIPPING.share) return [];
    const reason = `Only ${right} of your last ${recent.length} answers about ${SKILLS[skill].title.toLowerCase()} were right on the first try.`;
    const pick = skillPick(skill, input, 'slipping', workOn(skill), reason);
    return pick ? [{ share: right / recent.length, pick }] : [];
  })
    .sort((a, b) => a.share - b.share)
    .map(({ pick }) => pick);
}

/** Weak skills over everything the player has answered, weakest first. */
function weakPicks(input: CoachInput): CoachPick[] {
  return skillRows(input.bySkill)
    .filter((row) => row.attempted >= 5 && row.accuracy < 0.8)
    .sort((a, b) => a.accuracy - b.accuracy)
    .flatMap((row): CoachPick[] => {
      const reason = `You get ${Math.round(row.accuracy * 100)}% of ${row.label.toLowerCase()} exercises right on the first try, your lowest score.`;
      const pick = skillPick(row.id, input, 'weak-skill', workOn(row.id), reason);
      return pick ? [pick] : [];
    });
}

/** Skills practised on a few days but not lately, longest gap first. The fundamentals come up in every game. */
function fadingPicks(input: CoachInput): CoachPick[] {
  const today = input.today;
  if (!today) return [];
  return SKILL_IDS.flatMap((skill) => {
    const stats = input.bySkill[skill];
    if (SKILLS[skill].group === 'fundamentals' || !stats?.lastDay || stats.days < 2) return [];
    const gap = daysBetween(stats.lastDay, today);
    if (gap < FADING_DAYS) return [];
    const { doing } = SKILLS[skill];
    const reason = `It’s been ${gap} days since you practised ${doing}. A quick round keeps it sharp.`;
    const pick = skillPick(skill, input, 'fading', `A refresher: ${doing}.`, reason);
    return pick ? [{ gap, pick }] : [];
  })
    .sort((a, b) => b.gap - a.gap)
    .map(({ pick }) => pick);
}

const actionKey = (action: CoachAction) =>
  action.kind === 'mistakes'
    ? 'mistakes'
    : action.kind === 'position'
      ? `position:${action.position}`
      : action.kind === 'drill'
        ? `drill:${action.drill}`
        : `lesson:${action.lessonId}`;

/** Everything worth working on, best first, one pick per topic and action. */
export function coachPicks(input: CoachInput): CoachPick[] {
  const review = reviewPicks(input);
  const seen = new Set<string>();
  return [
    ...review,
    ...patternPicks(input, review.length > 0),
    ...newDrillPicks(input),
    ...slippingPicks(input),
    ...weakPicks(input),
    ...fadingPicks(input),
  ].filter((pick) => {
    const keys = [`topic:${pick.topic}`, actionKey(pick.action)];
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
}

export function coachPick(input: CoachInput): CoachPick | null {
  return coachPicks(input)[0] ?? null;
}

/** The drill the coach would send the player to first, if any: the daily challenge leans on it. */
export function focusDrill(input: CoachInput): DrillCategory | null {
  const pick = coachPicks(input).find((candidate) => candidate.action.kind === 'drill');
  return pick?.action.kind === 'drill' ? pick.action.drill : null;
}

/** The pick was already practised today. */
export function doneToday(action: CoachAction, input: CoachInput): boolean {
  if (!input.today) return false;
  if (action.kind === 'lesson') return input.lessons[action.lessonId]?.lastPlayedAt === input.today;
  if (action.kind === 'position') {
    // A position about the same idea, practised today (from here, the result sheet or the review).
    return input.mistakes.some(
      (mistake) =>
        skillOfMistake(mistake) === action.skill &&
        !!mistake.lastPracticedAt &&
        dayKey(new Date(mistake.lastPracticedAt)) === input.today,
    );
  }
  const kind: PracticeKind = action.kind === 'drill' ? action.drill : action.kind;
  const last = input.practiced?.[kind]?.lastPlayedAt;
  return !!last && dayKey(new Date(last)) === input.today;
}

/** Other suggestions shown under the pick. */
export const MORE_PICKS = 2;

export interface CoachPlan {
  pick: CoachPick;
  /** Practised today: the card says so, and offers what's next. */
  done: boolean;
  next: CoachPick | null;
  /** A couple more suggestions not yet done today, for "Also for you". */
  more: CoachPick[];
}

/** Today's pick, whether it's done, and what else is worth doing. */
export function coachPlan(input: CoachInput): CoachPlan | null {
  const picks = coachPicks(input);
  const [pick] = picks;
  if (!pick) return null;
  const done = doneToday(pick.action, input);
  const open = picks.slice(1).filter((other) => !doneToday(other.action, input));
  return { pick, done, next: done ? (open[0] ?? null) : null, more: open.slice(done ? 1 : 0, (done ? 1 : 0) + MORE_PICKS) };
}

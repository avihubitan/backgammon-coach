import { applyMove, checkersAt, type BoardState, type CheckerMove, type Player } from '@/game';

import {
  checkerCenterOnBar,
  checkerCenterOnPoint,
  computeMetrics,
  slabRectInTray,
  type BoardMetrics,
  type Point2D,
} from './geometry';
import { stackKey, stackSizes, type PlacedChecker } from './layout';

/**
 * Turns a layout change into choreography: which checkers fly where, when,
 * how high, where hits land, and when to play sounds. Pure, so the timing
 * rules are testable without rendering anything.
 */

export type MotionKind = 'move' | 'hit' | 'bearoff';

export interface Motion {
  kind: MotionKind;
  /** ms to wait before taking off (hit checkers wait for the hitter to land). */
  delay: number;
  duration: number;
  /** Extra scale at the top of the flight: how "high" the checker is lifted. */
  hop: number;
  /** Start here instead of the old spot: a checker dropped by the player settles from the finger. */
  from?: Point2D;
  /** This checker lands on a blot and knocks it off: it comes down a little harder. */
  hits?: boolean;
}

/** A checker the player just dragged and released at `at`. */
export interface DropInfo {
  player: Player;
  at: Point2D;
}

/** How long a dropped checker takes to settle into its spot. */
export const SETTLE_MS = 170;

export interface Impact {
  id: string;
  at: Point2D;
  /** ms after the update when the hitter lands. */
  delay: number;
  /** The player whose checker was hit. */
  victim: Player;
}

export type SoundCueKind = 'place' | 'hit' | 'bearoff';

export interface SoundCue {
  at: number;
  kind: SoundCueKind;
  /** Whose checker it is: the player's own landings are felt as well as heard. */
  player: Player;
  /** A hit checker landing on the bar: heard, never felt (the hit already was). */
  knocked?: boolean;
}

/** A checker reaching the bear-off tray, for a small glint where it lands. */
export interface Glint {
  id: string;
  at: Point2D;
  delay: number;
}

export interface MotionPlan {
  motions: Record<string, Motion>;
  impacts: Impact[];
  /** Checkers borne off, in landing order. */
  glints: Glint[];
  cues: SoundCue[];
  /**
   * Stacks a checker is about to land on (by stack key): their checkers close
   * up this many ms after the update, as it comes down, not while it's far away.
   */
  respace: Record<string, number>;
  /** When everything has settled, in ms. */
  totalMs: number;
}

export const EMPTY_PLAN: MotionPlan = { motions: {}, impacts: [], glints: [], cues: [], respace: {}, totalMs: 0 };

/** How long a dice throw takes; the face settles at about 70%. */
export const DICE_THROW_MS = 640;
/** When a thrown die has landed and can be read. */
export const DICE_SETTLE_MS = Math.round(DICE_THROW_MS * 0.7);

/** Several checkers moving at once take off one after another. */
export const STAGGER_MS = 90;

/** How high checkers are lifted (extra scale at the top of the flight). */
export const HOP = { move: 0.16, bearoff: 0.2, hit: 0.24, drop: 0.16 } as const;

/** A hit checker's flight to the bar is a touch longer than a plain move: it was knocked there. */
export const KNOCK_EXTRA_MS = 60;

/** A stack makes room for an arriving checker this long before it lands. */
export const RESPACE_LEAD_MS = 90;

export function checkerCenter(m: BoardMetrics, checker: PlacedChecker, sizes: Map<string, number>): Point2D {
  const count = sizes.get(stackKey(checker)) ?? 1;
  if (checker.location.kind === 'point') {
    return checkerCenterOnPoint(m, checker.location.point, checker.index, count);
  }
  if (checker.location.kind === 'bar') return checkerCenterOnBar(m, checker.player, checker.index, count);
  const slab = slabRectInTray(m, checker.player, checker.index);
  return { x: slab.x + slab.width / 2, y: slab.y + slab.height / 2 };
}

/** Longer trips take a little longer, but never feel sluggish. */
export function flightDuration(distance: number, m: BoardMetrics): number {
  return Math.round(Math.min(MAX_FLIGHT_MS, Math.max(220, 200 + (distance / m.width) * 380)));
}

const MAX_FLIGHT_MS = 420;

/**
 * Time between the hops of a multi-step move (one die after another): long
 * enough for any flight to land before the next one takes off. `hopDelays`
 * times each hop by its real length instead.
 */
export const MOVE_STEP_MS = MAX_FLIGHT_MS + 20;

export function planMotions(
  previous: readonly PlacedChecker[],
  next: readonly PlacedChecker[],
  m: BoardMetrics,
  updateId: number | string,
  drop?: DropInfo,
): MotionPlan {
  const before = new Map(previous.map((checker) => [checker.id, checker]));
  const previousSizes = stackSizes(previous);
  const nextSizes = stackSizes(next);
  const motions: Record<string, Motion> = {};
  const impacts: Impact[] = [];
  const cues: SoundCue[] = [];

  const moved = next
    .filter((checker) => checker.moved && before.has(checker.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const isVictim = (checker: PlacedChecker) => {
    const old = before.get(checker.id);
    return checker.location.kind === 'bar' && old?.location.kind === 'point';
  };

  // Movers first: they set the clock for any hits.
  const arrivals = new Map<string, number>();
  const respace: Record<string, number> = {};
  const arriveAt = (checker: PlacedChecker, at: number) => {
    if (checker.location.kind === 'off') return;
    const key = stackKey(checker);
    respace[key] = Math.max(respace[key] ?? 0, at - RESPACE_LEAD_MS, 0);
    if (checker.location.kind === 'point') {
      const point = `${checker.location.point}`;
      arrivals.set(point, Math.max(arrivals.get(point) ?? 0, at));
    }
  };
  const staggerByPlayer = new Map<Player, number>();
  let dropUsed = false;
  for (const checker of moved) {
    if (isVictim(checker)) continue;
    const old = before.get(checker.id)!;
    const kind: MotionKind = checker.location.kind === 'off' ? 'bearoff' : 'move';
    if (drop && !dropUsed && checker.player === drop.player) {
      // The player carried this one: it comes down from where it was released, as high as it was held.
      dropUsed = true;
      motions[checker.id] = { kind, delay: 0, duration: SETTLE_MS, hop: HOP.drop, from: drop.at };
      arriveAt(checker, SETTLE_MS);
      continue;
    }
    const from = checkerCenter(m, old, previousSizes);
    const to = checkerCenter(m, checker, nextSizes);
    const order = staggerByPlayer.get(checker.player) ?? 0;
    staggerByPlayer.set(checker.player, order + 1);
    const delay = order * STAGGER_MS;
    const duration = flightDuration(Math.hypot(to.x - from.x, to.y - from.y), m);
    motions[checker.id] = { kind, delay, duration, hop: kind === 'bearoff' ? HOP.bearoff : HOP.move };
    arriveAt(checker, delay + duration);
  }

  // A hit checker sits until the hitter comes down on it, then is knocked off to the bar.
  const hitPoints = new Set<string>();
  for (const checker of moved) {
    if (!isVictim(checker)) continue;
    const old = before.get(checker.id)!;
    const point = old.location.kind === 'point' ? old.location.point : 0;
    const from = checkerCenter(m, old, previousSizes);
    const to = checkerCenter(m, checker, nextSizes);
    const landing = arrivals.get(`${point}`);
    const delay = landing ?? 0;
    const duration = flightDuration(Math.hypot(to.x - from.x, to.y - from.y), m) + KNOCK_EXTRA_MS;
    motions[checker.id] = { kind: 'hit', delay, duration, hop: HOP.hit };
    arriveAt(checker, delay + duration);
    if (landing !== undefined) {
      impacts.push({ id: `${updateId}:${checker.id}`, at: from, delay: landing, victim: checker.player });
      hitPoints.add(`${point}`);
    }
    cues.push({ at: delay + duration, kind: 'place', player: checker.player, knocked: true });
  }
  // The hitters come down hard on the blot.
  for (const checker of moved) {
    const motion = motions[checker.id];
    if (motion && motion.kind === 'move' && checker.location.kind === 'point' && hitPoints.has(`${checker.location.point}`)) {
      motion.hits = true;
    }
  }

  const glints: Glint[] = [];
  for (const checker of moved) {
    const motion = motions[checker.id];
    if (!motion || motion.kind === 'hit') continue;
    const at = motion.delay + motion.duration;
    if (motion.kind === 'bearoff') {
      glints.push({ id: `${updateId}:${checker.id}`, at: checkerCenter(m, checker, nextSizes), delay: at });
    }
    const landedOnHit = checker.location.kind === 'point' && hitPoints.has(`${checker.location.point}`);
    cues.push({ at, kind: motion.kind === 'bearoff' ? 'bearoff' : landedOnHit ? 'hit' : 'place', player: checker.player });
  }
  cues.sort((a, b) => a.at - b.at);

  const totalMs = Object.values(motions).reduce((max, motion) => Math.max(max, motion.delay + motion.duration), 0);
  return { motions, impacts, glints, cues, respace, totalMs };
}

/** Flight times don't depend on the board's size (they scale with distance / width), so one reference board does. */
const REFERENCE = computeMetrics(390);

/** The pause on each intermediate point of a multi-step move: it visibly lands before going on. */
export const HOP_REST_MS = 70;

/**
 * When each step of a multi-step move should start (ms after the first), so
 * every hop lands and rests a moment before the next one takes off: short hops
 * go quickly, long ones get the time they need. Mirrors planMotions' distances.
 */
export function hopDelays(board: BoardState, player: Player, moves: readonly CheckerMove[]): number[] {
  const m = REFERENCE;
  const delays: number[] = [];
  let at = 0;
  let current = board;
  for (const move of moves) {
    delays.push(at);
    const leaving = move.from === 'bar' ? current.bar[player] : checkersAt(current, move.from, player);
    const start =
      move.from === 'bar'
        ? checkerCenterOnBar(m, player, Math.max(0, leaving - 1), Math.max(1, leaving))
        : checkerCenterOnPoint(m, move.from, Math.max(0, leaving - 1), Math.max(1, leaving));
    let end: Point2D;
    if (move.to === 'off') {
      const slab = slabRectInTray(m, player, current.off[player]);
      end = { x: slab.x + slab.width / 2, y: slab.y + slab.height / 2 };
    } else {
      const landing = checkersAt(current, move.to, player);
      end = checkerCenterOnPoint(m, move.to, landing, landing + 1);
    }
    at += flightDuration(Math.hypot(end.x - start.x, end.y - start.y), m) + HOP_REST_MS;
    current = applyMove(current, player, move);
  }
  return delays;
}

/** Collapses cues that land within `windowMs` of each other (the loudest kind wins). */
export function mergeCues(cues: readonly SoundCue[], windowMs = 45): SoundCue[] {
  const rank: Record<SoundCueKind, number> = { hit: 3, bearoff: 2, place: 1 };
  const merged: SoundCue[] = [];
  for (const cue of [...cues].sort((a, b) => a.at - b.at)) {
    const last = merged[merged.length - 1];
    if (last && cue.at - last.at < windowMs) {
      if (rank[cue.kind] > rank[last.kind]) merged[merged.length - 1] = { ...cue, at: last.at };
      continue;
    }
    merged.push({ ...cue });
  }
  return merged;
}

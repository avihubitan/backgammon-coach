# Learning system audit

Phase A of the learning milestone: an audit of the curriculum and of everything
around it (practice, daily challenge, Coach's Pick, mistakes, game review, skill
statistics, XP). Taken at commit `b6f9b13`, before any learning changes. Nothing
in the app was modified for this audit.

The question behind it: **does each thing the app teaches get practised,
measured, and used in a real game?**

## What exists

| Part | How it works today |
| --- | --- |
| Curriculum | 12 sections, 38 lessons, 205 steps (127 scored). Step kinds: explain 73, move 53, choice 40, tap 23, cube 9, demo 5, challenge 2. Pure data, validated by `curriculum.test.ts`. |
| Lesson engine | First try = 1, solved after a mistake = 0.5, revealed = 0. Stars at 65% and 90%. Each lesson has a pass mark. |
| Skill tags | Each lesson has **one** `category` (10 values). Every scored step in it is credited to that category. |
| Skill statistics | `stats.byCategory`: first-try counts **from lessons only**. Profile shows them once a skill has 3 answers. |
| Practice drills | 6 categories: hitting (6 hand-made positions), safety (5), points (5), bear-off (5), opening (15, one per opening roll), race (generated pip questions). Each unlocks when a whole section is finished. A session is 5 items. |
| Mistakes | Mistakes and blunders from reviewed games are saved (max 100). Practice orders them least recently practised, then most costly. A position is "mastered" after 2 correct answers. **Premium only.** |
| Game review | Every move is graded (best / fine / inaccuracy / mistake / blunder) and mistakes get a category (opening, hitting, positioning, running, racing, bearing-off, cube, risk) and a headline. |
| Coach Watch | Before a mistake is confirmed, it gives a clue keyed by the review headline. Free players get 3 checks per game. |
| Coach's Pick | (1) 3+ open mistakes in one category, recent games first; (2) a lesson skill with 5+ answers under 80%. Routes to a drill, a lesson replay, or (Premium) mistake practice. |
| Daily challenge | One of 12 challenges per day, picked by a hash of the date among the available ones. |
| XP | 10 per first-try exercise, 5 after a mistake, half on replays and in practice, plus a lesson bonus and a perfect bonus. Revealed answers earn nothing. |

## Map: section → lesson → skill → exercise → outcome → practice → game

"Skill" shows today's lesson category and, after the arrow, the skill the lesson
really trains (see the taxonomy at the end). "Practice" is what exists outside
replaying the lesson. "In games" is how the coach notices the skill in a real
game.

**1 · Meet the Board (free)**

| Lesson | Skill | Scored exercises | Outcome | Practice | In games |
| --- | --- | --- | --- | --- | --- |
| board-1 What is Backgammon? | board → board | choice, tap | Knows the goal and which checkers are theirs | none | none |
| board-2 The 24 Points | board → board | 4 taps | Finds any point by its number | none | none |
| board-3 Your Checkers | board → board | 2 taps, choice | Tells their checkers from the opponent's | none | none |
| board-4 Home Board & the Bar | board → board | 3 taps | Finds both home boards and the bar | none | none |
| board-5 Which Way to Move | movement → rules | choice, 2 moves, tap | Moves the right way and counts spaces | none | rules enforced |
| board-6 Setting Up the Board | board → board | 4 taps, choice | Sets up the starting position | none | none |

**2 · Moving Checkers (free)**

| Lesson | Skill | Scored exercises | Outcome | Practice | In games |
| --- | --- | --- | --- | --- | --- |
| moving-1 Rolling the Dice | movement → rules | 3 moves, choice | Plays each die as its own move | none | rules enforced |
| moving-2 Doubles | movement → rules | 2 moves, choice | Plays a double four times | none | rules enforced |
| moving-3 Open & Blocked Points | movement → rules | choice, tap, move | Sees which points are blocked | none | rules enforced |
| moving-4 Using Every Roll | movement → rules | 2 moves, choice | Plays the whole roll, or the larger die | none | rules enforced |

**3 · Hitting (free)**

| Lesson | Skill | Scored exercises | Outcome | Practice | In games |
| --- | --- | --- | --- | --- | --- |
| hitting-1 Blots | hitting → hitting | 2 taps, choice | Spots blots on both sides | Find the hit | "You missed a hit" |
| hitting-2 Hitting | hitting → hitting | 2 moves, choice | Hits with one die or both | Find the hit | "You missed a hit", "Keep the pressure on" |
| hitting-3 Entering from the Bar | hitting → rules | 2 moves, choice, tap | Enters before anything else | 1 drill position | rules enforced |

**4 · Blocking & Making Points (free)**

| Lesson | Skill | Scored exercises | Outcome | Practice | In games |
| --- | --- | --- | --- | --- | --- |
| points-1 Making Points | positioning → points | 2 moves, choice | Makes a point; values the 5-point | Make points | "You could make a point" |
| points-2 Safe or Risky? | positioning → safety | 2 moves, choice | Finds the play that leaves no blots | Play it safe | "You had a safer option" |
| points-3 Walls & Primes | positioning → primes | move, choice | Knows a prime traps checkers | none | none |

**5 · Building a Position (free)**

| Lesson | Skill | Scored exercises | Outcome | Practice | In games |
| --- | --- | --- | --- | --- | --- |
| position-1 Anchors | positioning → anchors | move, choice | Makes an anchor with the back checkers | 1 drill position | "An anchor was available" |
| position-2 Attack & Escape | strategy → hitting, escaping | 2 moves, choice | Points on a blot; runs a back checker | 1 drill position | "Get your back checkers moving" |

**6 · Bearing Off (free)**

| Lesson | Skill | Scored exercises | Outcome | Practice | In games |
| --- | --- | --- | --- | --- | --- |
| bearoff-1 Coming Home | bearing-off → bear-off | choice, move | Knows when bearing off may start | Bear-off speed | "You could bear off more" |
| bearoff-2 Taking Checkers Off | bearing-off → bear-off | 2 moves | Bears off with exact numbers | Bear-off speed | same |
| bearoff-3 Bigger Numbers | bearing-off → bear-off | 2 moves, challenge | Uses big numbers from the highest point | Bear-off speed | same |

**7 · Winning Games (free)**

| Lesson | Skill | Scored exercises | Outcome | Practice | In games |
| --- | --- | --- | --- | --- | --- |
| winning-1 Gammons & Backgammons | scoring → rules | 3 choices | Scores a single, gammon and backgammon | none | result screen |
| winning-2 Rules Checkpoint | movement → rules, hitting, bear-off | tap, 3 moves, choice | Combines every rule | none | none |

**8 · Opening Moves (free)**

| Lesson | Skill | Scored exercises | Outcome | Practice | In games |
| --- | --- | --- | --- | --- | --- |
| openings-1 Point-Making Rolls | opening → openings, points | 2 moves, tap, choice | Makes a point with 3-1, 4-2, 6-1, 5-3 | Opening moves | "opening" mistakes |
| openings-2 Split or Build | opening → openings | choice, 2 moves, choice | Chooses between running, splitting and building | Opening moves | "opening" mistakes |
| openings-3 Opening Quiz | opening → openings | 6 moves | Plays a strong move for any opening roll | Opening moves | "opening" mistakes |

**9 · The Middle Game (Premium; middle-1 is a free preview)**

| Lesson | Skill | Scored exercises | Outcome | Practice | In games |
| --- | --- | --- | --- | --- | --- |
| middle-1 The Priming Game | strategy → primes, plans | 2 moves, choice | Completes and rolls a prime | none | none |
| middle-2 The Blitz | strategy → plans, hitting | 2 moves, choice | Attacks with double hits; closes the board | none | "Keep the pressure on" |
| middle-3 The Holding Game | strategy → anchors, plans | tap, 2 moves, choice | Picks the best anchor and keeps it | none | "An anchor was available" |

**10 · Racing & Pip Count (Premium; racing-1 is a free preview)**

| Lesson | Skill | Scored exercises | Outcome | Practice | In games |
| --- | --- | --- | --- | --- | --- |
| racing-1 Counting Pips | racing → pips | 3 choices, tap | Counts pips and tells who is ahead | Who's ahead? (unlocks **before** this lesson) | none |
| racing-2 Race or Fight? | racing → racing | 2 choices, move | Recognises a race; breaks contact when ahead | none | "Race more efficiently" |
| racing-3 Bearing In Smart | racing → racing, bear-off | 2 moves, challenge | Brings checkers in without waste | Bear-off speed (partly) | "Race more efficiently" |

**11 · The Doubling Cube (Premium; cube-1 is a free preview)**

| Lesson | Skill | Scored exercises | Outcome | Practice | In games |
| --- | --- | --- | --- | --- | --- |
| cube-1 Raising the Stakes | cube → cube | 3 choices | Knows double, take, drop and cube scoring | none | cube review (cube games) |
| cube-2 When to Double | cube → cube | 4 cube decisions | Doubles with a clear edge | none | cube review |
| cube-3 Take or Drop | cube → cube | 3 cube decisions, choice | Uses the 25% rule | none | cube review |

**12 · Advanced Strategy (Premium; advanced-1 is a free preview)**

| Lesson | Skill | Scored exercises | Outcome | Practice | In games |
| --- | --- | --- | --- | --- | --- |
| advanced-1 Bold or Safe? | strategy → shots, plans | 2 choices, 2 moves | Weighs a shot against the opponent's board | none | "You had a safer option" |
| advanced-2 Bearing Off Safely | bearing-off → bear-off, safety | 2 moves, choice | Bears off against contact without shots | none | bear-off and risk mistakes |
| advanced-3 Too Good to Double | cube → cube | 2 cube decisions, choice | Plays on for the gammon | none | cube review |

## Findings

### 1. Duplicated concepts

- The opening roll rule is taught twice, both times as an explanation: moving-1
  ("The first roll") and openings-1 ("The opening roll").
- winning-1's three scored steps are one question ("How many points do you
  win?") on three boards. It is useful repetition, but it comes after three
  explanations and asks no decision.
- The gammon's value is re-explained in advanced-3 before it is used.
- Drill ids `points-1…5` reuse the ids of lessons `points-1…3`, so an
  `exercise_completed` event with `step_id: points-1` is ambiguous.

### 2. Concepts introduced too early

- The "Who's ahead?" pip drill unlocks after Bearing Off (section 6). Pip
  counting is first taught in racing-1 (section 10).
- Game reviews quote shots from the very first game ("hit by 11 of 36 rolls").
  Shot counting is first taught in advanced-1, the last section.
- Games open after section 1, so Coach Watch can say "You can make an anchor"
  long before anchors are taught. That is fine as coaching, but nothing points
  the player to the lesson.

### 3. Concepts introduced too late

- **Pip count and "who's ahead"**: section 10. Every race decision needs it.
- **Shot counting**: section 12. Blots are taught in section 3 and safety in
  section 4, but how risky a blot is only comes at the end.
- **Race or contact**: section 10. It is the first question to ask about any
  position.
- **Game plans**: section 9. Free players see only the priming preview.

### 4. Skills taught but never practised

Outside replaying the same lesson, there is no practice for:

- reading the board (section 1)
- the rules (section 2)
- entering (1 drill position)
- scoring
- primes
- anchors (1 drill position)
- escaping (1 drill position)
- shot counting
- race or contact
- game plans
- the cube

The tactical drill pools are also tiny: 5 or 6 hand-made positions per
category, with 5 drawn per session, so the second session repeats the first and
practice turns into memorising the answers. Only the race drill is generated.

### 5. Skills practised but never measured

- **Drill answers are never counted in skill statistics.** Only lessons feed
  `stats.byCategory`. Practice keeps just `bestFirstTry` (the best session
  ever), so neither improvement nor decline is visible, and Coach's Pick never
  sees drill results.
- **Every scored step is credited to the lesson's single category.** For
  example:
  - winning-2's hit and bear-off steps count as "movement";
  - position-2's escape counts as "strategy";
  - points-2, a safety lesson, counts as "positioning".
- **Mistake practice** counts attempts per position but nothing per skill.
- **Games record mistakes but not good decisions.** A best or fine move is
  always filed under "positioning", so a game can show weakness in a skill but
  never strength.
- **Coach Watch stops** are not stored, and neither is whether the player then
  found the better move.

### 6. Lessons that explain too much before asking

Lessons that open with more than two explanations in a row:

| Lesson | Explanations before the first question |
| --- | --- |
| board-1 | 4 |
| board-4 | 4 |
| board-2 | 3 |
| winning-1 | 3 |
| cube-1 | 3 |

Overall, 73 of the 205 steps are explanations. Several lessons end on a recall
question ("Why is hitting usually good for you?", "Why is an anchor so
useful?") rather than a decision on the board: hitting-2, points-1,
position-1, openings-2, middle-1, middle-2, middle-3 and advanced-2.

### 7. Lessons that could become interactive

- **board-4:** ask "Where are your checkers heading?" (tap) before naming the
  home board.
- **winning-1:** ask what a win is worth before explaining gammons; the
  options' feedback can carry the explanation.
- **cube-1:** ask "They double and you say no. What happens?" before stating
  the rules.
- **points-3** has two scored steps. Add "tap the point that completes the
  prime".
- **position-1** has three steps in total. Add "tap your anchor" and a choice
  between two anchors.
- **racing-1:** compare two single checkers before counting a whole position.

### 8. Important beginner skills that are missing

- **Shot counting basics** in the free path: direct and indirect shots, and how
  many rolls hit.
- **A simple pip comparison** in the free path, before the pip drill unlocks.
- **A position check routine.** No exercise asks the learner to read a whole
  position (race or contact, blots, shots, anchors, primes) before moving.
- **Fluency drills:** finding a point quickly, or where a checker lands.
- **The back game** is absent from the game plans.

### 9. Where game review could reinforce the curriculum

- The review says "Area to improve: Hitting" but offers no lesson or free
  drill. Its only action, "Practice my mistakes", is Premium.
- Every review headline maps to a lesson (Coach's Pick already has the table),
  yet the review never says "You learned this in Hitting".
- Coach Watch gives a clue but never connects it to what the player practised.
- After a game there is no "You had trouble with this twice today. Practise one
  more position?"
- Cube decisions in reviews are never saved for practice.

### 10. Opportunities for personalised progression

- **Coach's Pick needs a lot of data.** It waits for 3 open mistakes in one
  category, or 5 lesson answers under 80%, so a new player gets no pick for
  days, and nothing suggests practice right after a lesson.
- **Mistake practice has no spacing.** A position answered right twice in one
  sitting counts as mastered for good.
- **Mistake practice is Premium only.** Free players collect mistakes from
  every game but can never retry one.
- **The daily challenge ignores weaknesses.** It is picked by a hash of the
  date.
- **Drills never adapt.** The same 5 or 6 positions come up at any level.

## What changes, phase by phase

| Phase | Change |
| --- | --- |
| B | **One skill taxonomy** for lessons, drills, game mistakes and the coach. Every lesson declares its outcome, prerequisites, key decision and in-game use. Scored steps are credited to the skill they train. Drills count toward skills. The curriculum gate checks all of it. |
| C | **Generated micro-drills with levels:** point recognition, pip counting, hitting, shot counting, primes, anchors, bear-off, safety and a position check. Pip counting and shot counting get free introductory lessons, so no drill comes before its lesson. |
| D | **Spaced repetition for game mistakes:** due dates that stretch after correct answers and shrink after wrong ones. |
| E | **Games feed learning.** Coach Watch and reviews name the lesson behind a mistake. After a game: "you had trouble with this today, one more position?". Position of the Day. Coach's Pick ranks due mistakes, game patterns, fading and weak skills. |
| F | **Mastery per skill** (Learning, Practising, Strong) from lessons, drills, games and recency. XP for drills, a skill's first Practising and Strong, and fixed mistakes. |

### Proposed skill taxonomy

Built from what the curriculum, the drills and the review categories already
distinguish, with no skill that lacks a lesson to teach it:

| Group | Skills |
| --- | --- |
| Fundamentals | board, rules |
| Tactical | hitting, shots, safety |
| Positional | points, primes, anchors, escaping |
| Racing | pips, racing, bear-off |
| Strategic | openings, plans |
| Cube | cube |

Today's review categories map onto it as follows: opening → openings,
hitting → hitting, risk → safety, running → escaping, racing → racing,
bearing-off → bear-off, cube → cube. Positioning splits by headline: "An
anchor was available" → anchors; the rest → points.

## Outcome (phases B–F)

What happened to each finding. Commits: `bce06c6` (B), `d89afca` (C), `083b06f` (D),
`8e5c914` (E), `fdd8523` (F). The curriculum is now 40 lessons, 217 steps, 143 scored
(explain 69, move 53, choice 53, tap 26, cube 9, demo 5, challenge 2).

| Finding | Now |
| --- | --- |
| 1. Duplicated concepts | The opening roll is taught once, in the openings section. Authored drill items no longer share ids with lessons. |
| 2. Too early | Every drill and drill level opens with the lesson that teaches it (checked by the curriculum gate). Coach Watch and reviews name the lesson behind a clue, or the idea when it hasn't been taught yet. |
| 3. Too late | Shot counting ("How Risky Is a Blot?", section 3) and pip counting with race-or-contact ("Who’s Ahead?", section 6) are in the free path. Game plans still start in section 9. |
| 4. Taught, never practised | 12 drills with 49 levels (41 generated, so nothing is memorised): board reading, landing spots, entering, hitting, shot counting, safety, points, primes, anchors, escaping, the race (pips, race or contact, who is the favourite) and bearing off, plus a position check that rehearses the whole routine. No drill yet for scoring, game plans or the cube. |
| 5. Practised, never measured | Every scored answer (lessons, drills, positions from games) is credited to the skill its step trains, with a recent window, days practised and last success. Good game decisions and Coach Watch outcomes are still not recorded. |
| 6. Explains before asking | No lesson has more than two explanations in a row (gate). Seven lessons still end on a "why" question, after an on-board decision. |
| 7. Could be interactive | board-4, winning-1, cube-1, points-3, position-1 and racing-1 now ask before they tell. |
| 8. Missing skills | Shot counting and pip comparison are free lessons; the position check drill and fluency drills (find the point, where it lands) exist. The back game is still absent. |
| 9. Review → curriculum | Reviews give each weaker move's key idea and the lesson that taught it, link "Area to improve" to its drill, and let anyone practise a single position free. After a game: "You practised playing safe in “Safe or Risky?”. It tripped you up twice today." Cube decisions are still not saved for practice. |
| 10. Personalisation | Coach's pick: due reviews, game patterns, a drill that just opened, a skill slipping, the weakest skill, a fading skill, each with minutes. Spaced repetition for mistakes (0, 1, 3, 7, 16, 35 days). Position of the Day from due mistakes or the weakest taught skill. The daily challenge follows the coach's focus every other day. Drills level up. Skills show Learning → Practising → Strong → Mastered. |

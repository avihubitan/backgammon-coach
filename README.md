# Backgammon Coach

A mobile game that teaches backgammon from zero: short interactive lessons on a real board, a
Duolingo-style learning path with XP, stars, streaks and unlocks, games against a neural-network
opponent, and a coach that reviews your games and turns your mistakes into practice.

**Learn → Play → Get feedback → Practise your mistakes → Improve.**

## What's in the app

- **Learning path:** 12 sections, 38 lessons, from "Meet the Board" to "Advanced Strategy".
  - Every lesson is hands-on: move checkers, tap points, answer choices, take cube decisions, or
    play mini bear-off challenges.
  - Every exercise gets instant, animated feedback.
- **Interactive board:**
  - Drag a checker onto one of its lit-up targets, or tap the checker and then the target.
  - Checker flights along arcs, a thrown-dice animation, hit impacts, and bearing off into a tray.
  - All animation runs on the UI thread with Reanimated.
- **Game feel:** synthesised sound effects and music (`scripts/generate-sounds.ts`), haptics, particle
  bursts, XP that flies to the counter, level-ups and unlock reveals.
- **Play:** three computer levels. The advanced level is a TD-Gammon-style network trained on 300,000
  self-play games (`scripts/train-network.ts`); the gentler levels use a heuristic.
- **Coach:**
  - Reviews every game and explains the biggest mistakes in plain words.
  - Mistakes are saved and come back as practice until you fix them twice.
- **Practice:** skill drills, a daily challenge, and lesson replays.
- **Progress:** XP and levels, stars, a streak, a daily goal and achievements. Everything is stored
  on the device.

## Free and Premium

The beginner course and Opening Moves are free. So are:

- the first lesson of every advanced course;
- games at every level, drills, daily challenges;
- one full coach review per day.

Premium adds:

- the rest of the advanced courses (Middle Game, Racing, Doubling Cube, Advanced Strategy);
- unlimited coach reviews;
- mistake practice;
- the numbers behind each tip.

There is no paywall on first launch and nothing pay-to-win. One file decides access:
`features/monetization/access.ts`. Screens ask `FeatureAccess`; they never check products or prices
themselves.

Purchases are wired through `services/purchases`. Development builds use a simulated store, so you
can test the full flow. Release builds report purchases as unavailable until a real store provider
is plugged in.

## Repository layout

```
mobile/   Expo + React Native + TypeScript app (iOS, Android, web)
```

### `mobile/src`

| Folder        | What lives there                                                                        |
| ------------- | --------------------------------------------------------------------------------------- |
| `app/`        | Expo Router routes only (tabs, lesson, practice, game, review, paywall)                 |
| `game/`       | Pure, deterministic engine: board, dice, rules, moves, cube, game state, AI and analysis |
| `curriculum/` | Data-only sections, lessons and drills (no UI code)                                      |
| `features/`   | Feature modules: learning map, lessons, gameplay, AI coach, practice, challenges, …     |
| `components/` | Shared UI kit, effects and the reusable `BackgammonBoard`                               |
| `state/`      | Zustand stores persisted with AsyncStorage                                              |
| `services/`   | Feedback (sound, music, haptics), analytics, purchases                                  |
| `theme/`      | Design tokens: colours, typography, spacing                                             |

The layers only depend downward:

- `game` knows nothing about React.
- `curriculum` is plain data that the lesson engine (`features/lessons/engine`) interprets.
- Screens compose features.

## Getting started

```bash
cd mobile
npm install
npm start          # Expo dev server (press i / a / w for iOS, Android, web)
```

## Quality checks

```bash
cd mobile
npm test           # engine, AI, lesson engine, progression, monetization and curriculum tests
npm run typecheck
npm run lint
```

The curriculum tests validate every lesson. A broken lesson fails CI.

- **Rules:**
  - every solution must be legal and meet its goal;
  - every "wrong play" example must really be legal and wrong;
  - demos must be playable and challenges solvable.
- **Strategy:** lessons from Opening Moves onward must agree with the trained network.
  - No accepted play may be a clear mistake.
  - Every double, take and drop answer must match the network's winning chances.

Useful scripts (run with `npx tsx scripts/<name>.ts`):

- `generate-sounds`: renders the sound effects and music.
- `train-network`: trains the AI network.
- `benchmark-ai`: plays the levels against each other and grades the coach.

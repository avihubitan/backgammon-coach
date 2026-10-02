# Backgammon Coach

A mobile app that teaches backgammon from zero through short, interactive lessons on a real board, a
Duolingo-style learning path, and (as the curriculum grows) games against the computer with coaching.

## Repository layout

```
mobile/   Expo + React Native + TypeScript app (iOS, Android, web)
```

### `mobile/src`

| Folder        | What lives there                                                                    |
| ------------- | ----------------------------------------------------------------------------------- |
| `app/`        | Expo Router routes only (tabs, onboarding, lesson player)                           |
| `game/`       | Pure, deterministic backgammon engine: board, dice, rules, moves, cube, game state |
| `curriculum/` | Data-only lessons and sections (no UI code)                                          |
| `features/`   | Feature modules: onboarding, learning map, lessons, gameplay, practice, profile     |
| `components/` | Shared UI kit and the reusable `BackgammonBoard`                                    |
| `state/`      | Zustand stores persisted with AsyncStorage                                          |
| `services/`   | Platform services (haptics, …)                                                      |
| `theme/`      | Design tokens: colours, typography, spacing                                         |
| `types/`      | Shared plain-data types (board annotations)                                         |

The layers only depend downward: `game` knows nothing about React; `curriculum` is plain data that
the lesson engine (`features/lessons/engine`) interprets; screens compose features.

## Getting started

```bash
cd mobile
npm install
npm start          # Expo dev server (press i / a / w for iOS, Android, web)
```

## Quality checks

```bash
cd mobile
npm test           # engine, lesson engine, progression, persistence and curriculum tests
npm run typecheck
npm run lint
```

The curriculum test validates every lesson: each move exercise's solution must be legal and satisfy
its goal, demos must be playable, tap targets consistent, and so on. A broken lesson fails CI.

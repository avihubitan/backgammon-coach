# Backgammon Coach

A mobile game that teaches backgammon from zero: short interactive lessons on a real board, a
Duolingo-style learning path with XP, stars, streaks and unlocks, games against a neural-network
opponent, and a coach that reviews your games and turns your mistakes into practice.

**Learn → Play → Get feedback → Practise your mistakes → Improve.**

Where the device beta stands and the next action: [`docs/BETA_READINESS.md`](docs/BETA_READINESS.md).
Status and next steps: [`docs/DEVELOPMENT_STATUS.md`](docs/DEVELOPMENT_STATUS.md). Release status and
store setup: [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md). Installing on phones and what to
test: [`docs/DEVICE_TESTING.md`](docs/DEVICE_TESTING.md). The closed beta's questions and metrics:
[`docs/BETA.md`](docs/BETA.md). Data the app collects: [`docs/PRIVACY.md`](docs/PRIVACY.md). Ideas
waiting for beta feedback: [`docs/BETA_BACKLOG.md`](docs/BETA_BACKLOG.md).

## What's in the app

- **Learning path:** 12 sections, 40 lessons, from "Meet the Board" to "Advanced Strategy".
  - Every lesson is hands-on and asks before it tells: move checkers, tap points, answer choices,
    take cube decisions, or play mini challenges. Every exercise gets instant, animated feedback.
  - Every exercise trains a named skill (15, from reading the board to the cube). Profile shows each
    skill's level, Learning → Practising → Strong → Mastered, and what the next one takes.
- **Interactive board:** drag a checker onto a lit-up target, or tap the checker and then the target.
  Checker flights, a thrown-dice animation, hit impacts and bearing off run on the UI thread
  (Reanimated). Screen readers hear each point's checkers and what can be done with it.
- **Play:** three computer levels. Games open after the first section ("Meet the Board"); the coach
  helps with rules not learned yet. The advanced level is a TD-Gammon-style network.
- **Coach:**
  - Hints: the coach's move for the roll as arrows, with the reason in one sentence.
  - Coach Watch: before a clear mistake is confirmed, "Are you sure?" with a clue; then try again,
    see the better move, or play on. After a stop it lets the next two moves pass unless one is a
    blunder, so learners aren't nagged. Can be switched off.
  - Reviews every game in the background: what you played, the coach's move, why, the key idea
    and the lesson behind it, what could have happened (shots, winning chances), and "Practise
    this position" (free).
  - After a game: the idea that tripped you up, the lesson that teaches it, one position to practise.
  - Move quality per game (0–100) and its trend; mistakes come back on a spaced schedule (after 1,
    3, 7, 16 and 35 days) until fixed.
  - Coach's pick on Home: what to work on next, with minutes, from due reviews, patterns in your
    games, a drill that just opened, and skills that are weak, slipping or fading.
  - Position of the Day: "What would you play?", from your own games or your weakest skill.
- **Practice:** 12 drills with levels (fresh positions each time, 10–30 s a question, short
  hit/escape/prime/race/bear-off challenges), a daily challenge that follows the coach's focus, your
  own mistakes, lesson replays.
- **Progress:** XP and levels, stars, streak with streak freezes, a daily goal, achievements.
- **Daily reminders:** opt-in local notifications that follow the streak.
- **Cloud backup (optional):** anonymous backup code, merged across devices.

## Free and Premium

Free: the beginner course and Opening Moves, every lesson that introduces a skill, the first
lesson of every advanced course, games at every level, all drills, daily challenges, Position of the
Day, practising any single position from your games, one full coach review per day, and three hints
and three Coach Watch checks per game.

Premium adds the rest of the advanced courses, unlimited coach reviews, hints and Coach Watch, the
review queue of all your mistakes, winning chances and the move-quality trend, and two extra board
styles (cosmetic). There is no paywall on first launch and nothing pay-to-win.

One file decides access: `mobile/src/features/monetization/access.ts`. Screens ask `FeatureAccess`;
they never check products or prices.

## Repository layout

```
mobile/    Expo SDK 57 + React Native + TypeScript app (iOS, Android; web for development)
backend/   NestJS API: anonymous accounts and progress backup (MongoDB; memory in development)
docs/      Status, release checklist, device testing, beta plan, privacy
```

| `mobile/src`  | What lives there                                                                          |
| ------------- | ----------------------------------------------------------------------------------------- |
| `app/`        | Expo Router routes only (tabs, lesson, practice, game, review, paywall, onboarding)       |
| `game/`       | Pure, deterministic engine: board, dice, rules, moves, cube, game state, AI and analysis  |
| `curriculum/` | Data-only sections, lessons and drills (no UI code)                                       |
| `features/`   | Feature modules: learning map, lessons, gameplay, coach, practice, monetization, …        |
| `components/` | Shared UI kit, effects, the reusable `BackgammonBoard`, the crash screen                  |
| `state/`      | Zustand stores persisted with AsyncStorage; saved data is checked as it loads (`sanitize`) |
| `services/`   | Feedback (sound, haptics), analytics, purchases, cloud sync, reminders                    |
| `theme/`      | Design tokens and board styles                                                            |

Layers only depend downward: `game` knows nothing about React, `curriculum` is plain data that the
lesson engine (`features/lessons/engine`) interprets, and screens compose features. Anything that
talks to the outside world (stores, notifications, the backend) sits behind an interface in
`services/`, with a fake for tests.

## Getting started

```bash
cd mobile
npm install
npm start          # Expo dev server: i / a for a simulator, w for the browser
```

The browser is the quickest way to work on screens and flows; native features (notifications,
purchases, haptics) need a phone or simulator with a **development build**:

```bash
npx eas-cli@latest init                                   # once: links the project to your Expo account
npx eas-cli@latest build --profile development --platform ios     # or android; installs a dev client
npm start                                                 # then open the project in the dev client
```

Profiles (`mobile/eas.json`): `development` (dev client, internal), `preview` (internal testing build,
Android APK) and `production` (store builds, version numbers managed by EAS).

### Environment variables

`mobile/.env.example` and `backend/.env.example` list them. For EAS builds, set them as EAS
environment variables for the matching environment (development, preview, production).

| App (`EXPO_PUBLIC_*` are public and bundled) | Purpose                                                            |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `EXPO_PUBLIC_API_URL`                        | Backend for cloud backup. Empty: the backup section is hidden.     |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY`             | RevenueCat public SDK key (iOS). Empty: no real purchases on iOS.  |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`         | RevenueCat public SDK key (Android).                               |
| `EXPO_PUBLIC_STORE`                          | `mock` forces the simulated store in development builds.           |
| `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_PRIVACY_URL` | Links on the paywall (and Privacy in Profile). iOS falls back to Apple's standard EULA. |
| `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST` | Product analytics (PostHog). Empty: events stay on the device. |
| `EXPO_PUBLIC_SENTRY_DSN`                     | Crash reporting (Sentry). Empty: crashes aren't reported.          |
| `EXPO_PUBLIC_APP_VARIANT`                    | Set by `eas.json` per profile; tags reports, hides test tools.     |
| `SENTRY_AUTH_TOKEN` (secret), `SENTRY_ORG`, `SENTRY_PROJECT` | Build time only: upload source maps and debug symbols. |

| API          | Purpose                                                                          |
| ------------ | -------------------------------------------------------------------------------- |
| `MONGODB_URI`, `MONGODB_DB` | Storage. Required when `NODE_ENV=production`.                     |
| `PORT`       | HTTP port (3000).                                                                |
| `CORS_ORIGINS` | Browser origins allowed (the web build only; native apps don't need it).        |
| `TRUST_PROXY` | Proxies in front of the API (usually 1 on a hosting platform), for rate limits. |
| `RATE_LIMIT_PER_MINUTE`, `NEW_ACCOUNTS_PER_MINUTE`, `BODY_LIMIT` | Limits.                     |

## Purchases

`services/purchases` picks the store for each build:

- **RevenueCat** when the build has the platform's key. RevenueCat handles StoreKit and Google
  Play Billing, receipt validation, renewals, trials, grace periods, refunds and restore.
  `revenueCatProvider.ts` maps its offerings and customer info onto our products and entitlements;
  nothing else knows about it.
- **Simulated store** in development builds without a key (purchases are free and instant; the
  Profile card has an "End (dev)" button to test expiry).
- **Unavailable** in release builds without a key: the paywall says Premium isn't on sale yet.

RevenueCat dashboard setup: one entitlement `premium` attached to every product, and a current
offering with Monthly and Annual packages (Lifetime is in the catalogue but switched off). Product
identifiers are in `features/monetization/catalog.ts`. Cached Premium works offline until three
days past its end date.

## Analytics

Typed events (`services/analytics/events.ts`) go through one gate, `Analytics`, which drops
everything when the player turns off "Share anonymous usage data". Behind it, PostHog (chosen for
funnels, retention and later A/B tests without extra native setup) receives the events on iOS and
Android when the build has `EXPO_PUBLIC_POSTHOG_KEY`. The client is only created once the player's
choice is known to be on, with GeoIP, lifecycle autocapture, feature flags and surveys off; the
distinct id is the random install id. A session starts on a cold start and after 30 minutes away
(`app_opened`, with start-up time on cold starts). [`docs/BETA.md`](docs/BETA.md) maps events to
the beta's metrics.

## Beta feedback

"How was this?" after a lesson or a game (at most once a day; "okay" and "not good" ask what could
be better) and "Send feedback" in Profile, which also shows the app version. Feedback travels with
the analytics events (`feedback_rated`, `feedback_submitted`), so it follows the usage-data switch.
Switch the quick question off for the public release: `features/feedback/feedbackPolicy.ts`.

## Crash reporting

Sentry, behind `services/crash` (`CrashReporter`; the web build has a no-op). It starts first, from
`index.ts`, so start-up errors are caught; the root layout reports screen changes as breadcrumbs,
and the crash screen reports errors it catches. It follows the "Share anonymous usage data" switch
(remembered in secure storage so an opted-out player sends nothing, even at start-up). No IP
addresses, user details, screenshots or device names are sent (`sendDefaultPii: false`, events
scrubbed). Source maps and debug symbols upload during EAS builds only when `SENTRY_AUTH_TOKEN` is
set (`app.config.ts` adds the Sentry plugin then); otherwise the upload step would fail the build.

## Notifications

Daily reminders are local notifications (`expo-notifications`, no push server). The plan is
rebuilt whenever the app opens or the streak changes (`services/reminders`, planner in
`features/reminders/reminderPlan.ts`). Android uses a "Daily reminders" channel and the white
checker icon in `assets/images/notification-icon.png`. Tapping one opens Home (it never interrupts a
lesson, game or practice) and records `notification_opened`. Development and preview builds have
"Send a test reminder" under the reminder setting, for checking on a phone. Development web builds
simulate reminders; production web hides them.

## Cloud backup

Progress lives on the device first. With `EXPO_PUBLIC_API_URL` set, Profile offers **Back up my
progress**: an anonymous account and a backup code (no email or name). Two devices' copies are
merged by rules in `services/sync/snapshot.ts`, so nothing either one learned is lost; an upload
never replaces newer progress without merging first. "Delete my backup" removes the backup and the
account from the server; other devices linked to it notice on their next sync and stop backing up.

## AI and analysis

The engine (`game/`) is deterministic and fully tested. The network weights are in
`game/ai/weights/network.json`, loaded at startup. Scripts (`npx tsx scripts/<name>.ts`):

- `train-network`: trains the TD network by self-play.
- `benchmark-ai`: plays the levels against each other and grades the coach.
- `benchmark-speed`: times the engine work done on the JavaScript thread (computer moves, Coach
  Watch, hints, cube decisions, reviews). Bundled with esbuild, it also runs under a Hermes CLI,
  which interprets like the phones do.
- `generate-sounds`: renders the sound effects and music.

## Curriculum

Sections live in `curriculum/sections/` as data. A lesson is a list of steps (text, move, choice,
point, cube, bear-off challenge). The curriculum tests check every lesson: solutions must be legal
and meet their goal, "wrong" examples must be legal and wrong, demos playable, and lessons from
Opening Moves onward must agree with the network (no accepted play may be a clear mistake; cube
answers must match its winning chances). A broken lesson fails the tests.

## Quality checks

```bash
cd mobile && npm test && npm run typecheck && npm run lint
cd backend && npm test && npm run typecheck
```

Before an EAS build, `cd mobile && npm run check:env -- --profile preview` checks that build's
service settings (keys, addresses, nothing secret in public variables) without printing them; EAS
runs the same check after install.

## Deploying the API

`backend/Dockerfile` builds a production image (Node 22, non-root, health check). Run it with
`NODE_ENV=production`, `MONGODB_URI` (for example MongoDB Atlas) and `TRUST_PROXY=1` behind a load
balancer. `GET /v1/health` answers 503 when the database can't be reached. See
[`backend/README.md`](backend/README.md).

# Development status

Short and current, so work can resume quickly. Update it when a milestone moves.

## Milestone: real device beta

The next step is the first preview build on a physical phone, and it waits on an Expo account
(`eas init`); [BETA_READINESS.md](BETA_READINESS.md) is the full report and the exact next action.
Nothing has been checked on a physical phone yet. After that comes the closed beta (20–50 testers):
[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) has the status table.

### Gameplay polish (done)
The game itself was reworked to feel like a real match rather than an exercise, after a recorded
audit of seeded games at 320, 375, 390 and 430 pt. Engine and AI strength untouched; every change
is presentation, timing or wording, with tests for the pure parts.
- **Table:** the board sits in the middle of the screen between two seats (the opponent's face and
  name, you with your own checker); the active seat lights up with "Your turn" or "Thinking".
  `gameLayout` shares the height (full-width board whenever it fits; tested on seven phone shapes)
  and the coach's panel sits under the board without moving it. Fixed at 320x568: Coach Watch
  overlapped the buttons and labels were cut.
- **Opponents:** Niko (Beginner, friendly), Leyla (Intermediate, confident), Viktor (Advanced,
  calm), presentation only. A greeting, a few rate-limited lines on hits and doubles, a goodbye;
  never mocking after a loss (tested).
- **Start:** the table and checkers settle in; the opening roll throws one die on each half (ties
  shown), lights the winner and slides both dice together as the first roll.
- **Dice and board:** dice with depth and readable dark dice; doubles pop in as a pair with a
  sparkle, a haptic and "Doubles! You play four 5s."; brass and ivory move markers instead of neon
  mint; a coral "no" where a tap is refused; hits spelled out; a glint for each checker borne off.
- **Pace:** the computer's turn went from a median of 2.63 s to 1.96 s (max 3.71 s to 3.11 s) on
  the same seeded game, with the same long tasks and dropped frames (`turnPacing`, tested).
- **End:** the last checker lands, the board says "You win!" (confetti) or "Good game", the
  opponent says goodbye, then the sheet rises; after a loss it leads with "Review with coach".
- **Play tab:** "Play Niko" right under the opponents; options below.

### Device-readiness pass (before the first build)
Risks that only show on phones, found by review and reproduced in the browser, each fixed with a
regression test:
- An unreadable or damaged save no longer leaves the app on a blank screen at start-up; Android's
  ~2 MB per-value limit is respected (finished games stored apart, within a budget); a move no
  longer rewrites ~875 KB.
- Android back asks before leaving a lesson or game and closes dialogs.
- Leaving a game (or the app being closed) during the computer's turn no longer freezes the game,
  or crashes a release build, when it's resumed.
- An app kept in memory overnight now shows today's streak, goal and challenge, not yesterday's.
- Unknown links show a "Page not found" page instead of the router's developer page and sitemap.
- The backup restore dialog stays above the iOS keyboard; reminders recover when the phone's
  notification service fails.
- `npm run check:env` (also on EAS after install) checks each build's service settings.

### Done for the closed beta
- **Builds:** `eas.json` (development client, internal preview, production; each sets
  `EXPO_PUBLIC_APP_VARIANT`) passes Expo's schema. `expo prebuild` for iOS and Android checked:
  "draw over other apps" blocked, unused Face ID text removed, `expo-asset` installed for
  `expo-audio`. Hermes bundles compile for both platforms.
- **Crash reporting:** Sentry behind `services/crash`, started from `index.ts` before the app;
  anonymous; follows the usage-data switch even at start-up; source maps upload only when the build
  has `SENTRY_AUTH_TOKEN` (`app.config.ts`).
- **Analytics:** PostHog behind the existing `Analytics` gate, created only with consent; events
  match the beta's questions (sessions with start-up time, Coach's pick, Coach Watch, reviews,
  mistakes, purchases, backup, notifications, feedback). [BETA.md](BETA.md) maps them to metrics.
- **Feedback:** "How was this?" after lessons and games (once a day), "Send feedback" and the build
  number in Profile.
- **Notifications:** tapping a reminder opens Home (never interrupting a lesson or game) and is
  tracked; preview builds can send a test reminder.
- **Store rules:** Terms of Use and Privacy Policy links on the paywall, privacy link in Profile,
  "Manage" subscription, backup (account) deletion in the app; RevenueCat Test Store keys refused
  in production builds.
- **Backend:** Docker image run against MongoDB 7: everything works, and the run led to fixes
  (5 s database timeouts instead of 30, 3 s health check, JSON logs with one line per request).
  `DELETE /v1/accounts/me`; storage contract tests also run on MongoDB; `npm run smoke` checks a
  deployment.
- **Speed:** `scripts/benchmark-speed.ts`, run in Node and under a Hermes interpreter. The review's
  "what could have happened" was the one slow spot (up to 175 ms per tap); it now uses the
  network directly (under 1 ms) and agrees better with the coach's verdict.
- **New-player pass** (iPhone SE size): onboarding, Home, the first game and the tabs read clearly;
  fixed day-one jargon in the daily challenge and its cut-off title on Home. Coach Watch now leaves
  two moves of room after a stop (blunders excepted): 4.7 → 3.5 stops a game for a weak player.
- **Earlier:** crash screen, damaged-save repair, soft Play gate, RevenueCat, Coach Watch, review
  outcomes, Coach's pick, accessibility labels, small-screen fixes.
- **Docs:** [DEVICE_TESTING.md](DEVICE_TESTING.md) (install steps, phones, the seven critical flows,
  offline, speed), [PRIVACY.md](PRIVACY.md) (data inventory, store answers, policy draft),
  [BETA.md](BETA.md) (questions, metrics, feedback, running the beta).

### Next
1. Expo account and `eas init` (commit the projectId), then an Android preview build: the quickest
   way to a first phone ([DEVICE_TESTING.md](DEVICE_TESTING.md), top).
2. Apple Developer membership and an iPhone preview build; the device pass on both, recorded in
   [DEVICE_TESTING.md](DEVICE_TESTING.md) §8. Fix what it finds.
3. Accounts for RevenueCat, Sentry, PostHog, Play Console; set the EAS environment variables
   ([DEVICE_TESTING.md](DEVICE_TESTING.md) §1) and run `npm run check:env`.
4. Store products and sandbox purchases; host the privacy policy.
5. Optional for the beta: deploy the API with a managed MongoDB for cloud backup.
6. TestFlight and Play internal testing; invite the first 10 testers ([BETA.md](BETA.md)).
7. Ideas noticed on the way wait in [BETA_BACKLOG.md](BETA_BACKLOG.md).

### Blocked here (this environment)
- No Expo account or `EXPO_TOKEN`, and `api.expo.dev` is blocked: `eas init` and `eas build`
  can't run here. They run on the owner's computer (or here, after the environment changes in
  [DEVICE_TESTING.md](DEVICE_TESTING.md)).
- No Android SDK or Xcode, and `dl.google.com` is blocked, so no native compile or emulator. Native
  builds need EAS (or a Mac and Android Studio). No physical phones can be reached from here.
- Sentry, PostHog and RevenueCat hosts are blocked, so delivery to them can't be checked here.

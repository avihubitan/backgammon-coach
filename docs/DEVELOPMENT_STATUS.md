# Development status

Short and current, so work can resume quickly. Update it when a milestone moves.

## Milestone: real device beta

The next step is the first preview build on a physical phone, and it waits on an Expo account
(`eas init`); [BETA_READINESS.md](BETA_READINESS.md) is the full report and the exact next action.
Nothing has been checked on a physical phone yet. After that comes the closed beta (20–50 testers):
[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) has the status table.

### Game-feel polish (done)
A last pass on how the game feels in the hand, before the first phone. Engine, AI strength, Coach
Watch limits, Premium gating and saved data are untouched (nothing under `src/game`, `src/state`
or monetization changed); all of it is presentation, timing and input safety. **None of it has
been judged on a physical phone: that is the next step** (haptic strength, smoothness on a
low-end Android, the sound mix).
- **Checkers move like pieces:** picked up quickly with a soft shadow falling away, carried, set
  down with weight and a small settle (was a 16% shrink with a spring bounce). A full point closes
  up as the checker comes down onto it. Each checker still mounts with four animated styles.
- **Hits:** the hitter lands on top of the blot (it used to land underneath, hidden for ~150 ms)
  and comes down harder; the blot is knocked off at contact and slows onto the bar. Lighter jolt.
- **Bearing off:** lifted higher, lands in its slot and lies down with a glint. Fixed: bearing off
  several checkers quickly turned one into a slab in mid-air.
- **Dice and turns:** used dice step back but stay readable (the opponent's dark ones all but
  vanished); a finished turn's dice fade away. A tap before you can move is answered (Roll pulses;
  during the opponent's turn its "Thinking" does). Multi-step moves time each hop by its flight:
  the next hop starts after 326–454 ms instead of always 440.
- **Opponents:** no lines on doubles; "that was close" only when the loser had ≤ 3 checkers left;
  "Again?" instead of hello when replaying the same opponent; no line twice in a row; smug lines
  replaced; the goodbye comes with the end banner, after the last checker has landed.
- **Result:** a lost gammon is "Gammon", not "Gammon!"; after a loss one line says what the
  review holds ("Your coach found 2 moves to look at", the biggest lesson when there are many, or
  that the dice decided). The review now runs during the end banner, so it's ready when the sheet
  rises. XP counts up, lands with a pop and a tick and fills a level bar; streak and achievements
  follow it. Short phones: smaller badge, and the sheet scrolls instead of running off the top.
- **Board:** recessed felt under the frame's lip, a crisp frame edge, a sunken tray, turned
  checker edges. Static art, every board style.
- **Haptics:** your own moves, rolls and bear-offs are felt; the opponent's are only heard, a
  little softer (the phone buzzed 4–5 times per computer turn). Being hit is felt (medium; landing
  a hit stays heavy). The doubles chime is for your own doubles.
- **Input safety:** a hop still waiting when the game moved on (a resign) is skipped instead of
  being thrown out by the engine inside a timer (a release-build crash); stale actions the rules
  refuse are reported, not crashed on; two quick Hint presses no longer cost two hints.
- **Small phones:** Undo, Done and Show me were cut to "UN…", "DO…", "SHOW …" at 360–375 pt
  (iPhone SE). Button rows tighten under 400 pt; labels shrink a little rather than truncate.

Animation timing (responsiveness wins; nothing decorative blocks input):

| Tier | What | Time |
| ---- | ---- | ---- |
| Instant | selection lift, legal targets, turn state | under 150 ms |
| Fast | checker flight; drop settle; landing settle; dice throw (readable at 450 ms); buttons | 220–420; 170; ~230; 640; ≤ 260 ms |
| Medium | table entrance; end banner, then the result sheet; an opponent's line | ~1 s; 450 ms, then 1.3 s (loss) / 1.7 s (win); 2.8 s |
| Special | doubles (second pair and sparkle), hit (knock and jolt), win (confetti) | within the above |

Measured in headless Chromium on the same seeded game (390×844), before → after this pass:
- Unthrottled: computer turn median 1963 → 1959–1988 ms, max ~3.1 s both; one long task
  (99 → 83–111 ms); 41 → 41–42 frame gaps over 34 ms, worst 117 ms both.
- 4× CPU throttle, paired runs: long tasks 241 → 202, 297 → 254, 265 → 233 (12–16% fewer);
  frame gaps noisy (332 → 334; 312 → 361 without screenshots); computer turn the same (2.2–2.4 s).
  Animation scenes (move, hit, four quick bear-offs, doubles, the computer's hit, both endings):
  no long tasks or frame gaps at 4× in either build; at 8× the doubles throw shows 1–4 short gaps
  in both alike. Browser frames are a proxy: judge smoothness on the phone.
- Hermes bundles: iOS 9,185,893 B (+18 KB), Android 9,361,905 B (+4 KB).

Tests: 59 suites (every test file on disk discovered and run) and 1,230 tests, from 58 and 1,212
(new: rapid input, hit and hop timing, haptics by whose move, opponent moments, result lines);
typecheck, `npm run lint` and `eslint .` clean. In the browser: the gameplay checklist (19 items,
rapid taps included) at 320, 360, 375, 390 and 430 pt; a game played by dragging; Coach Watch
free (3 stops, unchanged) and Premium (7, unchanged); every route with no console errors.

Known limitations: not yet felt or seen on a phone (above); after a game is left mid-way through
the computer's turn it replays that whole turn ([BETA_BACKLOG.md](BETA_BACKLOG.md)); doubles reuse
the lessons' star chime. Latest code commit of this pass: `d2268ec`.

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

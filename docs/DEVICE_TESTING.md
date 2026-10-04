# Testing on real phones

Nothing has been checked on a physical phone yet. Everything so far ran in tests, in Chromium at
phone sizes, as Hermes bundles, and as generated native projects (see "Already verified" at the
end). This page is the plan for the first device pass: how to install the app, which phones, and
what to check. Record results in [section 8](#8-results).

## Quickest way to a first phone

An Android phone and an Expo account are all it takes; no Google or Apple account is needed for
this step. From your own computer:

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init                 # links the existing app; writes extra.eas.projectId into app.json
git add app.json && git commit -m "Link the EAS project" && git push
npm run check:env -- --profile preview  # optional: which services this build will have
npx eas-cli@latest build --profile preview --platform android
```

EAS creates and keeps the Android signing key. When the build finishes, open its link on the
phone and install the APK. With no service keys set, the build still runs: Premium says it isn't on
sale yet, and no crash reports or analytics leave the phone. Run Flows 1–4 and 6 with it. The
iPhone build needs the Apple Developer membership in step 2 below.

`eas init` must run from `mobile/` (where `eas.json` is). It asks to create the project
`@<your account>/backgammon-coach`; say yes. Nothing else in the repository changes.

**From a Claude Code cloud session instead of your computer**, two environment settings are needed
(the session's environment menu → Edit): an Expo access token (a robot user's token is safest) as
the environment variable `EXPO_TOKEN`, and Network access set to Custom with `api.expo.dev`,
`expo.dev` and `storage.googleapis.com` (where EAS uploads the project) added under Allowed domains,
keeping the default package-manager list. See
[network access](https://code.claude.com/docs/en/cloud-environments#network-access). Even then, the
first iOS build needs an interactive Apple sign-in, so do that one on your computer.

## 1. Get the app onto a phone

One-time setup (needs accounts; nothing here can be done without them):

1. **Expo:** `cd mobile && npx eas-cli@latest login && npx eas-cli@latest init`. This adds
   `extra.eas.projectId` to the app config; commit it.
2. **iPhone (internal builds):** an Apple Developer Program membership. Register each test iPhone
   with `npx eas-cli@latest device:create` (it gives a link to open on the phone). Development
   builds also need Developer Mode on the phone (Settings → Privacy & Security → Developer Mode).
3. **Android:** nothing for APKs; the phone asks to allow installing from the browser.
4. **Environment variables** for each EAS environment (values come from the services' dashboards):

   ```bash
   npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_SENTRY_DSN --value "https://…" --visibility plaintext
   npx eas-cli@latest env:set --environment preview --name SENTRY_AUTH_TOKEN --value "sntrys_…" --visibility secret
   ```

   | Variable | development | preview | production |
   | -------- | ----------- | ------- | ---------- |
   | `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `…_ANDROID_KEY` | RevenueCat Test Store key (`test_…`) or empty (simulated store) | platform keys (sandbox purchases) | platform keys |
   | `EXPO_PUBLIC_SENTRY_DSN` | optional | yes | yes |
   | `SENTRY_AUTH_TOKEN` (secret), `SENTRY_ORG`, `SENTRY_PROJECT` | no | yes | yes |
   | `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST` | optional | yes | yes |
   | `EXPO_PUBLIC_API_URL` | a test API | the production API | the production API |
   | `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_PRIVACY_URL` | optional | yes | yes |

   `EXPO_PUBLIC_APP_VARIANT` is set by `eas.json`. A production build ignores a Test Store key.

   Check the values before building, without printing them:
   `npx eas-cli@latest env:pull --environment preview && npm run check:env -- --profile preview`.
   The same check runs on EAS after install: it stops a build only for settings that would ship a
   broken or unsafe app (a secret key in an `EXPO_PUBLIC_` variable, a Test Store key in
   production, an http API address, a malformed DSN or link); missing services are warnings.
   Building locally (`expo export`, `expo run:*`) after changing an `EXPO_PUBLIC_` value needs
   `--clear`: Metro's cache otherwise keeps the old value.

Builds:

| Build | Command | Use it for |
| ----- | ------- | ---------- |
| Development | `npx eas-cli@latest build --profile development --platform ios` (or `android`) | Debugging: dev menu, live reload from `npx expo start` (`--tunnel` if the phone isn't on the same network) |
| Preview | `npx eas-cli@latest build --profile preview --platform all` | **The device pass**: release mode (real speed), installs from a link (APK on Android, registered iPhones on iOS) |
| Production | `npx eas-cli@latest build --profile production` then `npx eas-cli@latest submit --profile production` | TestFlight and Play internal testing (the submit profile targets the internal track) |

Profile → bottom of the screen shows the build ("Backgammon Coach 1.0.0 (14) · preview"); quote it
in every report.

## 2. Phones

| Slot | Example | Why |
| ---- | ------- | --- |
| Small iPhone | iPhone SE (2nd/3rd gen), 375×667 | Smallest layout, no notch, Touch ID |
| Standard iPhone | iPhone 13–16 (6.1") | Notch or Dynamic Island; most common |
| Large iPhone | iPhone 15/16 Plus or Pro Max | Large layout; 120 Hz on Pro models |
| Small or low-end Android | 5.5–6", 720p, 3–4 GB RAM, Android 11–12 (Galaxy A1x, Moto E/G) | Slowest JavaScript, older OS |
| Standard Android | Pixel 7/8 or Galaxy A5x, Android 14–15 | Most common; notification prompt (13+), gesture navigation |

Nice to have: an iPad (the app runs full screen on it), Android with 3-button navigation, and one
phone set to the largest text size.

## 3. Critical flows

Run every flow on every phone with a preview build. Note pass/fail and anything odd.

**Flow 1: fresh install.** Install → launch → onboarding → first move → first lesson → Home.
- Splash hides without a white flash; fonts load; nothing hides under the notch, home indicator or
  Android navigation bar.
- The first move works by tapping and by dragging.
- Lesson complete shows XP and stars; Home shows the streak and what to do next.
- Time from tapping the icon to the first screen (stopwatch, three cold starts).

**Flow 2: learning.** Home → Learn → lesson → board → correct answer → XP → stars → unlock.
- Dragging a checker feels immediate; the screen doesn't scroll while you drag.
- Feedback, XP and stars animate smoothly; the next lesson unlocks and the path shows it.
- "How was this lesson?" appears (at most once a day); "Not good" opens the box.
- The daily loop: Home's "Your coach's pick" opens its drill or lesson, and shows it done after;
  the daily challenge counts progress; the streak and daily goal update after a lesson. Over a few
  days: a missed day uses a ready streak freeze.

**Flow 3: game.** Home → Play → choose a level → roll → move → Coach Watch → finish → review.
- Dice and checker animations are smooth; the computer's turn doesn't freeze the screen.
- Make a clear mistake: Coach Watch asks "Are you sure?"; try all three answers on different turns.
- Hints: three per game for free players.
- Kill the app mid-game, reopen: the game resumes.
- Leave the game while the computer is moving (X, or Android back → Leave), then Play → Resume:
  the computer replays its turn and the game goes on (this used to freeze, or crash a release
  build).
- The result sheet fits on the small iPhone, with "How was this game?".
- Game feel (judge on the phone, not the simulator): the opening dice land on both halves and slide
  together; doubles pop in with a sparkle and a haptic; checkers lift, fly and land without
  stutter on the low-end Android; the "Your turn" / "Thinking" badges are clear at a glance; the
  opponent's lines are occasional, not chatty; a win ends with the board's "You win!" before the
  sheet, a loss with "Good game".

**Flow 4: coach.** Game → mistake → Coach Watch → review → practise the position → practice.
- The review shows your move, the coach's move, why, and what could have happened.
- Tapping between mistakes feels instant.
- "Practise this position" opens it first (Premium), or the paywall (free).

**Flow 5: Premium** (Apple sandbox account; Google Play license tester with a build from the
internal testing track).
- A locked feature (an advanced lesson, the fourth hint, a second review in a day) opens the paywall.
- The paywall shows store prices and the trial, and its Terms of Use and Privacy Policy links open.
- Buying unlocks Premium at once; restoring works on a second phone; airplane mode keeps Premium.
- Cancel in the store's sandbox settings: Profile says "ends on …"; after expiry Premium goes away.
  Sandbox subscriptions renew every few minutes and stop after a few renewals.
- Profile → Premium → "Manage" opens the store's subscription page.

**Flow 6: notifications.**
- Profile → Daily reminder on → the system asks (Android 13+ too) → allow.
- Preview builds: "Send a test reminder" → it arrives in about 5 seconds, even with the app open.
- With the app in the background on another tab, tap a reminder: the app opens on Home.
- Set the time two minutes ahead and kill the app: the reminder arrives, with the app icon (iOS) or
  the white checker (Android).
- Finish a lesson: no reminder that day. Deny permission: the "turn them on in Settings" note and
  its button work.

**Flow 7: backup** (needs the API deployed and `EXPO_PUBLIC_API_URL`).
- Phone A: Profile → Back up my progress → Show my backup code.
- Phone B (fresh): finish one lesson → Restore from a code → both phones' lessons are there.
- Learn on both; after a sync both have everything.
- Phone A: Delete my backup → Phone B says "This backup was deleted" on its next start; its progress
  stays.

**Flow 8: phone behaviour.**
- Android back: in a lesson it asks "Leave this lesson?", in a game "Leave the game?", on an open
  dialog it closes the dialog, on a tab it leaves the app. Test with gesture and 3-button
  navigation.
- Keyboard: Profile → Restore from a code: the keyboard doesn't cover Restore (iPhone SE), the Go
  key restores, a whole code fits in the box. "Send feedback": the box stays above the keyboard.
- Safe areas (the app is portrait only): nothing under the notch, Dynamic Island, home indicator
  or Android navigation bar on Home, a lesson, a game, the paywall and every dialog.
- Background and resume: start a lesson, switch apps for a minute, come back: same step. Leave
  the app in the background overnight (don't kill it): next morning Home shows today (0 XP, "Learn
  today to keep your streak alive"), not yesterday's "Daily goal done".
- Links: an unknown link opens a "Page not found" page with "Go to Home":
  `adb shell am start -a android.intent.action.VIEW -d "backgammoncoach://does-not-exist"` or, on
  an iPhone, type `backgammoncoach://does-not-exist` into Safari.
- Reinstall: delete and reinstall the app. Progress is gone (expected: it lives on the phone, and
  neither iCloud nor Google backup includes it, see [BETA_BACKLOG.md](BETA_BACKLOG.md)); Restore
  purchases brings Premium back. On an iPhone, turning backup back on reconnects to the same
  backup (the code stays in the Keychain) and brings progress back.
- A long-used save: after 20+ games and many lessons, kill and reopen the app: it opens as fast as
  before, and Profile's games list scrolls smoothly.

## 4. Offline (airplane mode)

- Cold start in airplane mode: Home appears.
- Lessons, practice, games, reviews and Profile all work; Premium stays.
- Backup shows that it can't reach the server, without error pop-ups.
- Reconnect: backup says "Backed up just now"; the events made offline arrive in PostHog (check
  their times); subscription status refreshes. No progress lost.

## 5. Speed (measure on the low-end Android first)

- Cold start: icon tap to the first screen, three times. Compare with `startup_ms` on `app_opened`
  in PostHog and Sentry's app-start timing.
- Board: drag, dice roll, checker flights, hits and bearing off; look for stutter. A development
  build's Perf Monitor shows UI and JS frame rates; judge smoothness on a preview build.
- Computer turn on Advanced: from "Done" to its move landing. Engine work measured at most 73 ms
  under a Hermes interpreter on a server core (`scripts/benchmark-speed.ts`); a phone is slower, but
  anything over about 300 ms of frozen screen is a bug.
- Review: open one and tap through the mistakes.
- Learning map and Profile with many games: scroll top to bottom.

## 6. Accessibility

- VoiceOver and TalkBack: onboarding, a lesson, a game. Board points read like "Point 24, 2 of your
  checkers"; every button has a name.
- Largest text size: screens stay usable (text scales up to 1.6×).
- Reduce Motion on: the board and effects calm down.

## 7. Reporting

One line per phone and flow:

```
iPhone SE 3 · iOS 18.5 · 1.0.0 (14) · preview · Flow 3 · FAIL · result sheet buttons cut off · [screenshot]
```

Crashes show up in Sentry with the build number; add the time they happened.

## 8. Results

Copy this table per phone. Pass, fail (with a line in the report format above) or "not run".

```
Phone · OS · build (Profile → bottom) · date
| Flow                         | Result | Notes |
| ---------------------------- | ------ | ----- |
| 1 Fresh install + onboarding |        |       |
| 2 Learning                   |        |       |
| 3 Game (incl. leave mid-turn)|        |       |
| 4 Coach + mistake practice   |        |       |
| 5 Premium (sandbox)          |        |       |
| 6 Notifications              |        |       |
| 7 Backup                     |        |       |
| 8 Phone behaviour            |        |       |
| Offline                      |        |       |
| Speed (cold start ×3, s)     |        |       |
| Accessibility                |        |       |
| Sentry test error seen       |        |       |
| PostHog events seen          |        |       |
```

## Already verified (not on phones)

- 1,180+ unit tests, typecheck and lint.
- The web export in Chromium at phone sizes, including iPhone SE: every main route, onboarding,
  lessons, full games, reviews, feedback, backup and deletion against the API in Docker.
- Also in Chromium, for the device-only risks fixed before the device pass: a damaged or
  unreadable save, per-move storage writes, reloading during the computer's turn (four times in
  one game), resuming two days later with a fake clock, unknown links, and restoring a backup
  with the Enter key.
- Hermes bytecode bundles for iOS and Android compile (`expo export -p ios -p android`).
- `expo prebuild` for both platforms: permissions, Info.plist, entitlements, Sentry upload steps;
  `eas.json` passes Expo's schema.
- The API image in Docker against MongoDB 7, with the deployment smoke test.

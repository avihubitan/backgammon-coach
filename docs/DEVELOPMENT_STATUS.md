# Development status

Short and current, so work can resume quickly. Update it when a milestone moves.

## Milestone: closed beta (20–50 testers)

The code is ready for a first device pass. What's left is mostly accounts, store setup, hosting and
testing on real phones: [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) has the status table.
Nothing has been checked on a physical phone yet.

### Done for the beta
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
1. Accounts: Expo (`eas init`), Apple Developer, Play Console, RevenueCat, Sentry, PostHog. Set the
   EAS environment variables ([DEVICE_TESTING.md](DEVICE_TESTING.md) §1).
2. Preview builds and the device pass on an iPhone and an Android phone.
3. Store products and sandbox purchases; host the privacy policy.
4. Optional for the beta: deploy the API with a managed MongoDB for cloud backup.
5. TestFlight and Play internal testing; invite the first 10 testers ([BETA.md](BETA.md)).

### Blocked here (this environment)
- No Android SDK or Xcode, and `dl.google.com` is blocked, so no native compile or emulator. Native
  builds need EAS (or a Mac and Android Studio).
- Sentry, PostHog and RevenueCat hosts are blocked, so delivery to them can't be checked here.

# Release checklist

What has to be true before a beta and before store submission. `[x]` means done and checked in
the code or the browser; `[ ]` still needs doing or verifying (most need accounts, consoles or a
physical device). Nothing here has been verified on a physical device yet.

## 1. Verify on physical devices (iPhone and Android)

Build with `npx eas-cli@latest build --profile development` (or `preview`) and check on at least one
small iPhone (SE / mini), one large iPhone, and one mid-range Android phone.

- [ ] **Onboarding to first lesson:** fonts load, splash hides, safe areas (notch, home indicator)
      respected, first move works by tap and by drag.
- [ ] **Board:** dragging a checker feels immediate (no lag, no scroll conflict); dice roll, checker
      flights, hits and bear-off animate smoothly at 60 fps on the Android phone.
- [ ] **Game:** a full game against each level; hints, Coach Watch (all three answers), the
      result sheet, the coach review, and resuming a game after killing the app.
- [ ] **Haptics and sound:** feel and loudness; the iOS silent switch mutes sound effects.
- [ ] **Notifications:** turning reminders on shows the system prompt; a reminder arrives at the
      chosen time; it doesn't arrive on a day you already learned; it shows the app icon (iOS) and the
      white checker icon (Android); denying permission shows the "turn them on in Settings" note and
      the button opens the app's settings. Android 13+: the prompt appears.
- [ ] **Purchases (sandbox / license testers):** paywall shows store prices and the trial; buying
      unlocks Premium at once; restoring on a second device works; cancelling shows "ends on …";
      an expired sandbox subscription removes Premium; airplane mode keeps Premium.
- [ ] **Cloud backup:** back up on one phone, restore with the code on another, change both, check
      both end with everything.
- [ ] **Persistence:** progress, streak, settings, board style, mistakes and games survive killing
      the app and rebooting the phone.
- [ ] **Accessibility:** VoiceOver and TalkBack read the board points and buttons; the largest text
      size keeps layouts usable; Reduce Motion calms the board and effects.
- [ ] **Offline:** lessons, games, practice and reviews all work in airplane mode.
- [ ] **Startup time** on the Android phone (cold start to Home) is acceptable.

## 2. iOS (App Store Connect)

- [x] Bundle identifier `com.backgammoncoach.app` (`mobile/app.json`).
- [x] App icon (`assets/expo.icon`) and splash; dark interface style.
- [x] iPad runs full screen (`requireFullScreen`), so a portrait-only app passes validation.
- [x] No export-compliance prompt per build (`usesNonExemptEncryption: false`; HTTPS only).
- [x] No permission prompts except notifications (asked only when the player turns reminders on).
- [ ] `eas init` (adds `extra.eas.projectId`), Apple Developer team, App Store Connect app record.
- [ ] Subscriptions in App Store Connect: `com.backgammoncoach.premium.monthly` and
      `com.backgammoncoach.premium.annual` (7-day free trial) in one subscription group; prices,
      localised names, review screenshot of the paywall.
- [ ] Paid Applications agreement, tax and banking.
- [ ] Privacy nutrition labels (see section 6) and a privacy policy URL.
- [ ] Metadata: name, subtitle, description, keywords, support URL, age rating (no gambling: dice
      are a game mechanic, no real money).
- [ ] Screenshots (6.9" and 6.5" iPhone; 13" iPad, since tablets are supported).
- [ ] Review notes: Premium can be tested with a sandbox account; no login exists.
- [x] Restore purchases is on the paywall and the Premium card.
- [x] Sign in with Apple is not needed: there is no third-party login (backup is an anonymous code).
- [ ] Privacy manifest check: Xcode's privacy report from an archive build lists no unexplained
      required-reason APIs.

## 3. Android (Play Console)

- [x] Package name `com.backgammoncoach.app`.
- [x] Adaptive icon (foreground, background, monochrome) and the notification icon.
- [x] Legacy storage and microphone permissions blocked; requested at runtime: notifications only.
- [ ] Play Console app, internal testing track, license testers.
- [ ] Subscriptions `premium_monthly` and `premium_annual` (base plans; free-trial offer on annual).
- [ ] Data safety form (section 6) and privacy policy URL.
- [ ] Store listing: descriptions, feature graphic, phone screenshots; content rating questionnaire.
- [ ] Target API level matches Play's current requirement (follows the Expo SDK).

## 4. RevenueCat

- [x] App code: `services/purchases/revenueCatProvider.ts` behind `SubscriptionService`; tests with a
      fake SDK.
- [ ] Project with the iOS and Android apps (App Store shared secret / App Store Connect API key;
      Play service-account credentials).
- [ ] Entitlement `premium` attached to both products; current offering with `$rc_monthly` and
      `$rc_annual` packages.
- [ ] Public SDK keys set as EAS environment variables (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`,
      `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`) for preview and production.
- [ ] Optional: RevenueCat webhooks or integrations for revenue analytics.

## 5. Backend (only needed for cloud backup)

- [x] Refuses to start in production without MongoDB; health check pings the database.
- [x] Rate limits (per client with `TRUST_PROXY`), body size limit, input validation.
- [x] Docker image (`backend/Dockerfile`). Not built here: no Docker daemon in this environment.
- [ ] Hosting (any container platform) and managed MongoDB with automatic backups.
- [ ] HTTPS domain; `EXPO_PUBLIC_API_URL` set for preview and production builds.
- [ ] Uptime monitoring on `/v1/health`.

## 6. Privacy model

The app works fully without an account, and collects as little as possible.

| Data | Where it lives | Why | Linked to the person? |
| ---- | -------------- | --- | --------------------- |
| Lessons, XP, streak, games, mistakes, settings | On the device | The app itself | No (never leaves the device) |
| Progress snapshot (cloud backup, opt-in) | Our API (MongoDB) | Restore on another device | Only to an anonymous account; the backup code is stored as a hash |
| Purchase history and an anonymous app user ID | RevenueCat, Apple, Google | Selling and restoring Premium | To the store account (Apple ID / Google account), not to a name or email we hold |
| Analytics events (lesson completed, game finished, paywall viewed, …) with a random install ID | On the device only today; no vendor is connected | Product decisions, once a provider is chosen | No; no names, emails, free text or device identifiers |
| Notification permission | On the device | Daily reminders | No |

- **Not collected:** name, email, phone, location, contacts, photos, device identifiers for
  tracking, advertising IDs. No ads, no tracking, no third-party login.
- **App Store labels (draft):** "Purchases – Purchase history: App functionality, not used for
  tracking" (through RevenueCat); "Other user content: learning progress, app functionality, only
  if backup is turned on". Confirm the exact answers against RevenueCat's privacy guidance before
  submitting.
- **Play data safety (draft):** purchase history (collected, app functionality, encrypted in transit,
  not shared for advertising); app activity / progress for backup (optional, deletable by not
  using backup).
- **Before connecting an analytics or crash-reporting vendor:** update this table, the labels and
  the privacy policy, and keep the "anonymous usage data" switch in Settings honoured (it already
  stops all events).
- **Deletion:** local data is erased by "Reset progress" in Profile. "Delete my backup" in Profile
  deletes the backup and the anonymous account on the server (`DELETE /v1/accounts/me`).

## 7. Beta logistics (20–50 testers)

- [ ] TestFlight external group and Play internal testing track; invite links.
- [ ] Decide what testers get: Premium through sandbox purchases (free in TestFlight), or keep it
      paid to observe the paywall.
- [ ] A way for testers to report issues (a form or email in the store listing).
- [ ] Optional: a crash reporter (for example Sentry) before the beta, so crashes on testers'
      phones are visible; the app already shows a recovery screen instead of a blank one.

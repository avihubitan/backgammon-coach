# Beta readiness report: real device beta

As of 3 October 2026, branch `claude/backgammon-coach-mvp`. "Tested" below means what it says:
**nothing has run on a physical phone yet**, and no native build exists. Browser checks ran the
production web export in Chromium at phone sizes; they're listed as browser checks, not device
tests.

## 1. Build status

No build has been made: EAS needs an Expo account, and this environment has none (no
`EXPO_TOKEN`; `api.expo.dev` is blocked).

Ready and checked offline, on the current code:
- `eas.json`: development (dev client), preview (internal; APK on Android), production
  (auto-incremented build numbers, `appVersionSource: remote`). Passes Expo's schema.
- App config evaluates: Backgammon Coach 1.0.0, `com.backgammoncoach.app` on both platforms, 4
  plugins. `extra.eas.projectId` is not set yet: `eas init` adds it. A simulated `eas init` wrote
  it into `app.json` correctly through `app.config.ts`.
- Hermes bytecode bundles compile for iOS (9.1 MB) and Android (9.3 MB). `expo prebuild` for both
  platforms was checked in an earlier pass (permissions, Info.plist, Sentry upload steps).
- `npm ci` lockfile in sync; expo-doctor passes 19 of 21 checks. The two failures are lookups to
  Expo's and React Native Directory's servers, which this environment blocks.
- New: `npm run check:env -- --profile <name>` checks the services' settings for a build without
  printing them. It also runs on EAS after install and stops a build only for settings that
  would ship a broken or unsafe app.
- Tests: 1,181 mobile tests, typecheck and lint pass; 31 backend tests (MongoDB 7 included);
  the API smoke test passes 10/10 against the API on MongoDB.

## 2. iOS status

Configuration ready, never built. Bundle id, icon, splash, dark interface style, full screen on
iPad, no encryption prompt, notifications as the only permission prompt (no Face ID text).

Needs: an Apple Developer Program membership. Then either register test iPhones
(`npx eas-cli@latest device:create`) and build `--profile preview --platform ios`, or create the
App Store Connect app record and use TestFlight. The first iOS build asks to sign in to Apple
(EAS creates the certificate and provisioning profile), so run it on your own computer.

## 3. Android status

Configuration ready, never built. Package name, adaptive and monochrome icons, notification icon;
unused permissions blocked ("draw over other apps", legacy storage, microphone).

Needs only an Expo account for the first build: `--profile preview --platform android` makes an
APK that installs from a link, and EAS creates and keeps the signing key. The Play Console is needed
later (internal testing track, subscriptions).

## 4. Critical flows tested

| Flow | Physical phone | Browser (Chromium, phone sizes) |
| ---- | -------------- | ------------------------------- |
| Fresh install + onboarding | Not tested | Yes: first open, onboarding, first move by tap and drag, iPhone SE size |
| First lesson | Not tested | Yes: full lesson, wrong and right answers, XP, stars, unlock |
| First game against the computer | Not tested | Yes: complete games; leaving and resuming, including during the computer's turn |
| Coach Watch | Not tested | Yes: it stops before a clear mistake and offers its answers |
| Coach's pick and the daily loop | Not tested | Yes: pick done on Home, daily challenge, streak, freezes; resuming the next day and two days later (fake clock) |
| Game review + mistake practice | Not tested | Yes: review, mistakes, "practise this position" |
| Premium / paywall | Not tested | Simulated store only: paywall, legal links, restore. Real store purchases need a device |
| Also: animations, haptics, touch and drag, keyboard, safe areas, iPhone SE and large layouts, Android back, background/resume, crash recovery, saved progress, streaks, notifications, feedback | Not tested | Partly: small and large phone widths, crash screen, damaged saves, resume, streaks, feedback, unknown links, the restore dialog. Haptics, sound, real touch, the keyboard, safe areas, Android back, notifications and speed on a phone can't be judged in a browser |

[DEVICE_TESTING.md](DEVICE_TESTING.md) has the full device plan (Flows 1–8, offline, speed,
accessibility) and a results table to fill in.

## 5. Bugs found and fixed (this milestone)

Each was reproduced first (in the browser or a unit test), fixed, and covered by a regression test.

| Commit | Bug | Effect on a phone |
| ------ | --- | ----------------- |
| `14bf27e` | A save that couldn't be read (cut short by a crash, or over Android's ~2 MB limit) left the app loading forever | Blank app at every start |
| `14bf27e` | Every move rewrote all finished games (~875 KB, ~295 times a game) | Slow moves, battery, a save that eventually can't be read on Android |
| `14bf27e` | Android back left lessons and games without asking | Lost lesson progress by accident |
| `7ad5cfd` | An unknown link opened the router's developer page, with a sitemap of internal routes | A broken-looking page from an old or mistyped link |
| `1827783` | The iOS keyboard covered the backup restore button; a whole code didn't fit the box | Couldn't restore without closing the keyboard |
| `de94e1b` | Leaving a game during the computer's turn, then resuming, threw inside a timer | Frozen game; in a release build a crash, again at every resume |
| `87a6d6f` | If the phone's notification service failed, the reminder switch and Home's card spun forever | Stuck buttons |
| `906df7e` | An app kept in memory overnight showed yesterday: "Daily goal done", a lost streak still shown | Testers think they're done for the day and lose their streak |

## 6. Bugs remaining

No known open bugs. Known limitations, written up in [BETA_BACKLOG.md](BETA_BACKLOG.md):
- Progress isn't in the phone's own iCloud or Google backup (library defaults); in-app cloud backup
  is the way to move it to a new phone. Whether to change this is a product and privacy decision.
- "Show my backup code" gives no feedback if secure storage fails (rare).
- After resuming mid-turn, the computer replays its whole turn (the board steps back a move).

Where device-only bugs may still hide, because no browser can show them: speed on a low-end
Android phone, drag and gesture feel, haptics and sound timing, safe areas on real hardware, the
keyboard, notification delivery (Android battery savers), store purchases, and start-up time.

## 7. Services configured

In code, tested with fakes, and covered by `npm run check:env`:

| Service | State |
| ------- | ----- |
| RevenueCat | Adapter behind `SubscriptionService`; purchase, restore, pending, offline and "already owned" handled; Test Store keys refused in production builds |
| Sentry | Starts before the app, anonymous (no IP, user, screenshots or device name), follows the usage-data switch; source maps upload when the build has a token |
| PostHog | Created only with consent; no GeoIP, no feature flags or surveys; events mapped to the beta's questions ([BETA.md](BETA.md)) |
| Backend (cloud backup) | Docker image run against MongoDB 7; smoke test 10/10; optional for the beta (hidden when `EXPO_PUBLIC_API_URL` is unset) |
| Notifications | Local only; no push service or account needed |

None has an account or keys yet, so delivery to them hasn't been seen.

## 8. Services still requiring your accounts or credentials

Set every value as an EAS environment variable (`npx eas-cli@latest env:set --environment
preview …`, or on expo.dev), never in git. `EXPO_PUBLIC_` values end up inside the app: public
keys only.

| Service | What you need | Variables |
| ------- | ------------- | --------- |
| Expo (EAS) | Free account; `eas init` | (projectId goes in `app.json`, committed) |
| Apple | Developer Program; App Store Connect app record | none (EAS stores credentials) |
| Google Play | Play Console account and app | none for preview APKs |
| RevenueCat | Project with both apps, entitlement `premium`, offering with `$rc_monthly` and `$rc_annual` | `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (`appl_…`), `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (`goog_…`) |
| Sentry | React Native project; turn on "Prevent storing of IP addresses" | `EXPO_PUBLIC_SENTRY_DSN`; `SENTRY_AUTH_TOKEN` (secret), `SENTRY_ORG`, `SENTRY_PROJECT` |
| PostHog | Project (US or EU); turn on "Discard client IP data" | `EXPO_PUBLIC_POSTHOG_KEY` (`phc_…`), `EXPO_PUBLIC_POSTHOG_HOST` |
| Hosting + MongoDB | Container hosting with HTTPS, managed MongoDB | `EXPO_PUBLIC_API_URL` (https); `MONGODB_URI` as the host's secret |
| Legal pages | Hosted privacy policy (and terms, optional on iOS) | `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL` |

Once a preview build has them, check: a test error in Sentry with readable file names; events in
PostHog with `build_variant = preview`; a sandbox purchase; restore after reinstall; usage data
switched off stops both.

## 9. Store blockers

- **App Store:** Developer membership; app record; subscriptions `com.backgammoncoach.premium.monthly`
  and `.annual` (7-day trial) in one group; Paid Applications agreement, tax and banking; privacy
  labels (drafted in [PRIVACY.md](PRIVACY.md)); privacy policy and support URLs; screenshots (6.9",
  6.5", 13" iPad); age rating; review notes. TestFlight external testers need Beta App Review
  (internal testers don't).
- **Google Play:** Console account; app; internal testing track and license testers;
  subscriptions `premium_monthly` and `premium_annual` (trial offer on annual); Data safety form
  (drafted); content rating; listing, feature graphic, screenshots. A new personal developer
  account must run a closed test with at least 12 testers for 14 days before it can publish to
  production (internal testing isn't affected).

## 10. Privacy and legal blockers

- The privacy policy is a draft ([PRIVACY.md](PRIVACY.md)): it needs review, hosting and a contact
  email. It doesn't claim compliance with any law.
- Decide consent for the EU and UK: usage data is on by default with a switch to turn it off.
- Set PostHog and Sentry data retention; turn on their IP settings (above).
- Deleting usage data and crash reports happens on request, and the app doesn't show the install
  id needed for one (backlog).
- Age rating: the app isn't aimed at children; dice are a game mechanic, no real-money gambling.
- Decide whether progress should go into the phone's own backups (today it doesn't).

## 11. Backend blockers

Only needed if testers should have cloud backup; the app works fully without it.
- A host for the Docker image with an HTTPS domain; `TRUST_PROXY=1` behind its load balancer.
- Managed MongoDB with automatic backups, in the region the privacy policy names; `MONGODB_URI` as
  the host's secret.
- Uptime monitoring on `/v1/health`; log retention set.
- `API_URL=https://… npm run smoke` against the deployment, then `EXPO_PUBLIC_API_URL` for preview
  and production.

## 12. Exact next action for you

1. Create a free Expo account at expo.dev.
2. On your computer, from the repository:
   ```bash
   cd mobile
   npm ci
   npx eas-cli@latest login
   npx eas-cli@latest init        # say yes to creating @<you>/backgammon-coach
   git add app.json && git commit -m "Link the EAS project" && git push
   npx eas-cli@latest build --profile preview --platform android
   ```
3. Install the APK from the build's link on an Android phone and run
   [DEVICE_TESTING.md](DEVICE_TESTING.md) Flows 1–4, 6 and 8; fill in the results table (§8) and
   send it back. Sentry isn't connected yet, so describe any crash in words: what you did and what
   happened.
4. In parallel, enrol in the Apple Developer Program, so the iPhone preview build can follow.

To have the next build made from a cloud session instead, add an Expo access token as the
environment variable `EXPO_TOKEN` and allow `api.expo.dev`, `expo.dev` and `storage.googleapis.com`
in the environment's network settings ([DEVICE_TESTING.md](DEVICE_TESTING.md), top). The device
pass itself still needs your phones.

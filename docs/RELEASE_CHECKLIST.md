# Release checklist

What has to be true before the closed beta (TestFlight and Play internal testing) and later the
store release. "Done" means done and checked in code, tests, the browser, generated native projects
or Docker, as noted. Nothing has been checked on a physical phone yet:
[DEVICE_TESTING.md](DEVICE_TESTING.md) is that plan. Privacy details are in [PRIVACY.md](PRIVACY.md).

## Status

| Item | Status | Notes |
| ---- | ------ | ----- |
| App icon and splash | Done | iOS icon, Android adaptive and monochrome icons, notification icon |
| Bundle id / package | Done in config | `com.backgammoncoach.app` on both; not yet registered with Apple or Google |
| Version and build numbers | Done in config | 1.0.0; EAS manages build numbers (`appVersionSource: remote`) once `eas init` has run |
| EAS profiles | Checked offline | development, preview, production; pass Expo's `eas.json` schema; never built (needs an Expo account: `eas init`) |
| Build environment check | Done | `npm run check:env -- --profile <name>`; also runs on EAS after install and stops a build with unsafe or broken service settings |
| Native config | Checked offline | `expo prebuild` for iOS and Android; permissions and Info.plist reviewed; Hermes bundles compile |
| Development build | Not done | Needs `eas init`, Apple Developer account, registered iPhones |
| TestFlight | Not done | Needs the App Store Connect app record |
| Google Play internal testing | Not done | Needs a Play Console app |
| RevenueCat | Code done | Products, entitlement and keys not set up; Test Store keys refused in production builds |
| Subscriptions in the stores | Not done | Monthly and annual (7-day trial on annual) |
| Paywall terms and links | Done in code | Renewal terms, restore, Terms of Use and Privacy Policy links (needs `EXPO_PUBLIC_PRIVACY_URL`) |
| Privacy policy | Draft | [PRIVACY.md](PRIVACY.md); needs review, hosting and a contact email |
| Crash reporting | Code done | Sentry; needs a project, DSN and auth token; not seen working on a phone |
| Analytics | Code done | PostHog; needs a project and key; not seen working on a phone |
| In-app feedback | Done | Rating after lessons and games, "Send feedback" in Profile |
| Notifications | Code done | Local reminders; tap opens Home; test reminder in preview builds; not checked on a phone |
| Cloud backend | Checked in Docker | Image + MongoDB 7 + smoke test; no hosting, managed database or HTTPS domain yet |
| Backup deletion | Done | In the app and the API |
| Real device testing | Not done | Waits for the first preview build; [DEVICE_TESTING.md](DEVICE_TESTING.md) has the plan and a results table. Device-only risks found by review and in the browser are fixed (see [BETA_READINESS.md](BETA_READINESS.md)) |
| App Store screenshots | Not done | 6.9" and 6.5" iPhone; 13" iPad |
| Play Store screenshots and feature graphic | Not done | |
| Store listings, age ratings | Not done | |

## 1. iOS (App Store Connect)

- [x] Bundle identifier `com.backgammoncoach.app` (`mobile/app.json`).
- [x] App icon (`assets/expo.icon`), splash, dark interface style.
- [x] iPad runs full screen (`requireFullScreen`), so a portrait-only app passes validation.
- [x] No export-compliance prompt per build (`usesNonExemptEncryption: false`; HTTPS only).
- [x] Permission prompts: notifications only (when reminders are turned on). No Face ID string
      (removed: the app never uses biometrics).
- [x] Restore purchases on the paywall and the Premium card; Terms of Use (Apple's standard EULA by
      default) and Privacy Policy links on the paywall.
- [x] Sign in with Apple not needed: no third-party login (backup uses an anonymous code).
- [x] Account deletion (guideline 5.1.1(v)): the anonymous backup account can be deleted in the app.
- [ ] `eas init` (adds `extra.eas.projectId`), Apple Developer team, App Store Connect app record.
- [ ] Subscriptions: `com.backgammoncoach.premium.monthly` and `com.backgammoncoach.premium.annual`
      (7-day free trial) in one subscription group; prices, localised names, the paywall screenshot
      for review.
- [ ] Paid Applications agreement, tax and banking.
- [ ] Privacy labels ([PRIVACY.md](PRIVACY.md)), privacy policy URL, support URL.
- [ ] Metadata: name, subtitle, description, keywords, age rating (dice are a game mechanic; no
      real-money gambling).
- [ ] Screenshots.
- [ ] Review notes: Premium can be tested with a sandbox account; no login exists.
- [ ] After the first archive build: Xcode's privacy report lists no unexplained required-reason
      APIs (React Native gathers the libraries' privacy manifests during `pod install`).
- [ ] TestFlight: an external group, its review (needs test information and a contact email).

## 2. Android (Play Console)

- [x] Package `com.backgammoncoach.app`; adaptive and notification icons.
- [x] Blocked: legacy storage, microphone and "draw over other apps". Expected after the manifest
      merge: internet, network state, vibrate, notifications (prompt on 13+), boot completed (to
      keep reminders after a restart), audio settings, billing. Check the list on the first upload.
- [ ] Play Console app, internal testing track, license testers.
- [ ] Subscriptions `premium_monthly` and `premium_annual` (base plans; a free-trial offer on annual).
- [ ] Data safety form ([PRIVACY.md](PRIVACY.md)) and privacy policy URL.
- [ ] Store listing, feature graphic, phone screenshots, content rating questionnaire.
- [ ] Target API level meets Play's current requirement (it follows the Expo SDK).

## 3. RevenueCat

- [x] App code: `services/purchases/revenueCatProvider.ts` behind `SubscriptionService`; tests with a
      fake SDK; production builds ignore Test Store keys.
- [ ] Project with the iOS and Android apps (App Store Connect API key or shared secret; Play
      service-account credentials).
- [ ] Entitlement `premium` attached to both products; a current offering with `$rc_monthly` and
      `$rc_annual` packages.
- [ ] Public SDK keys as EAS environment variables for preview and production (Test Store key for
      development if wanted).

## 4. Crash reporting and analytics

- [ ] Sentry project (React Native). DSN as `EXPO_PUBLIC_SENTRY_DSN`; `SENTRY_AUTH_TOKEN` (secret),
      `SENTRY_ORG`, `SENTRY_PROJECT` for preview and production builds, so source maps and debug
      symbols upload. Turn on "Prevent storing of IP addresses".
- [ ] PostHog project (US or EU). `EXPO_PUBLIC_POSTHOG_KEY` and `EXPO_PUBLIC_POSTHOG_HOST`; turn on
      "Discard client IP data"; build the dashboard in [BETA.md](BETA.md).
- [ ] `npx eas-cli@latest env:pull --environment preview && npm run check:env -- --profile preview`
      shows no errors (then the same for production).
- [ ] On a preview build: a test error appears in Sentry with readable file names; events appear in
      PostHog with `build_variant = preview`.
- [ ] Turn "Share anonymous usage data" off on a phone: no new events in PostHog and no new Sentry
      reports (native crash handling stops completely from the next start).

## 5. Backend (only needed for cloud backup)

- [x] Refuses to start in production without MongoDB; health check pings the database (503 within
      3 s when it can't); requests fail after 5 s instead of 30.
- [x] Rate limits (per client with `TRUST_PROXY`), body size limit, input validation, JSON logs
      without IPs or codes, backup deletion.
- [x] Docker image built and run with MongoDB 7; `npm run smoke` passes against it.
- [ ] Managed MongoDB with automatic backups, in the region the privacy policy names.
- [ ] Hosting for the container, an HTTPS domain, `EXPO_PUBLIC_API_URL` for preview and production.
- [ ] `MONGODB_URI` stored as the platform's secret, never in git; `TRUST_PROXY=1` behind its load
      balancer; `CORS_ORIGINS` left empty (native apps don't need it).
- [ ] Health check and uptime monitoring on `/v1/health`; log retention set.
- [ ] `API_URL=https://… npm run smoke` against the deployed API.

## 6. Beta logistics (20–50 testers)

- [ ] TestFlight external group and Play internal testing track; invite links.
- [ ] Decide what testers get: Premium through sandbox purchases (free in TestFlight) or keep it paid
      to watch the paywall. See [BETA.md](BETA.md).
- [ ] A contact email for testers, in the invite and the store listing.
- [ ] Decide whether progress should go into the phone's own iCloud/Google backup (today it
      doesn't; [BETA_BACKLOG.md](BETA_BACKLOG.md)).
- [ ] Before the public release: switch off the daily "How was this?" question
      (`QUICK_FEEDBACK_ENABLED`) and settle the open decisions in [PRIVACY.md](PRIVACY.md).

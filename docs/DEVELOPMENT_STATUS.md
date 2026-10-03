# Development status

Short and current, so work can resume quickly. Update it when a milestone moves.

## Milestone: production beta (20–50 testers for several days)

Code-side, the beta milestone is close: everything below is done, tested and checked in the browser.
What remains is mostly outside the code (accounts, store setup, physical-device verification); see
[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

### Done for the beta
- **Builds:** `mobile/eas.json` (development client, internal preview, production), `expo-dev-client`;
  `app.json` iPad full screen, no export-compliance prompt, legacy Android permissions blocked,
  notification icon. Unused native packages removed.
- **Resilience:** crash screen (root `ErrorBoundary`); saved data checked on load
  (`state/sanitize.ts`): a damaged field falls back to its default, the rest is kept.
- **Free experience:** full games open after "Meet the Board" (`playAccess`: locked / early / open),
  with an early-player note and a bear-off tip in games.
- **Monetization:** RevenueCat behind `SubscriptionService` (env keys), store updates followed,
  honest restore errors, offline grace of 3 days, cancellation and billing-issue states on the
  Premium card, paywall retry.
- **Coach:** Coach Watch (clue first, then try again / show me / play anyway; 3 per game free);
  review shows what could have happened (shots; winning chances with Premium) and "Practise this
  position"; Coach's pick ranks recent patterns and weak skills and has a "done for today" state.
- **Accessibility:** board points described for screen readers; text scales up to 1.6×.
- **Small screens:** the game board narrows on short screens so coach messages fit.
- **Backend:** requires MongoDB in production, `TRUST_PROXY`, DB-pinging health check, Dockerfile.
- **Docs:** README for new developers, release checklist with privacy model and device test list.

### Next recommended
1. Physical-device pass (section 1 of the release checklist), starting with notifications and
   purchases on an iPhone and an Android phone.
2. Store and RevenueCat setup (sections 2–4), then a TestFlight / internal-testing build.
3. Pick a crash reporter and an analytics vendor; update the privacy model when they're connected.
4. A backup deletion endpoint before public launch.
5. Polish candidates from the audit: Profile shows "Go Premium" second for brand-new players;
   onboarding's path list needs a scroll on the smallest phones.

### Known blockers outside the code
- EAS project (`eas init`), Apple Developer and Play Console accounts, store products, RevenueCat
  project and keys.
- Backend hosting with a managed MongoDB (only needed for cloud backup).
- Nothing has been verified on a physical device yet.

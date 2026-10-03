# Closed beta: plan and metrics

A closed beta with 20–50 testers, for about two weeks, before any public launch. Its job is to
learn whether beginners understand the app, keep coming back and use the coach. Revenue is not a
goal yet: don't tune the paywall before people clearly want the product.

## What the beta must answer

| Question | Where the answer comes from |
| -------- | --------------------------- |
| 1. Do beginners understand the app? | Activation funnel; onboarding drop-off; feedback after the first lessons |
| 2. Do they finish the first lessons? | `lesson_completed` for the first section; `lesson_exited` and `lesson_failed` by lesson |
| 3. Do they come back? | Day 1 / 3 / 7 retention; sessions per week |
| 4. Do they play complete games? | `game_started` → `game_completed`; games per user |
| 5. Do they use the coach? | Coach Watch, reviews, mistake practice, Coach's pick (below) |
| 6. Do they understand Premium? | Paywall views by source, feedback, and interviews (numbers alone can't say) |
| 7. Are there crashes? | Sentry: crash-free sessions and users per build; `app_error` in PostHog |
| 8. Where do they get stuck? | `lesson_exited` (lesson and step), `exercise_failed` (step), feedback text |

## Metrics

Events are defined in `mobile/src/services/analytics/events.ts`. They're anonymous: a random
install id per phone, no names, emails or device identifiers. Each event also carries PostHog's
session id, app version and OS, plus `build_variant` (development, preview or production).

Start with one PostHog dashboard holding these insights. Filter to `build_variant = production`
(TestFlight and Play testing builds), or `preview` for internal builds.

### Activation

- **Funnel** (per person, within 3 days): `app_opened` where `first_open = true` →
  `onboarding_completed` → `lesson_completed` where `replay = false`.
- **Onboarding drop-off:** funnel `onboarding_started` → `onboarding_completed`.

### Learning

- **Lessons per session:** total `lesson_completed` ÷ total `app_opened` per week (a formula).
- **Sessions per week:** `app_opened`, average count per person, weekly.
- **Progress through the course:** `section_unlocked` broken down by `section_id`; and the share of
  testers who unlocked each section.
- **Accuracy:** average `accuracy` of `lesson_completed`, by `section_id`.
- **Stuck points:** `lesson_exited` by `lesson_id` and `step_index`; `lesson_failed` by `lesson_id`;
  `exercise_failed` by `step_id`.

### Games

- **Games per person and per week:** `game_completed`, total and average per person.
- **Finish rate:** `game_started` → `game_completed` (funnel, same session).
- **Game length:** average and median `duration_s` of `game_completed`, by `level`.
- **Move quality:** average `move_quality` of `game_reviewed` per week, by `level`.

### Coach

- **Coach Watch:** `coach_watch_triggered` per game; acceptance =
  `coach_watch_accepted` ÷ (`coach_watch_accepted` + `coach_watch_ignored`). A low acceptance rate
  means it interrupts too much.
- **Reviews:** `coach_review_opened` ÷ `game_completed`.
- **Mistake practice:** people with `mistake_practiced` ÷ people with a `game_reviewed` that had
  mistakes; share with `fixed = true`.
- **Coach's pick:** `coach_pick_opened` per active person per day; completion =
  `coach_pick_completed` ÷ `coach_pick_opened`.
- **Hints:** `game_hint_used` per game, and `hints_used` on `game_completed`.

### Retention

- **Retention insight:** first event `app_opened` with `first_open = true`, returning event
  `app_opened`, daily: read Day 1, Day 3 and Day 7. (A session starts on a cold start and after
  30 minutes away, so returning to an app kept in memory still counts.)
- **Streaks:** `streak_freeze_used` and `streak_freeze_earned` show who keeps a streak going.
- **Reminders:** `notification_enabled` rate, and `notification_opened` per reminder-enabled person.

### Monetization (observe only)

- **Paywall view rate:** people with `paywall_viewed` ÷ active people, broken down by `source`.
- **Trial starts:** `subscription_started` where `trial = true` ÷ people with `paywall_viewed`.
- **Conversion:** `purchase_completed` ÷ people with `paywall_viewed`. RevenueCat's dashboard is the
  source of truth for trials, renewals and refunds.

### Stability and speed

- **Sentry:** crash-free sessions and crash-free users per release; new issues per build.
- **Start-up:** median and 90th percentile of `startup_ms` on cold `app_opened`, by OS (JavaScript
  start to first screen). Sentry's app-start timing covers the native part on sampled sessions.

### Initial targets (guesses to revisit after the first week)

| Metric | Worrying below |
| ------ | -------------- |
| Install → first lesson completed | 60% |
| Day 1 retention | 35% |
| Day 7 retention | 15% |
| Started games that finish | 60% |
| Coach Watch acceptance | 40% |
| Crash-free sessions | 99% |

## Feedback from testers

- **After a lesson or a game:** "How was this lesson/game?" with three choices (good, okay, not
  good), at most once a day. "Okay" and "not good" open a box: "What could be better?". Events:
  `feedback_rated` (context, rating, lesson id or computer level) and `feedback_submitted` (the
  text). Switch it off for the public release (`QUICK_FEEDBACK_ENABLED` in
  `features/feedback/feedbackPolicy.ts`).
- **Any time:** Profile → "Send feedback", with the app version shown underneath (testers can quote
  it in bug reports).
- Both go through analytics, so they need "Share anonymous usage data" on (the dialog says so when
  it's off) and a PostHog key in the build. Testers are asked not to include personal details.
- **Reading it:** in PostHog, list `feedback_submitted` events (text, context, subject) and chart
  `feedback_rated` by rating and context, daily.
- **Talk to people too:** a 15-minute call with 5–8 testers at the end of the first week answers
  "do they understand Premium?" and "where do they get stuck?" better than any chart.

## Onboarding experiment (later)

Don't run A/B tests in a beta of 50: the groups are too small to tell anything apart. Measure the
current onboarding first (activation funnel above). If many testers drop before the first lesson,
the candidates are: (A) start learning immediately, (B) one tiny game interaction first. PostHog
feature flags can split them later; the app turns flags off today (`posthogClient.native.ts`).

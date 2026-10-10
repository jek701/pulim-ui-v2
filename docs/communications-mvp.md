# Pulim Communications MVP

## Problem

Pulim can send transactional Telegram reminders, but the owner has no safe way to announce features or send targeted in-app messages. Users also lack a dedicated inbox and separate controls for marketing communication.

## Goals

- Let the owner create localized campaigns without server access.
- Deliver campaigns through in-app messages and opt-in Telegram.
- Support immediate and scheduled delivery with deterministic deduplication.
- Measure delivery, reads, clicks, and dismissals.
- Keep marketing preferences separate from financial reminders.

## User stories

- As the owner, I want to prepare one campaign in Russian, Uzbek, and English so that every recipient sees the right language.
- As the owner, I want to target plan, language, and Telegram-link segments so that a message is relevant to its audience.
- As the owner, I want to send now or schedule a campaign so that releases do not require production shell access.
- As a user, I want a durable inbox so that I can return to announcements after dismissing a banner.
- As a user, I want separate in-app and Telegram marketing controls so that changing them does not disable important financial reminders.
- As the owner, I want delivery and engagement counts so that I can judge whether a campaign worked.

## Non-goals

- Email, SMS, web push, A/B tests, journey builders, and WYSIWYG editing.
- Behavioural segments such as “inactive for N days” until reliable activity data exists.
- Automatic balance-changing actions from campaign CTAs.

## P0 requirements

- Owner-only campaign admin protected by the existing owner UID allowlist.
- RU/UZ/EN title and body, optional localized CTA, audience filters, channels, and presentation mode.
- Draft, scheduled, sending, paused, completed, and failed states.
- In-app inbox plus banner/modal presentation for unread messages.
- Telegram delivery through the existing durable notification queue.
- User settings: in-app marketing on by default; Telegram marketing off by default.
- Idempotent fan-out and per-message read/click/dismiss metrics.

## P1 requirements

- Reusable campaign drafts and editable scheduled campaigns.
- Richer audience estimates before publication.
- A campaign detail view with delivery failures grouped by reason.

## Acceptance criteria

- A non-owner receives a hidden/404 admin API and never sees the admin UI.
- Publishing a campaign twice does not duplicate an in-app message or Telegram job.
- A scheduled campaign is claimed by one worker and eventually reaches a terminal state.
- Users receive content in their profile language with English fallback.
- Disabling a marketing channel prevents new delivery through that channel.
- Only one unread banner/modal is presented at a time; all messages remain available in the inbox.
- Admin statistics report audience, in-app delivery, Telegram queued/sent/failed, seen, clicked, and dismissed counts.

## Success metrics

- 95%+ of eligible in-app recipients receive a campaign record.
- No duplicate deliveries for the same campaign, user, and channel.
- Delivery/read/click counters reconcile with deterministic delivery records.
- Campaign creation and publication require no production shell access.

Leading indicators are successful campaign creation, percentage delivered in-app, Telegram queue success, and click/read rate in the first seven days. Lagging indicators are repeat use by the owner and lower reliance on one-off manual announcements.

## Open questions

- Product: which campaigns should count as mandatory service communication rather than marketing?
- Data: which reliable activity signal should power “inactive for N days” segments in phase 2?
- Legal: whether future commercial Telegram campaigns need additional consent wording for each supported market.

None of these questions blocks the MVP because it sends only optional marketing content and defaults Telegram marketing to off.

## Timeline and rollout

1. Deploy the API and worker support with no campaigns present.
2. Deploy the inbox, banner/modal renderer, preferences, and hidden owner UI.
3. Create an in-app-only owner test campaign before enabling any broader campaign.
4. Add Telegram only after the owner verifies opt-in behavior and delivery counters.

## Phase 2

- Activity-based segments, reusable templates, automated lifecycle journeys, A/B tests, web push, and richer conversion attribution.

# Daily delivery plan

Status: Day 1 design complete. Day 2 is next; application implementation is pending. See [decisions](DAY_01_DECISIONS.md) and [dashboard sketch](DASHBOARD_SKETCH.md).

Scope update: prioritize the [content engagement requirements](CONTENT_ENGAGEMENT.md). Days 1–3 must include video measurement definitions/contracts, Days 4–5 include a player prototype, and Day 9 is split into 9A–9C below. Provisionally allow 2–4 additional working days and revisit the estimate after Day 5.

This plan implements the [proposal](PROPOSAL.md) using Angular, Node.js, PostgreSQL, and a standalone browser tracker. Start with a private, single-owner tool for multiple websites; confirm that assumption on Day 1. Session replay remains a separate future phase.

## How we will work

Each day has one main outcome and a short completion check. At the start of a session, read the [progress tracker](PROGRESS.md) and choose the next unfinished task. At the end, demonstrate the outcome, run relevant checks, and record what actually passed. Do not advance a checkbox merely because code was written.

Days are ordered work packages, not booked calendar dates or promises to finish in one sitting. The original 1–2 week MVP and 3–5 week release estimates assume near-full-time work with AI assistance. Shorter daily sessions extend the calendar schedule. If a package is too large, split it into A/B sessions and keep the same completion criterion.

Use feature branches and small PRs. Keep each change runnable, include documentation updates with behavior changes, and retain this plan in `main` when its PR merges. A daily session does not require a deployment. No production collection begins as part of routine development.

## Days 1–5: prove the data flow

### Day 1 — Agree on the smallest useful product

- [x] Confirm single-owner access, first two sites, and the three most important reports.
- [x] Decide expected event volume, retention period, session expiration, reporting time zone, and consent defaults. Record provisional assumptions where measurements are unavailable.
- [x] Choose the Node.js framework, migrations, backend source language, and owner authentication approach. Sketch the dashboard's project selector, date filter, overview, and event timeline.

**Done when:** a short decisions document and dashboard sketch describe what we are building; unresolved decisions have an owner and do not silently become requirements.

### Day 2 — Make the development workspace run

- [ ] Scaffold the Angular dashboard, Node.js API, tracker package, and shared event contracts.
- [ ] Provide isolated development PostgreSQL, an initial migration, and safe example configuration without real credentials.
- [ ] Add startup, lint/type-check, and focused-test commands plus basic CI.

**Done when:** the setup instructions start a dashboard placeholder and API health endpoint; a clean development database can be initialized without touching MediaSpace or production.

### Day 3 — Store a valid event

- [ ] Define the first versioned event schema and project/event tables.
- [ ] Add batch collection with schema, size, timestamp, and property limits; use parameterized database writes.
- [ ] Seed two development projects and reject unknown/disabled projects. Define origin checks and deduplication boundaries.

**Done when:** a valid test request creates the expected rows; malformed/oversized requests fail; replaying an event ID does not duplicate it within its project.

### Day 4 — Send events from a real browser

- [ ] Build a framework-independent script that accepts a site ID and collection URL.
- [ ] Add explicit start/stop consent hooks, sanitized page/referrer data, anonymous sessions, and bounded event batching.
- [ ] Connect a small static test website; keep collection off until the test visitor permits it.

**Done when:** a permitted visit appears in PostgreSQL, a denied visit sends no analytics events, and a failed collection request does not break the page.

### Day 5 — Verify the prototype and revisit the estimate

- [ ] Add client-side route-change tracking, bounded retry/backoff, and best-effort page-exit delivery.
- [ ] Exercise reload, back/forward navigation, duplicate retries, session expiration, consent withdrawal, and excluded URLs.
- [ ] Read back known totals with a development-only query or localhost-only endpoint; do not expose reporting publicly before authentication is ready.

**Done when:** browser → API → database → count is demonstrated against known expected results. Record actual effort and revise the remaining estimate if needed.

## Days 6–10: make the MVP useful

### Day 6 — Protect the dashboard and manage projects

- [ ] Implement owner login/logout and server-side protection for administration/reporting APIs using the Day 1 decision.
- [ ] Create/edit projects, allowed origins, and collection enable/disable settings; show a copyable installation snippet.
- [ ] Verify project IDs cannot bypass dashboard authentication or select another project's records accidentally.

**Done when:** the owner can manage two projects, anonymous reporting/admin requests are rejected, and disabling a project stops event acceptance.

### Day 7 — Build trustworthy traffic reports

- [ ] Implement project/date-scoped queries for page views, sessions, popular pages, referrers, and daily trends.
- [ ] Define date boundaries, missing referrers, session counting, and reporting freshness.
- [ ] Test results with a fixture dataset containing two projects and time-zone boundary cases.

**Done when:** report totals match the fixture exactly and no report mixes project data.

### Day 8 — Show the reports in Angular

- [ ] Build project/date selectors, summary cards, one trend chart, and popular-page/referrer tables.
- [ ] Add loading, empty, and failure states; make the main views usable on smaller screens and by keyboard.
- [ ] Connect the real reporting API rather than leaving demonstration numbers in the UI.

**Done when:** selecting a project or date range displays the expected real data and handles an unavailable API clearly.

### Day 9 — Add interaction analytics

Split this work into separate sessions: **9A** implement and test player watch-time/coverage measurements; **9B** add sharing outcomes and idempotent aggregation; **9C** deliver content-performance, video-engagement, and anonymous session reports. Use the acceptance scenarios in [CONTENT_ENGAGEMENT.md](CONTENT_ENGAGEMENT.md). The original click/scroll tasks below remain in scope.

- [ ] Track explicitly marked clicks and custom events without scraping arbitrary text or input values.
- [ ] Add deduplicated scroll milestones for the document and configured scroll containers; define behavior when content grows.
- [ ] Add event counts, scroll engagement, and a paginated anonymous session timeline to reporting/dashboard views.

**Done when:** a controlled browser journey produces the expected click and scroll events once, and its timeline can be inspected in the dashboard. This is an event timeline, not replay video.

### Day 10 — Pilot with MediaSpace and a second website

- [ ] Integrate on a MediaSpace development branch with recording disabled by default; keep Fullstory disabled to avoid duplicate collection.
- [ ] Verify public media overlays, sharing/navigation actions, and the internal video-feed scroll container.
- [ ] Exclude admin sessions and protected/unlisted content; verify the same tracker on the independent static website.

**Done when:** two sites report separately, MediaSpace's key interactions are visible, and consent/exclusion checks pass. Review the MVP together and write down what stays out of the first release.

## Days 11–15: prepare a dependable release

### Day 11 — Check privacy and difficult browser behavior

- [ ] Test stored/withdrawn consent, unavailable browser storage, multi-tab behavior, and navigation into excluded pages.
- [ ] Inspect actual request payloads for sensitive URL data, form values, identifiers, and protected content.
- [ ] Exercise the agreed desktop/mobile browser matrix and document collection limitations.

**Done when:** the agreed cases pass or have explicit release blockers; privacy documentation matches the observed behavior.

### Day 12 — Bound traffic and measure performance

- [ ] Harden rate limits, request/queue bounds, retry behavior, and abuse handling; origin checks are not treated as authentication.
- [ ] Load-test against Day 1's numerical target and measure tracker size, request overhead, API latency, and database growth.
- [ ] Add or adjust indexes based on query evidence; avoid new infrastructure unless measurements require it.

**Done when:** limits work under excessive input and measurements meet the agreed target, or the supported target is explicitly reduced before release.

### Day 13 — Manage the data lifecycle

- [ ] Implement scheduled retention cleanup and authenticated project-data deletion with deliberate confirmation.
- [ ] Verify old events expire without removing recent or other-project data.
- [ ] Configure development backup/restore and restore into an isolated database to verify reports.

**Done when:** deletion boundaries, retention, and a real restoration are demonstrated and documented.

### Day 14 — Rehearse deployment and recovery

- [ ] Package Angular assets and the Node.js service; configure staging HTTPS, process management, and restricted database access.
- [ ] Add health checks, useful logs without sensitive event payloads, owner recovery instructions, and tracker-version compatibility guidance.
- [ ] Document and rehearse migration, rollback, and collection-disable procedures.

**Done when:** staging can be installed from the documented steps, survives a service restart, and can be rolled back without depending on MediaSpace's deployment.

### Day 15 — Review the release candidate

- [ ] Walk through every acceptance criterion in the proposal and link the evidence.
- [ ] Fix release-blocking issues and record known limitations and operating capacity.
- [ ] Prepare the exact production configuration, migration steps, and rollout/rollback plan for review.

**Done when:** a concrete release candidate is ready for the owner's production rollout decision. Do not enable production collection merely because the calendar reached this day.

## Days 16–25: contingency and stabilization

Reserve this time within the original 3–5 week estimate for issues discovered during integration, browser testing, load tests, or deployment. It is not an invitation to add replay, billing, heatmaps, or public customer accounts.

After an authorized production pilot, use small daily tasks to compare expected and observed events, watch resource use, verify retention jobs and backups, and repair proven issues. If no blockers remain earlier, do not manufacture work to fill the buffer. If blockers need more time, revise the forecast rather than skipping release criteria.

## Daily handoff

Keep the completion history and latest handoff in [PROGRESS.md](PROGRESS.md), so there is one place to resume work. Keep this plan's task checkboxes consistent with that tracker. A useful handoff answers: what changed, what was verified, what remains uncertain, and the first action for the next session.

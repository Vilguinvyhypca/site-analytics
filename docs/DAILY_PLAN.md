# Daily delivery plan

Status: Days 1–10 complete locally for the agreed native-video development scope; Mux production integration is deferred. Day 12 query-index review and Day 13 data lifecycle are verified locally. Day 11 browser/device coverage remains partial; Day 14 staging/recovery and Day 15 release review are still open. Day 5 player evidence and remaining risks are in [the prototype report](PLAYER_PROTOTYPE.md). See [development setup](DEVELOPMENT.md), [decisions](DAY_01_DECISIONS.md), and [dashboard sketch](DASHBOARD_SKETCH.md).

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

- [x] Scaffold the Angular dashboard, Node.js API, tracker package, and shared event contracts.
- [x] Provide isolated development PostgreSQL, an initial migration, and safe example configuration without real credentials.
- [x] Add startup, lint/type-check, and focused-test commands plus basic CI.

**Done when:** the setup instructions start a dashboard placeholder and API health endpoint; a clean development database can be initialized without touching MediaSpace or production.

### Day 3 — Store a valid event

- [x] Define the first versioned event schema and project/event tables.
- [x] Add batch collection with schema, size, timestamp, and property limits; use parameterized database writes.
- [x] Seed two development projects and reject unknown/disabled projects. Define origin checks and deduplication boundaries.

**Done when:** a valid test request creates the expected rows; malformed/oversized requests fail; replaying an event ID does not duplicate it within its project.

### Day 4 — Send events from a real browser

- [x] Build a framework-independent script that accepts a site ID and collection URL.
- [x] Add explicit start/stop consent hooks, sanitized page/referrer data, anonymous sessions, and bounded event batching.
- [x] Connect a small static test website; keep collection off until the test visitor permits it.

**Done when:** a permitted visit appears in PostgreSQL, a denied visit sends no analytics events, and a failed collection request does not break the page.

### Day 5 — Verify the prototype and revisit the estimate

- [x] Add client-side route-change tracking, bounded retry/backoff, and best-effort page-exit delivery.
- [x] Exercise reload, back/forward navigation, duplicate retries, session expiration, consent withdrawal, and excluded URLs.
- [x] Read back known totals with a development-only query or localhost-only endpoint; do not expose reporting publicly before authentication is ready.

- [x] Prototype native-video and Mux player measurements from the content-engagement scope update; record risks and revise the estimate.

**Done when:** browser → API → database → count is demonstrated against known expected results. Record actual effort and revise the remaining estimate if needed.

## Days 6–10: make the MVP useful

### Day 6 — Protect the dashboard and manage projects

- [x] Implement owner login/logout and server-side protection for administration/reporting APIs using the Day 1 decision.
- [x] Create/edit projects, allowed origins, and collection enable/disable settings; show a copyable installation snippet.
- [x] Verify project IDs cannot bypass dashboard authentication or select another project's records accidentally.

**Done when:** the owner can manage two projects, anonymous reporting/admin requests are rejected, and disabling a project stops event acceptance.

### Day 7 — Build trustworthy traffic reports

- [x] Implement project/date-scoped queries for page views, sessions, popular pages, referrers, and daily trends.
- [x] Define date boundaries, missing referrers, session counting, and reporting freshness.
- [x] Test results with a fixture dataset containing two projects and time-zone boundary cases.

**Done when:** report totals match the fixture exactly and no report mixes project data.

### Day 8 — Show the reports in Angular

- [x] Build project/date selectors, summary cards, one trend chart, and popular-page/referrer tables.
- [x] Add loading, empty, and failure states; make the main views usable on smaller screens and by keyboard.
- [x] Connect the real reporting API rather than leaving demonstration numbers in the UI.

**Done when:** selecting a project or date range displays the expected real data and handles an unavailable API clearly.

### Day 9 — Add interaction analytics

- [x] 9A: native-video adapter, consent/lifecycle handling, bounded cumulative delivery and real browser-to-database verification. Mux production integration is deferred per owner direction.
- [x] 9B: sharing actions and idempotent playback aggregation.
- [x] 9C: content/video/session reports.

The original click/custom-event and scroll tasks below are now verified locally; real site integration is Day 10.

Split this work into separate sessions: **9A** implement and test player watch-time/coverage measurements; **9B** add sharing outcomes and idempotent aggregation; **9C** deliver content-performance, video-engagement, and anonymous session reports. Use the acceptance scenarios in [CONTENT_ENGAGEMENT.md](CONTENT_ENGAGEMENT.md). The original click/scroll tasks below remain in scope.

- [x] Track explicitly marked clicks and custom events without scraping arbitrary text or input values.
- [x] Add deduplicated scroll milestones for the document and configured scroll containers; define behavior when content grows.
- [x] Add event counts, scroll engagement, and a paginated anonymous session timeline to reporting/dashboard views.

**Done when:** a controlled browser journey produces the expected click and scroll events once, and its timeline can be inspected in the dashboard. This is an event timeline, not replay video.

### Day 10 — Pilot with MediaSpace and a second website

- [x] Complete thumbnail-impression automation and verify browser-to-database delivery before wiring site components. See [rules and evidence](IMPRESSIONS.md).
- [x] Integrate on a MediaSpace development branch with recording disabled by default; keep Fullstory disabled to avoid duplicate collection.
- [x] Verify public media overlays, sharing/navigation actions, and the internal video-feed scroll container.
- [x] Exclude admin sessions and protected/unlisted content; verify the same tracker on the independent static website.

**Done when:** two sites report separately, MediaSpace's key interactions are visible, and consent/exclusion checks pass. Review the MVP together and write down what stays out of the first release.

## Days 11–15: prepare a dependable release

### Day 11 — Check privacy and difficult browser behavior

- [x] Test stored/withdrawn consent, unavailable browser storage, multi-tab behavior, and navigation into excluded pages. Verified in Chromium; duplicated-tab and back/forward-cache follow-ups remain in the browser matrix.
- [x] Inspect actual request payloads for sensitive URL data, form values, identifiers, and protected content. October 26: 34 collector requests audited against synthetic search/URL/private-content sentinels.
- [ ] Exercise the agreed desktop/mobile browser matrix and document collection limitations. Chromium and Playwright Firefox are verified; WebKit is blocked on missing Linux libraries, and physical mobile/Safari coverage remains open. See [browser verification](BROWSER_VERIFICATION.md).

**Done when:** the agreed cases pass or have explicit release blockers; privacy documentation matches the observed behavior.

### Day 12 — Bound traffic and measure performance

- [x] Harden rate limits, request/queue bounds, retry behavior, and abuse handling; origin checks are not treated as authentication. Collector caps: 120 requests/minute/IP, five concurrent writes, batches of 1–50 events and 64 KiB body. These limit writes, not human users.
- [x] Measure tracker size, request overhead, API latency, and database growth under a small-pilot workload. The former 100,000 events/day and 50 events/second target was withdrawn by the owner October 29; do not use it as a release gate. One synthetic local baseline is recorded in PROGRESS.md; it is not a production guarantee.
- [x] Define overload thresholds and temporary collection backpressure/pause with recovery. Excess concurrent writes receive 503 with Retry-After: 2; service resumes automatically as writes finish. No load-triggered fees or billing flow in this release.
- [x] Add or adjust indexes based on query evidence; avoid new infrastructure unless measurements require it. Added `events_received_at` for the bounded, oldest-first retention delete query; existing project/time, project/session/time, playback lookup and scroll idempotency indexes cover the observed reporting/storage patterns.

**Done when:** limits work under excessive input and measurements characterize the agreed small-pilot workload. Record a numeric operating ceiling before production expansion.

### Day 13 — Manage the data lifecycle

- [x] Implement scheduled retention cleanup and authenticated project-data deletion with deliberate confirmation.
- [x] Verify old events expire without removing recent or other-project data.
- [x] Configure development logical backup/restore and restore into an isolated database to verify reports. Full-cluster/PITR recovery remains a deployment-level follow-up.

**Done when:** deletion boundaries, retention, and a real restoration are demonstrated and documented.

### Day 14 — Rehearse deployment and recovery

Preparation checklist and current verified limits: [staging and recovery readiness](STAGING_RECOVERY.md). This is not a claim that staging or monitoring exists.

Local prep includes an uninstalled boot-time Linux [`systemd` unit template](../deploy/linux/site-analytics-staging.service.example) for the MacBook Pro running Linux. It requires a dedicated service account, administrator setup, and replacement of placeholder paths. Distribution-specific HTTPS and backup setup remains open.

- [ ] Package Angular assets and the Node.js service; configure staging HTTPS, process management, and restricted database access.
- [ ] Add health checks, useful logs without sensitive event payloads, owner recovery instructions, and tracker-version compatibility guidance.
- [x] Document tracker/API contract v1 compatibility and the versioned-route policy for a future breaking change; see [staging and recovery readiness](STAGING_RECOVERY.md).
- [ ] Document and rehearse migration, rollback, and collection-disable procedures.
- [x] Make the migration CLI fail closed when `DATABASE_URL` is missing and document one-shot migration/owner setup for staging.
- [x] Verify systemd unit syntax using a temporary host-independent copy; the actual unit still requires target paths and account details.

Deployment planning input: DevOps' October 24 email proposes external public-URL monitoring plus tunnel alerts, with an alert mailbox independent of this server. No monitoring was configured. During Day 14, document the actual application health endpoint, cache behavior, service owner and independent alert destination before selecting/configuring a provider. Provider limits in the email are proposals to verify at setup time.

Current local readiness inventory: `/api/health` is an uncached application liveness response and reports whether collection was configured at startup. `/api/ready` now probes PostgreSQL with `SELECT 1` and returns 503 when the database is unconfigured or unavailable. Neither endpoint probes HTTPS/reverse-proxy routing. `/api/tracker.js` is cached publicly for five minutes. Fastify request logging is not enabled in the current app, and collection failures return a generic response without logging event payloads. The API binds to loopback. These are code observations, not a deployed staging check; staging must separately verify database readiness and public routing.

The owner selected a MacBook Pro running Linux as the staging host. Still needed before an actual rehearsal: Linux distribution/version and architecture, network reachability, TLS/reverse-proxy plan and operator, systemd service account, database service and off-device backup destination, named service owner, and alert mailbox independent of that host. Keep this stage isolated from MediaSpace and leave collection disabled until an explicit pilot decision.

**Done when:** staging can be installed from the documented steps, survives a service restart, and can be rolled back without depending on MediaSpace's deployment.

### Day 15 — Review the release candidate

Current evidence and open release blockers are summarized in the [release-readiness record](RELEASE_READINESS.md). It is not a production approval.

- [ ] Walk through every acceptance criterion in the proposal and link the evidence.
- [ ] Fix release-blocking issues and record known limitations and operating capacity.
- [ ] Prepare the exact production configuration, migration steps, and rollout/rollback plan for review.

**Done when:** a concrete release candidate is ready for the owner's production rollout decision. Do not enable production collection merely because the calendar reached this day.

## Days 16–25: contingency and stabilization

Reserve this time within the original 3–5 week estimate for issues discovered during integration, browser testing, load tests, or deployment. It is not an invitation to add replay, billing, heatmaps, or public customer accounts.

After an authorized production pilot, use small daily tasks to compare expected and observed events, watch resource use, verify retention jobs and backups, and repair proven issues. If no blockers remain earlier, do not manufacture work to fill the buffer. If blockers need more time, revise the forecast rather than skipping release criteria.

## Daily handoff

Keep the completion history and latest handoff in [PROGRESS.md](PROGRESS.md), so there is one place to resume work. Keep this plan's task checkboxes consistent with that tracker. A useful handoff answers: what changed, what was verified, what remains uncertain, and the first action for the next session.

October 25 Day 11 partial verification: the reconciled MediaSpace branch passed stored consent, cross-tab withdrawal, separate tab sessions, blocked local/session storage, excluded query URLs, authenticated/private/unlisted exclusions and absence of legacy duplicate collection. Browser/device matrix and additional navigation/lifecycle coverage remain open; see PROGRESS.md. Reconcile historical email reporting and omitted legacy dimensions before production activation.

October 26 Day 11 update: navigation, background eligibility and actual collector payload audit passed. Full evidence and remaining engine/device/lifecycle cases are in [BROWSER_VERIFICATION.md](BROWSER_VERIFICATION.md). Day 11 remains partial.

# Project progress tracker

This is the working record for Site Analytics. Read it before starting work and update it whenever a task is completed. The [proposal](PROPOSAL.md) defines scope; the [daily plan](DAILY_PLAN.md) supplies detailed tasks and completion criteria.

## Current position

- **Phase:** Days 1–10 complete locally for the agreed native-video development scope; Day 11 privacy/browser verification is next.
- **Completed work packages:** Days 1–10, including original click/custom-event and scroll tasks. Mux production integration is deferred per owner direction.
- **Current task:** Reconciled MediaSpace development branch verified; Day 11 privacy/browser checks partially complete. Production remains off.
- **Next action:** continue remaining Day 11 browser/device coverage. Day 12 has an initial measured synthetic baseline and fixed collection guardrails; revisit operating limits if observed use or hardware changes. The former 100,000/day target was withdrawn by the owner.
- **Confirmed reporting priority:** content performance, video engagement/watch time, and anonymous session activity; sharing actions included. See [content engagement requirements](CONTENT_ENGAGEMENT.md). Dashboard stays private initially.
- **Provisional defaults:** traffic/retention/session/measurement values are recorded in the decisions document. Production domain, capacity, and activation requirements remain open with owners and deadlines.
- **Delivery state:** PR #1 is merged. Day 1 follow-up documents and Day 2 implementation are present on `feat/day-two-workspace`; their merge and remote CI results have not been verified in this session.
- **Day 4 delivery:** local implementation and browser verification complete; merge, remote CI and deployment unverified.
- **Day 3 delivery:** implementation and verification are local on `feat/day-three-collection`; remote CI, merge and deployment remain unverified.
- **Production:** no analytics service deployed and no tracking enabled by this project.

## Update steps for every completed task

1. Check the relevant completion criterion in the daily plan and run the checks needed to verify it.
2. Mark only the work actually finished. A partially completed day stays unchecked in the overview below; individual daily-plan checkboxes can be checked as their tasks finish.
3. Add a dated entry to the completion history describing the change, verification result, and evidence link. Include the affected task/day and any remaining limitations.
4. Update the current position, delivery state, and next-session handoff. Record blockers or decisions explicitly.
5. Include this documentation update in the same commit or PR as the work. Use a PR link or an earlier commit ID for evidence; a commit cannot contain its own final hash.
6. After merge or deployment, record that separate outcome. Implemented, verified, merged, and deployed are different states. Keep this file in `main`; never discard it when a milestone ends.

Corrections should preserve the history: add a correction or reopening entry when a previously completed task needs more work. Never record credentials or actual visitor data here.

## Remaining work overview

Days 1–8 are complete locally; subsequent implementation rows remain pending. The steps below summarize the detailed checklists in the daily plan.

| Complete | Day | Outcome | Steps | Completion evidence |
| --- | --- | --- | --- | --- |
| [x] | 1 | Product decisions | Scope and defaults recorded; tooling selected; outstanding decisions assigned; dashboard sketched | [Decisions](DAY_01_DECISIONS.md), [sketch](DASHBOARD_SKETCH.md) |
| [x] | 2 | Runnable workspace | Scaffold Angular/API/tracker/contracts; initialize isolated PostgreSQL; add startup/checks/CI | [Setup](DEVELOPMENT.md), [API tests](../tests/health.test.ts), [database verification](../scripts/test-database.mjs) |
| [x] | 3 | Valid event storage | Versioned contracts/tables; bounded batches; project/origin checks; event deduplication | [Collection guide](COLLECTION.md), [API/database tests](../tests/collection.test.ts) |
| [x] | 4 | Browser collection | Standalone script; consent/session/sanitization/batching; static test website | [Tracker guide](TRACKER.md), [tests](../tests/tracker.test.ts), browser/database assertions |
| [x] | 5 | Verified prototype | Verify tracker totals and early native/Mux player measurements | Ten expected database rows; [player experiment and evidence](PLAYER_PROTOTYPE.md) |
| [x] | 6 | Access and projects | Owner sessions, protected APIs, project/origin/collection controls and snippet | [Owner setup](OWNER_ACCESS.md), real database integration and browser-to-database checks |
| [x] | 7 | Reporting API | Project/date-scoped aggregates and explicit metric boundaries | [Reporting contract](REPORTING.md), [exact fixture tests](../tests/reports.test.ts) |
| [x] | 8 | Angular reports | Real API filters/cards/chart/tables; loading/empty/error states and keyboard/mobile checks | [Browser regression](../scripts/check-report-dashboard.mjs), [report guide](REPORTING.md) |
| [x] | 9A | Native video measurement | Explicit native adapter, consent/lifecycle and raw collector delivery; Mux deferred | [Native guide](NATIVE_VIDEO.md), [browser/database check](../scripts/check-native-tracker.mjs) |
| [x] | 9B | Sharing and aggregation | Explicit content/share hooks and one summary per project/playback; conflict validation | [Rules](CONTENT_ACTIONS.md), [database tests](../tests/playback.test.ts), native browser harness |
| [x] | 9C | Engagement reports | Authenticated content/video APIs and Angular views; paginated anonymous timeline | [Report guide](ENGAGEMENT_REPORTS.md), [fixtures](../tests/engagement.test.ts), browser checks |
| [x] | 9 remaining | Interaction tracking | Explicit clicks/custom events, document/container scroll milestones, group counts and timeline labels | [Guide](INTERACTIONS.md), [browser/database/UI check](../scripts/check-interactions.mjs) |
| [x] | 10 | Two-site MVP | MediaSpace development hooks and separate static project; consent, overlays, feed, native video and exclusions | [Pilot harness](../scripts/check-mediaspace.mjs), [integration notes](../../mediaspace-analytics-pilot/docs/site-analytics-pilot.md) |
| [ ] | 11 | Privacy/browser verification | Exercise consent/storage/multi-tab cases; inspect payloads; test agreed browsers | Pending |
| [ ] | 12 | Capacity and abuse controls | Harden limits; load-test agreed target; measure tracker/API/database costs; tune proven bottlenecks | Pending |
| [ ] | 13 | Data lifecycle | Add retention and project deletion; verify isolation; demonstrate backup restoration | Pending |
| [ ] | 14 | Deployment rehearsal | Package staging; configure HTTPS/processes/health/logs; rehearse rollback and owner recovery | Pending |
| [ ] | 15 | Release candidate | Verify proposal acceptance criteria; resolve blockers; prepare concrete production rollout plan | Pending |

Days 16–25 are contingency/stabilization capacity, not automatically required tasks. Add specific follow-up items below only when actual findings justify them. Session replay, heatmaps, billing, and public signup remain outside this release.

## Follow-up work and blockers

| ID | Task or decision | Status | Completion condition |
| --- | --- | --- | --- |
| PLAN-1 | Merge planning documentation into `main` | Complete: PR #1 merged and files verified | Follow-up content requirements and Day 1 changes still need their own merge |
| DEC-1 | Record Day 1 decisions | Complete design baseline | [Defaults and outstanding decisions](DAY_01_DECISIONS.md) are explicit; production values remain reviewable |

### October 4, 2026 — Day 4 browser tracker verified

- **Completed:** standalone tracker with explicit start/stop, project/tab sessions, 30-minute expiry, required public-path filter, hostname-only referrers, bounded queue/batches, request timeout and consent withdrawal; static opt-in test page and isolated browser harness.
- **Verified:** `npm run check` passed lint, type checks, focused tests and all builds; `npm run test:db` passed real PostgreSQL regressions. Agent-browser/database assertions proved denial adds zero rows, permission adds one, withdrawal adds none and clears session storage, and a failed collector request is caught. Screenshot reviewed; no browser page errors reported.
- **Evidence:** [tracker guide](TRACKER.md), [tracker tests](../tests/tracker.test.ts), [browser assertions](../scripts/check-browser-tracker.mjs); branch `feat/day-four-browser-tracker`. Bundle about 2.6 KiB.
- **Remaining:** Day 5 navigation/retries/exit delivery and broader session/consent cases; Day 9 player measurements. No merge, remote CI or production deployment. Browser and socket checks required sandbox escalation.


## Completion history

### September 29, 2026 — Proposal and repository

- **Completed:** created the private `site-analytics` repository; documented agreed stack, scope, architecture, estimates, and release criteria.
- **Verified:** repository creation and push to `main` succeeded.
- **Evidence:** [proposal commit](https://github.com/Vilguinvyhypca/site-analytics/commit/9b333cf).
- **Remaining:** implementation has not started; production is unchanged.

### September 29, 2026 — Daily work breakdown

- **Completed:** created 15 ordered daily work packages with completion checks and contingency guidance; linked the plan from the README and proposal.
- **Verified:** documentation whitespace check passed and relative links resolved.
- **Evidence:** [daily-plan commit](https://github.com/Vilguinvyhypca/site-analytics/commit/9ee6517), [PR #1](https://github.com/Vilguinvyhypca/site-analytics/pull/1).
- **Remaining:** merge the documentation; begin Day 1 decisions.

### September 29, 2026 — Persistent progress record

- **Completed:** added this tracker with remaining steps, completion history, evidence requirements, delivery state, and a next-session handoff; made it the shared progress record linked from the README and daily plan.
- **Verified:** documentation whitespace and relative-link checks passed before commit.
- **Evidence:** this document in [PR #1](https://github.com/Vilguinvyhypca/site-analytics/pull/1).
- **Remaining:** all implementation work; confirm the documents reach `main` after merge.

### September 29, 2026 — Content engagement scope clarified

- **Completed:** recorded the owner's priority for content opens, per-video watch time, sharing actions, and session-level activity; deferred public-facing features. Defined proposed measurement rules, player integration steps, and acceptance scenarios.
- **Verified:** documentation whitespace and relative-link checks passed before commit; no tracker or player code has been implemented.
- **Evidence:** [content engagement requirements](CONTENT_ENGAGEMENT.md) in [PR #1](https://github.com/Vilguinvyhypca/site-analytics/pull/1).
- **Remaining:** confirm detailed measurement/identity rules; prototype both players; revisit the MVP estimate with a provisional 2–4 day scope allowance. Day 1 remains incomplete.

### September 29, 2026 — Day 1 design completed

- **Completed:** recorded anonymous content engagement, social-profile arrival hypotheses, video measurement defaults, technical choices, and a dashboard sketch. Kept subscription implementation outside scope.
- **Verified:** checked all three Day 1 deliverables against the daily plan; documentation whitespace and relative links passed. PR #1 is merged and the planning files exist on `main`.
- **Evidence:** [decisions](DAY_01_DECISIONS.md), [sketch](DASHBOARD_SKETCH.md), branch `docs/day-one-engagement-design`.
- **Correction:** the earlier content-engagement entry referred to PR #1, but that update was pushed after its merge. Its commit has now been carried into the new branch so it is not lost.
- **Remaining:** Day 2 implementation; production defaults are provisional. No application code has been implemented.

### September 30, 2026 — Day 2 workspace recovered and verified

- **Completed:** resumed the unfinished workspace on disk; verified Angular dashboard, Fastify health endpoint, contracts, inert standalone tracker, isolated PostgreSQL, checksum-protected migrations, and CI configuration. Added reproducible development instructions and corrected stale status documents.
- **Verified:** `npm run check` passed lint, TypeScript/Angular checks, all three focused tests, and API/dashboard/tracker builds. `npm run test:db` passed initialization, repeat migration, and checksum rejection against temporary PostgreSQL. Agent-browser verified dashboard rendering, API-connected status, and the connection button; no browser errors were reported. Screenshot: ignored local `artifacts/day-two-dashboard.png`.
- **Evidence:** [development setup](DEVELOPMENT.md), [health tests](../tests/health.test.ts), [database test](../scripts/test-database.mjs), [CI workflow](../.github/workflows/check.yml), branch `feat/day-two-workspace`.
- **Remaining:** Day 3 event collection/storage; no reporting or owner login exists yet. Remote CI, merge, and deployment are not verified. Collection remains disabled. Tests requiring local sockets ran outside the filesystem sandbox; the browser required a container-compatible `--no-sandbox` launch flag.

### September 30, 2026 — Owner development dashboard checks

- **Completed:** owner tested the Day 2 dashboard from Windows through the SSH tunnel at `http://127.0.0.1:14200`.
- **Verified:** owner confirmed API-connected/collection-disabled status and the connection button; reported that the layout works in Firefox developer-tools mobile emulation and remains unchanged after refreshing. Refresh is expected to preserve the same dashboard/status; no visible transition is required.
- **Evidence:** owner-reported manual checks of workspace commit `fc43e00` in this session.
- **Remaining:** mobile emulation does not verify a physical mobile browser. Tailscale access is deferred at the owner's request; adding an endpoint was denied and the subsequent administrator command was canceled. Day 3 event storage remains the next implementation task.

### October 2, 2026 — Day 3 event storage verified

- **Completed:** versioned strict event contracts including content/video/sharing, project/event migration, isolated two-project seed command, opt-in bounded batch collector, exact project/origin checks, transactional writes and project-scoped event-ID deduplication. Updated dashboard health handling and excluded generated nested Angular cache from lint.
- **Verified:** `npm run check` passed lint, TypeScript/Angular checks, five focused tests and all builds (the database-dependent test runs separately). `npm run test:db` passed all three collector tests against temporary real PostgreSQL, initial/repeat migration and checksum rejection. Confirmed stored payloads, cross-project isolation, malformed/oversized rejection, origin and disabled-project rejection, concurrent retry deduplication, and rollback after a later insert failure. Browser verified rendering, collection-disabled status, working connection button and no page errors; ignored screenshot `artifacts/day-three-dashboard.png`.
- **Evidence:** [collection guide](COLLECTION.md), [contracts](../packages/contracts/src/index.ts), [migration](../migrations/002_collection.sql), [collection tests](../tests/collection.test.ts), branch `feat/day-three-collection`.
- **Remaining:** browser tracker/consent integration is Day 4; raw playback snapshots still require Day 9 aggregation by playback/sequence. No reporting or owner login. Global collection remains off by default. Remote CI, merge and deployment remain unverified. Socket-based verification required execution outside the filesystem sandbox.

For future entries, copy this structure and replace every placeholder:

```markdown
### YYYY-MM-DD — Day N / short task name

- Completed:
- Verified: exact checks and their results; name anything not tested.
- Evidence: PR, commit, or repository artifact links.
- Remaining: limitations, blockers, or follow-up work.
```

## Next-session handoff

**Start here:** Day 11 in the [daily plan](DAILY_PLAN.md). Day 10's two-site development integration is verified locally.

**First action:** cover full-document back/forward-cache restore and duplicated-tab/sessionStorage-copy behavior, then resolve the remaining browser/device matrix. Stored consent, storage failures, cross-tab withdrawal, SPA navigation and actual collector request inspection passed; see [browser evidence](BROWSER_VERIFICATION.md). Current MediaSpace changes live in `/home/seodev/mediaspace-analytics-reconciled` on `feat/site-analytics-reconciled`, based on main `7a82a62`. The old pilot remains intact for reference; the original `/home/seodev/sturdy-journey` checkout is clean. Read its AGENTS.md and [reconciliation notes](../../mediaspace-analytics-reconciled/docs/site-analytics-reconciliation.md). Analytics work remains in this repository; both sets are uncommitted. Do not rebuild production or copy its credentials/catalog.

**Expected output:** explicit privacy/browser evidence and limitations. Use `npm run test:mediaspace` for the real two-site journey; it owns temporary ports 4320/4315/55439 and synthetic fixtures. Native-only measurement and the private dashboard remain first-release scope; Mux, session replay, heatmaps, billing and public signup remain out. Capacity, retention, backup and staging checks are still later packages.

**Runtime note:** owner login requires ADMIN_ORIGIN, AUTH_SECRET and password provisioning; see [owner setup](OWNER_ACCESS.md). No real owner credential was created during verification. Use the pinned Node.js under `/home/seodev/.local/share/site-analytics-node`; run `export PATH=/home/seodev/.local/share/site-analytics-node/bin:$PATH` if needed. Collection requires `DATABASE_URL` plus explicit `COLLECTION_ENABLED=true`; the example stays false. `npm run db:seed` targets only the isolated localhost development database.

### October 4, 2026 — Day 5 tracker reliability implementation started

- **Completed:** added same-tab SPA route hooks for `pushState`, `replaceState`, back/forward and hash changes; route deduplication uses sanitized public paths. Added bounded exponential retries for network, 429 and 5xx responses, and a keepalive flush on hidden/page exit. Expanded static test-site navigation controls.
- **Verified:** no automated or browser tests run in this continuation. The previous Day 4 database/browser verification remains recorded above; it does not cover these new behaviors.
- **Evidence:** [tracker](../packages/tracker/src/index.ts), [Day 5 plan](DAILY_PLAN.md), [tracker guide](TRACKER.md), branch `feat/day-five-tracker-reliability`.
- **Remaining:** check types/build and verify reload/back-forward, retry, duplicate route, expiry, withdrawal, excluded paths, page exit and known database totals before marking Day 5 complete.


### October 10, 2026 — Day 5 tracker reliability verified

- **Completed:** corrected automatic delivery so periodic and navigation flushes respect pending retry backoff; permanent failures clear the failure streak. Captured history delegates so saved wrappers remain callable after stop. Updated browser mocks and added a deterministic retry-bound regression.
- **Verified:** `npm run check` passed lint, type checks, six focused tests and builds; the database-dependent case passed separately with all three `npm run test:db` tests. `node scripts/check-browser-tracker.mjs` demonstrated exactly ten additional PostgreSQL rows across consent, public routes, query/hash deduplication, excluded routes, back/forward, reload continuity, session expiry, lost-response retry deduplication and actual page navigation/exit delivery. Browser reported no page errors. Retry regression proves five automatic retries, stable IDs, explicit restart and cancellation on withdrawal.
- **Evidence:** tracker source, `tests/tracker.test.ts`, `scripts/check-browser-tracker.mjs`; local branch `feat/day-five-tracker-reliability`. Browser execution required sandbox approval. Bundle approximately 4.1 KiB minified.
- **Scope correction:** previous handoff deferred all player work to Day 9, but the accepted scope calls for an early player prototype in Days 4–5. The tracker portion is complete; the native/Mux prototype is the next unfinished task. Day 5 remains open.
- **Estimate review:** tracker verification completed in this session. Retain the provisional 2–4 extra working days for content engagement until the player prototype supplies evidence; no narrower estimate is justified yet.
- **Remaining:** early player prototype, then owner authentication/project management. Remote CI/merge/deployment unverified; no production collection enabled.


### October 10, 2026 — Day 5 early player prototype completed

- **Completed:** isolated native-video/Mux measurement experiment, synthetic seekable media server, and reproducible browser assertions. Shared sampling separates monotonic elapsed time from unique coverage; handles eligibility, seeks, repeat segments, rate changes, unknown duration, completion thresholds and bounded intervals. No production tracker export or MediaSpace changes.
- **Verified:** final `npm run check` passed lint, types, nine focused tests and builds (database-specific case skipped here; prior tracker verification ran it separately). Chromium exercised actual native and Mux 3.13.2 elements: open without playback, pause, seek, 2× playback, offscreen visibility, separate playback IDs, end/95% completion, and withdrawal followed by continued playback beyond a heartbeat. No page errors. At 4×, the 12-second fixture produced about 2.8–3.0 elapsed seconds and over 98% observed coverage for both players.
- **Evidence:** [prototype report](PLAYER_PROTOTYPE.md), `tests/player-prototype.test.ts`, `scripts/check-player-prototype.mjs`, `experiments/player/measurement.ts`. Synthetic fixture/screenshot are ignored local artifacts. Browser and ffmpeg needed sandbox escalation. Fixed a test-server range-response issue discovered during real seeking.
- **Estimate review:** tracker and player verification took two development sessions on October 10. Keep the provisional 2–4 extra content-engagement working packages; real streaming/mobile integration and idempotent aggregation remain uncertain. No calendar-date promise.
- **Remaining:** Day 6 owner login and project management. Day 9 adds production player adapters, collector integration, aggregation and reports. Real Mux-hosted HLS, token expiry, tab backgrounding/mobile and concurrent feed integration remain unverified; limitations are recorded in the prototype report. Day 5 is now complete locally. No remote CI, merge, deployment or production collection claimed.


### October 11, 2026 — Day 6 owner access and projects verified

- **Completed:** migration for the singleton owner and expiring database sessions; Argon2id provisioning/recovery command; HttpOnly/SameSite cookies, secure host-prefixed cookies on HTTPS, session-bound CSRF, exact mutation origins and login rate limiting. Protected project create/edit/list routes, exact origins and collection switches, private report namespace, Angular login/project forms, and a copyable inert installation snippet backed by a served tracker bundle. Owner access works independently of global collection enablement.
- **Verified:** `npm run check` passed lint, API/Angular type checks, nine focused tests and all builds; two database-dependent cases ran separately in `npm run test:db`, where all four integration tests passed, including repeat migrations/checksum rejection. PostgreSQL checks covered wrong passwords, anonymous requests, project mismatch, CSRF/origin rejection, expiration, logout, reset revocation, API restart persistence and rate limits. `node scripts/check-owner-dashboard.mjs` verified real browser login, two persisted project forms, one consented event from the exact generated snippet, no additional row after disable, reload continuity, mobile viewport fit and logout/session deletion. No browser page errors. Desktop/mobile screenshots inspected.
- **Fixes found through verification:** pre-login CSRF binding must be nonempty for the installed library; empty logout requests must omit the JSON content-type header. Both corrected and verified.
- **Evidence:** [owner setup/recovery](OWNER_ACCESS.md), `tests/admin.test.ts`, `scripts/verify-owner-dashboard.mjs`, `scripts/check-owner-dashboard.mjs`; ignored screenshots `artifacts/day-six-owner-projects.png` and `artifacts/day-six-owner-mobile.png`. Branch `feat/day-six-owner-admin`. Tests used temporary PostgreSQL and synthetic credentials, with sandbox escalation for local sockets/browser execution.
- **Delivery:** files are saved locally but not committed. An attempt to commit the preceding Day 5 work failed because Git author identity is not configured; no identity was invented. Prior Day 5 changes are preserved. Remote CI, merge and deployment remain unverified.
- **Remaining:** Day 7 reporting API. Normal development owner credentials must be provisioned privately using OWNER_ACCESS.md. The login limiter is per process; staging HTTPS/reverse-proxy setup and multi-instance hardening remain later work. Production collection remains off.

### October 20, 2026 — Replace extended manual player checks with automation

- **Working preference:** owner requested ending the lengthy manual walkthrough. Use automated regressions by default; reserve manual review for decisions or behavior automation cannot establish.
- **Completed:** `npm run test:player` runs a native-only browser journey with its own server on port 4311 and automatic cleanup. Added the exact paused-seek/end-segment regression to the deterministic suite. Separate native/Mux display panels prevent idle updates from overwriting the native result.
- **Verified:** `npm run check` passed lint, types, ten focused tests and all builds; database-dependent cases passed separately in all four `npm run test:db` tests. Automated native browser assertions passed: consent off, playback, pause, seek exclusion, bounded 1× end segment, incomplete status after skipping, native display isolation, 2× replay coverage and withdrawal. Observed end-segment time was 1.802 seconds for 1.804 seconds of content.
- **Manual evidence:** project disablement stored zero events; re-enabling resumed collection. Controlled navigation/back raised the baseline from two to three to four events; empty flush, no-consent reload and off-state actions kept it at four. An earlier extra consented event was not attributed; do not treat that part as an exact-count pass.
- **Limitation:** manual watch-time discrepancy was not reproduced under controlled 1× playback. Its original cause is unknown; no measurement-algorithm fix claimed. Production player integration remains Day 9.
- **Next:** Day 7 reporting API. Stop asking the owner to repeat this browser checklist; rerun the automated commands when relevant changes warrant them.

### October 20, 2026 — Day 7 traffic reporting verified

- **Completed:** authenticated overview endpoint for page views, distinct active sessions, daily trends, popular paths and referrer hosts. Shared typed contract, real-date/range/timezone validation, single-statement snapshot, explicit freshness, zero-filled days and bounded group lists. Disabled collection preserves historical reporting.
- **Verified:** `npm run check` passed lint, type checks, 11 focused tests and all builds (three database tests skipped there). `npm run test:db` passed all six tests, migrations and checksum rejection against disposable PostgreSQL. Exact fixtures cover project isolation, shared session IDs, midnight boundaries, spring/fall DST, UTC, late arrivals, empty data, non-page events, list limits/order, authentication/revocation and failure responses. Local socket checks required sandbox escalation.
- **Test reliability fix:** serialized shared-database suites to avoid owner-session reset races; scoped older collector assertions to their own fixture projects after the combined run exposed global row-count assumptions.
- **Evidence:** [reporting definitions](REPORTING.md), [report tests](../tests/reports.test.ts), [SQL and validation](../apps/api/src/reports.ts).
- **Delivery and limits:** saved locally, not committed or deployed; existing Git identity blocker remains. Capacity testing and retention enforcement are later work. Reports return the top 100 groups with total-group metadata; no pagination yet. No Angular reporting UI claimed.
- **Next:** Day 8 dashboard reports; automate the browser checks instead of repeating a long owner-led walkthrough.

### October 21, 2026 — Day 8 Angular traffic reports verified

- **Completed:** project/date/timezone filters, view/session cards, daily line chart with exact-data table, popular-page/referrer tables, freshness and truncation labels. Separate loading, empty, validation and failure states; retry, 15-second timeout, request cancellation and stale-response protection. Session expiry removes private report data and returns to sign-in.
- **Verified:** `npm run check` passed lint, strict API/Angular type checks, 11 focused tests and all builds (three database-only tests skipped by that command). `node --import tsx scripts/check-report-dashboard.mjs` passed the real browser → owner-authenticated API → disposable PostgreSQL → rendered totals flow. Checked exact two-project totals, date/UTC changes, zero-filled days, empty results, failure/retry, delayed-response races, 100-group disclosure, long paths at 390px width, keyboard Tab/Enter, and session revocation; no browser errors. Successful data was real SQL output; only transport delay/failure was injected.
- **Evidence:** [dashboard component](../apps/dashboard/src/traffic.ts), [browser regression](../scripts/check-report-dashboard.mjs), [report guide](REPORTING.md). Screenshots saved under ignored `artifacts/day-eight-reports-*.png`; captured desktop header and mobile filters inspected. The harness owns ports 4312/55436 and cleans up, leaving the owner's manual-test environment alone. `npm run test:reports` builds and runs it. Local sockets/browser needed sandbox escalation.
- **Compatibility:** existing owner browser script now targets the project form explicitly because the dashboard contains an additional report form.
- **Remaining:** Day 9A native-video tracker integration, then aggregation/sharing/content reports. Physical mobile browsers, full assistive-technology testing and production deployment remain unverified. Changes saved locally, not committed; existing Git identity blocker remains.

### October 21, 2026 — Day 9A native-video tracker delivery verified

- **Completed:** explicit `trackVideo()` registration with required content ID/public predicate, shared measurement core, native adapter, distinct playback IDs, cumulative progress, consent-aware activation/disposal, bounded queue delivery, source/privacy/session resets and detach checkpoints. Playback URLs remain local. Existing page tracking and retry rules are preserved. Mux integration deferred per owner direction.
- **Verified:** `npm run check` passed lint, strict type checks, 12 focused tests and all builds; three database-only tests ran separately in all six passing `npm run test:db` tests. Native adapter deterministic tests cover denial/withdrawal, pause/seek/rate, buffering, document/player visibility, session expiry and retry event identity. `node --import tsx scripts/check-native-tracker.mjs` passed real Chromium → tracker → collector → disposable PostgreSQL checks for consent, stored playback, pause, seek exclusion, 2× replay coverage, separate players, private exclusion, detach/reattach, event deduplication and withdrawal beyond five seconds. No browser errors. Observed watch time 2.099 seconds; final 1.804-second content segment measured 1.799 elapsed seconds.
- **Evidence:** [integration guide](NATIVE_VIDEO.md), [adapter tests](../tests/native-video.test.ts), [native browser/database harness](../scripts/check-native-tracker.mjs). Standalone minified tracker is approximately 8.1 KiB. Harness ports 4313/55437 are temporary and cleaned up; ffmpeg produces synthetic local media with no Mux dependency. Browser/database sockets required sandbox escalation.
- **Limits:** raw playback rows are cumulative; Day 9B must implement idempotent aggregation before video totals are exposed. Final delivery remains best effort, coverage is capped conservatively, and physical mobile/MediaSpace feed integration remains later work. No production collection or deployment. Changes remain saved locally and uncommitted; existing Git identity blocker remains.
- **Next:** Day 9B sharing and aggregation, then Day 9C content/video/session reports.

### October 22, 2026 — Day 9B sharing and playback aggregation verified

- **Completed:** consent/public-route/content-gated `contentOpen()` and `recordShare()` hooks; distinct clicked/copied/handoff/cancelled/failed outcomes. Migration 004 adds an indexed read-through playback summary view: latest cumulative sequence, received-start status, coverage and completion, preserving unknown duration. Collector transaction locks serialize overlapping playback updates; identity/sequence/monotonic-time conflicts reject the entire batch with CORS-visible 409. Raw event-ID retries remain no-ops.
- **Verified:** final `npm run check` passed lint, API/Angular types, 13 focused tests and all builds; four database-only tests ran separately in all seven passing `npm run test:db` tests. Fixtures covered reordered/duplicate sequences, progress-before-start, concurrent conflicting updates, rollback, identity isolation, completion, unknown duration, distinct share outcomes and summaries reflecting raw deletion. Real Chromium → collector → PostgreSQL → summary assertions passed in `scripts/check-native-tracker.mjs`, including content-open and all sharing outcome hooks, cumulative totals, existing video regressions and withdrawal. No browser errors.
- **Evidence:** [action and summary rules](CONTENT_ACTIONS.md), [aggregation fixtures](../tests/playback.test.ts), [hook tests](../tests/content-actions.test.ts), migration 004 and expanded native browser harness. Tracker is approximately 8.9 KiB minified. Temporary databases/browser were cleaned up; local socket checks needed sandbox escalation.
- **Limits:** report UI/API remains Day 9C. Share observations do not prove receipt and stages are not correlated with an attempt ID. Hook tests verify recorded outcomes, not real external recipient delivery. The summary view calculates from retained raw events; production load and retention-boundary policies remain later work. No deployment or production collection; files saved locally, not committed due to the existing Git identity blocker.
- **Next:** Day 9C content/video/session reports, with explicit date attribution and automated fixtures.

### October 23, 2026 — Day 9C engagement reports and timeline verified

- **Completed:** authenticated project/date-scoped engagement, session-list and timeline APIs; shared contracts; Angular content metrics, sharing-outcome tables, watch-time distribution, playback details and paginated anonymous session activity. Playback cohorts use first observation in range plus lifetime retained progress; actions/timelines use occurrence dates. Labels explain denominators, missing starts/duration, incomplete observations and unavailable playhead position. Pages are bounded and tables support narrow screens.
- **Verified:** `npm run check` passed lint, strict types, 13 focused tests and builds (five database-dependent cases skipped there). All eight database-suite tests passed, including exact two-project fixtures, late lifetime progress, UTC/local boundaries, missing starts/duration, authentication/error cases, and keyset pagination with microsecond timestamp ties. A later focused cursor-validation test also passed; affected files passed lint/types and the API was rebuilt. The expanded browser regression passed actual dashboard/API/database totals, project/date changes, engagement rendering, sharing, keyboard activation, all three pages of a 101-event timeline, error recovery, mobile overflow and session expiry. No browser errors; temporary services cleaned up.
- **Diagnosis and test correction:** installed agent-browser `press Enter` emitted a keydown on the focused button but no activation click/request. A focused diagnostic proved direct click worked. `scripts/browser-keyboard.mjs` now sends native Chrome Enter input with virtual key codes; the end-to-end run passed. No application pagination workaround added.
- **Evidence:** [report contract](ENGAGEMENT_REPORTS.md), [API fixture tests](../tests/engagement.test.ts), `scripts/check-report-dashboard.mjs`. Ignored desktop/mobile screenshots `artifacts/day-nine-engagement-*.png` were inspected. Local browser/socket checks required escalation.
- **Remaining:** original Day 9 click/custom-event and scroll tracking plus associated counts; do not claim all Day 9 is finished. Physical mobile/assistive-technology coverage, thumbnail-impression automation, real MediaSpace integration, capacity and production rollout remain unverified. Files remain local/uncommitted; existing Git identity blocker remains.

### October 23, 2026 — Remaining Day 9 interaction tracking verified

- **Completed:** explicit click-element and custom-name hooks; document/container scroll registration, downward-motion and visibility checks, per-page-view/scope thresholds, dynamic-height rules, listener disposal and bounded registrations. Nested registered elements count the same click at most once. Migration 005 validates the new types and enforces scroll threshold uniqueness across retry event IDs. Engagement API/UI adds scoped totals and bounded groups; timelines display declared names/scope/thresholds.
- **Verified:** `npm run check` passed lint, API/Angular types, 15 focused tests and builds (six database-only cases skipped there). All ten `npm run test:db` tests passed, including migration repeat/checksum checks, strict payload rejection, scroll deduplication and exact report/timeline isolation. `scripts/check-interactions.mjs` passed real Chromium → tracker → collector → PostgreSQL → owner dashboard: denied consent stored nothing; nested click counted once; one custom event; four feed thresholds on each of two route views plus four document thresholds (12 total); feed growth added no duplicate thresholds; private/excluded paths and withdrawal added no events; no fixture text/input values leaked; dashboard counts and timeline matched. No browser errors.
- **Evidence:** [interaction contract](INTERACTIONS.md), [tracker tests](../tests/interactions.test.ts), [database tests](../tests/interaction-storage.test.ts), [full-flow browser harness](../scripts/check-interactions.mjs). Harness ports 4314/55438 were cleaned up. `npm run test:interactions` builds and runs it. Standalone tracker is approximately 11.6 KiB minified; production capacity remains to be measured.
- **Delivery:** implementation and tests are local, with no production deployment or activation. Changes remain uncommitted. Apply migration 005 before collecting new event types in any development installation.
- **Next:** Day 10 two-site development integration; explicitly carry forward thumbnail-impression automation and physical mobile/feed checks. Mux remains deferred per owner direction.

### October 23, 2026 — Day 10 thumbnail-impression prerequisite verified

- **Completed:** explicit `trackImpression()` registration, 50% intersection/one-second continuous eligibility, per-view/content deduplication, public predicate, document visibility and route resets, consent withdrawal and idempotent detach. Shared observer/250 ms clock only activates when registrations exist and consent is granted; bounded registrations and per-view memory. No media URLs or scraped content.
- **Verified:** `npm run check` passed lint, strict types, 16 focused tests and builds (six database suites skipped by this command). Expanded `scripts/check-interactions.mjs` passed actual Chromium IntersectionObserver → collector → temporary PostgreSQL: no impressions without consent, one per visible item/view, new route permits another, private thumbnail excluded. Existing interaction totals and owner dashboard/timeline assertions still pass; no browser errors. No schema change. Tracker is approximately 13.4 KiB minified.
- **Regression caught:** avoided allocating an observer on pages with no registered thumbnails, preserving existing native-video behavior. Full check passed after correction.
- **Evidence:** [impression integration contract](IMPRESSIONS.md), `tests/impressions.test.ts`, expanded interaction browser harness. Temporary browser/database services cleaned up. Sandbox escalation was required for local sockets and Chromium.
- **Remaining:** Day 10 is not complete. MediaSpace code and production were not modified; isolated development wiring, real overlays/feed/sharing, signed-in/private exclusions and independent second-site verification remain. Mux remains deferred. Changes saved locally, not committed or deployed.

### October 23, 2026 — Day 10 two-site development pilot verified

- **Completed:** isolated MediaSpace worktree `/home/seodev/mediaspace-analytics-pilot`, branch `feat/site-analytics-pilot`. New self-hosted provider replaces the mounted Fullstory provider, is disabled by default, loads a pinned local tracker only after fresh consent, and excludes authenticated sessions and non-public URLs. Public gallery cards register impressions/opens; native overlay/feed players register playback; sharing records observed outcomes; the internal feed registers scroll milestones. Public predicates and cleanup follow component identity. Catalog IDs use collision-free bounded UTF-8 hex encoding to support local IDs containing colons. Registration failures do not break the gallery.
- **Verified:** MediaSpace optimized Next build, generated-route TypeScript checks, route-policy/adapter tests and focused component lint passed. Repository lint has pre-existing font/navigation/image warnings. `scripts/check-mediaspace.mjs` passed real Chromium → MediaSpace → collector → disposable PostgreSQL for consent off/on, impressions, overlays, share clicks, native-video progress, feed scrolling, withdrawal, excluded query URLs and signed-in exclusion; a separate static-origin project recorded independently. Synthetic fixtures only. The original MediaSpace checkout is clean; production unchanged.
- **Test setup fixes:** cold WASM compilation exceeded CDP navigation deadlines, so the harness now prewarms routes/API. It waits for gallery cards and scrolls the thumbnail into view before asserting impressions. These were fixture preconditions, not changes to the measurement threshold. The sandbox build subprocess failed initially; the isolated build passed outside the sandbox.
- **Evidence:** `npm run test:mediaspace`, [pilot integration guide](../../mediaspace-analytics-pilot/docs/site-analytics-pilot.md), MediaSpace `tests/site-analytics.test.mjs` and existing route-policy tests. Harness ports 4320/4315/55439, generated media, browser and temporary database are cleaned up after each run. No production environment files or catalog copied.
- **Limits/next:** Day 11 expands browser/storage/multi-tab coverage; physical mobile is not verified. Share-click integration does not prove recipient delivery. Mux is deferred. First release remains native analytics/private owner dashboard; session replay, heatmaps, billing and signup remain excluded. Both repositories' changes remain local and uncommitted; no deployment or production activation.

### October 23, 2026 — Review of MediaSpace traffic email

- Read the Traffic Review message through the server's `/usr/local/bin/mailbridge`; this is the configured mail client for this account, not a conventional `/var/mail/seodev` inbox. No reply sent.
- Reviewed report/tracking source at MediaSpace commit `4fb78c9e32f88a840cd024c9272db8193c63732a` via connected GitHub. [Analysis and recommendations](reviews/2026-10-23-mediaspace-traffic.md) distinguish supplied aggregates from code findings and unverified hypotheses. Production event files were not accessible; no production data or configuration changed.
- **New rollout dependency:** the current report branch has an Experience tracker and newer player/sharing behavior absent from the older checkout used for the Day 10 pilot. Day 10's isolated synthetic verification remains valid, but it does not establish current-production compatibility. Before any merge/deployment, compare against the current application, preserve those fixes, explicitly select/reconcile collectors and consent, and test for duplicate or prohibited collection. Do not deploy the old pilot wholesale.
- Key analysis findings: source labels on subsequent views can inflate direct/unknown; top pages are not landing pages; existing session-wide journey flags do not match playback attempts; sharing represents attempts and ended events are not coverage-based completion. Reporting-window, attribution and denominator improvements precede UX claims. Day 11 privacy verification should include the existing Experience path as part of migration compatibility.

### October 25, 2026 — Reconciled branch and initial Day 11 privacy checks passed

- **Reconciliation verified:** `/home/seodev/mediaspace-analytics-reconciled`, branch `feat/site-analytics-reconciled`, based on main `7a82a62`. Preserves newer video loaders/autoplay fallback, processing placeholders, sharing/manual-copy fallback and public profile-feed pagination. The consent-gated Site Analytics provider is the sole collector. Legacy action call sites forward only approved names; legacy page/media/video/share events cannot duplicate explicit new hooks. Legacy POST returns 410; authenticated historical reads remain, and the UI labels its data historical.
- **Checks passed:** optimized Next build including TypeScript; route type generation; five targeted test files (route policy, adapter/bridge, sharing, feed, historical summaries); focused lint on changed components/tests. All five individual sharing tests passed, including handoff/copy/failure/cancellation, private exclusion and pending outcome suppression after unmount. Existing repository font/image warnings remain outside this change.
- **Real browser/database PASS:** `npm run test:mediaspace` now defaults to the reconciled checkout. Verified one initial page view, consent off/on, thumbnail impressions, content opens, sharing, native-video progress, internal scrolling, separate anonymous tab IDs, stored consent, withdrawal propagated to another playing tab, unavailable consent storage failing closed, unavailable session storage using a consistent memory session, excluded query URL, authenticated exclusion, private/unlisted ID exclusion, separate static project, legacy POST rejection, anonymous historical GET denial and absence of parallel legacy event files. Temporary ports 4320/4315/55439, browser, database and generated media were cleaned up.
- **Corrections during verification:** updated old VM fixtures for the new hooks while retaining sharing/pagination assertions; fixed Next's ESM `next/constants.js` import. First browser run timed out during startup; subsequent run reached media interactions but exposed a new-tab execution-context race in the harness. Added bounded retries only for navigation-destroyed contexts; final full run passed. No application pagination/playback workaround added.
- **Day 11 remains partial:** physical mobile and other browser engines, additional SPA/back/forward/background lifecycle cases and broader payload inspection are not claimed complete. The report migration remains a rollout dependency: legacy scheduled email would receive no new legacy events; attribution/load-time/duration and detailed legacy dimensions are deliberately not silently mapped into generic action counts. Profile-query feed URLs remain conservatively excluded pending explicit policy/tests. See [reconciliation scope](../../mediaspace-analytics-reconciled/docs/site-analytics-reconciliation.md).
- **Delivery:** local/uncommitted only. Original checkout remains clean; no production deployment, service change, credentials or real catalog used.

### October 26, 2026 — Day 11 navigation and transmitted-payload audit passed

- **Verified:** real Chromium → reconciled MediaSpace → collector → disposable PostgreSQL run exited successfully. Exact SPA link/back/forward view counts and stable tab identity, 390px gallery overflow check, consented excluded query/fragment navigation and return, real hidden-tab watch-time exclusion, cross-tab withdrawal, storage failures, authenticated exclusion and independent static project all passed.
- **Privacy evidence:** inspected 34 collector request bodies before persistence; no search sentinel, excluded URL values, media URLs, or private/unlisted fixture IDs. Existing native playback, overlays, impressions, sharing and internal-scroll assertions also passed. See [verification matrix](BROWSER_VERIFICATION.md).
- **Harness correction:** first run timed out restoring the gallery after an automated empty-string search fill. The test now clicks the application's Clear button and verifies both empty input and restored gallery. Final rerun, focused ESLint and whitespace checks passed. No application workaround added. Temporary services, database and media cleaned up.
- **Mail:** read the October 25 delivery test and October 24 DevOps monitoring proposal. Added independent external monitoring/alert requirements to Day 14 planning; no reply sent or monitoring configured.
- **Remaining:** Day 11 stays open for other browser engines/physical devices, full-document back/forward-cache restore and duplicated-tab behavior. Legacy reporting migration remains a rollout dependency. Changes remain local/uncommitted; no production deployment or activation.

### October 28, 2026 — Cached-page restoration handler implemented

- **Changed:** tracker listens for persisted pageshow and records a fresh eligible page view after back/forward-cache restoration. Normal pageshow does not duplicate the initial view; stop removes the listener. Session identity follows existing inactivity expiry and current public-path eligibility is rechecked.
- **Verified:** npm run check passed lint, API/Angular type checks, 17 tests and all builds; six database-dependent tests were skipped. New lifecycle regression covers before consent, normal page load, restore with distinct view ID/same session, route deduplication, excluded pages, withdrawal and stop/start listener cleanup. Initial sandbox run stopped on the test runner IPC permission; the complete rerun outside the sandbox passed.
- **Limits:** this is deterministic event-level evidence, not a real browser bfcache admission/restoration test. The reconciled MediaSpace pinned vendor bundle has not been replaced. Next: real restoration verification, then deliberate bundle update/integration regression and duplicated-tab checks. Other browser engines/devices remain unverified, so Day 11 remains open. No database code changed; no production deployment or collection activation.

### October 29, 2026 — Real cache restoration and refreshed MediaSpace tracker verified

- **Completed:** added `scripts/check-page-lifecycle.mjs` and `npm run test:lifecycle`. A temporary HTTP fixture and Chromium verify actual persisted pageshow and retained document identity, a fresh view with unchanged session, route deduplication, and no collection after stop/consent withdrawal. The browser and server clean up automatically. This covers the standalone tracker, not Next-specific cache admission.
- **Integration:** replaced the reconciled development checkout's vendor bundle with the built tracker, SHA-256 `538f6cf0c2e88cb048c812031dc38b28a1e1c82323d6ff184c96856488777d50`. Full MediaSpace browser → collector → disposable PostgreSQL regression passed, including navigation, native playback, storage failures, cross-tab withdrawal, authenticated/private exclusions and 34 inspected collector bodies without tested sensitive values. Temporary services/media/database cleaned up. Focused lifecycle-script lint passed.
- **Communication:** sent the requested October 28/29 work and blocker summary to the owner's Proton address; local queue accepted message `82cba42460b99066afccf7162e8d1b40`. Recipient delivery remains unconfirmed. The email described the integration regression as running; its passing result was obtained immediately afterward.
- **Next:** duplicated-tab/sessionStorage-copy behavior and other engines/physical devices remain open, so Day 11 is partial. Historical-report migration remains a rollout dependency. Work remains local/uncommitted; no production change.

### October 29, 2026 — Copied opener sessions isolated

- **Changed:** when sessionStorage contains the same session ID as an accessible same-origin opener, discard that inherited session and allocate a new one on the child's first eligible event. Subsequent child reloads retain the new ID; parent state is unchanged. Inaccessible openers fall back to existing session behavior.
- **Verified:** full npm run check passed lint, types, 17 tests and all builds (six database-only cases skipped). Expanded real Chromium lifecycle harness passed actual storage-copy precondition, distinct child ID, child reload continuity, unchanged parent and existing genuine cache-restoration/withdrawal checks. Focused lint passed after the final fixture adjustment.
- **Fixture correction:** opening a child was not exposed in agent-browser's indexed tab registry. The harness now uses a real button click and the returned same-origin window handle; it asserts that the child exists before accessing its storage. Two earlier runs stopped at tab selection, not at product assertions.
- **Limits/next:** MediaSpace still pins the earlier cache-restoration bundle; update and integration regression are next. Browser-menu duplication with no opener may still copy an ID, so documentation no longer promises guaranteed one-session-per-physical-tab. Other engines/devices remain open. No production change or merge.

### October 29, 2026 — MediaSpace integration updated for copied-session isolation

- **Completed:** refreshed the reconciled MediaSpace development vendor bundle with the tracker that detects a copied same-origin opener session.
- **Verified:** full browser → MediaSpace → collector → disposable PostgreSQL regression passed. Confirmed real SPA/back-forward navigation, excluded query/fragment handling, cross-tab withdrawal, storage failures, admin/private exclusion, native playback, sharing, feed scroll, and audited 33 collector request bodies with no tested search text, excluded URL values, media URLs or private/unlisted IDs. Temporary services, database and generated fixtures cleaned up.
- **Remaining:** standalone Chromium confirms opener-created child isolation, but browser-menu duplicate behavior without an accessible opener is unresolved. Other browsers and physical devices are not tested. Day 11 and legacy report migration remain open. Local/uncommitted development only; no production action.

### October 30, 2026 — Initial collector request limit added

- **Changed:** public collection route now has an in-process limit of 120 requests per minute per client IP, using the existing Fastify rate-limit dependency. Existing 64 KiB body and 1–50 event batch bounds remain. This is a conservative initial pilot guard, not a measured capacity claim; shared multi-process deployments need a shared limiter.
- **Verified:** after correcting registration in synchronous `createApp`, `npm run check` passed lint, TypeScript/Angular checks, 17 tests and all builds; six database-only tests were skipped. No test currently exercises the new 120-request threshold under burst traffic.
- **Next:** run focused excessive-request verification and measure API latency/database growth with synthetic small-pilot traffic. No production config or deployment changed.

### October 31, 2026 — Small-user load protection requirement clarified

- **Owner direction:** keep initial concurrent use small. When measured server load reaches a defined operating threshold, pause or reject analytics collection temporarily and resume after recovery. Do not ask visitors to pay a fee in response to server load.
- **Plan update:** Day 12 now requires measurement-based thresholds and temporary backpressure/pause behavior. No numeric threshold is invented before the synthetic workload measurements. Billing is already outside first-release scope in the proposal.
- **Next:** verify request limits, measure synthetic small-pilot latency/database growth, then design bounded overload behavior from observed results. No production changes.

### October 31, 2026 — Pilot overload backpressure added

- **Changed:** collector now caps concurrent requests at five (matching the current API database pool size). Excess work receives HTTP 503 with `Retry-After: 2`; capacity resumes as requests finish. Existing per-IP 120/minute limit remains.
- **Verified:** focused collection tests passed, including five held requests, a sixth shed with the expected response, and a successful request after recovery. Focused ESLint and `git diff --check` passed. Synthetic 121-request test previously confirmed the per-IP limiter accepts 120 and rejects the next.
- **Measurement context:** local disposable PostgreSQL run with five concurrent clients, 50 batches/500 events: all 50 accepted; 1.04 s total, median 66.94 ms, p95 290.61 ms, database size +335,872 bytes. This is one local baseline; no WAL/disk growth or production capacity claim. Load-trigger is a fixed concurrency bound, not a live CPU/memory/latency monitor.
- **Remaining:** define operating thresholds from further observations and decide whether overload should pause only analytics collection or the whole service. No fee/billing behavior. Day 12 remains partial; no production change.

### October 31, 2026 — Initial Day 12 pilot guardrails recorded

- **Operating policy:** limit collection work, not human visitors: 120 requests/minute per source IP, up to five active collection writes per API process, 50 events/64 KiB per batch. Excess concurrent work gets HTTP 503 and Retry-After: 2; it is retried after load falls. These are initial pilot guardrails, not a guarantee of five simultaneous people. Multiple API processes do not share these in-memory limits.
- **Measured once:** five synthetic clients, 50 batches of 10 events (500 total), local temporary PostgreSQL. All 50 accepted in 1.04 seconds; p50 66.94 ms, p95 290.61 ms; database size rose 335,872 bytes. A separate 121-request local burst accepted 120 and rejected one. No WAL/disk-growth tracking or repeated runs; do not extrapolate linearly into production capacity.
- **Checks:** `npm run check` passed 18 tests and builds (six DB-only cases skipped); `npm run test:db` passed all 11 database tests; focused burst and concurrency-recovery assertions passed. The 13.7 KiB current tracker build was measured locally.
- **Status:** Day 12 initial criteria checked, while production expansion still needs hardware-specific repeated measurements and shared rate limiting if deployed with multiple API workers. Day 11 browser/device matrix and Day 13 retention/restore remain. No deployment.

### November 2, 2026 — Day 13 lifecycle package verified locally

- **Retention:** default 30-day expiry runs daily in the API process, deleting up to 5,000 expired events per pass. Owner can set `RETENTION_DAYS` (1–3650). Cleanup is repeatable; missed backlog requires subsequent daily passes.
- **Project deletion:** owner dashboard requires typing the exact project ID. API requires authenticated owner session and CSRF; deletion removes project events and row in a transaction. Browser run confirmed wrong ID preserves the project, correct ID removes only that project's events, another project remains after reload, and no browser errors.
- **Database evidence:** `npm run test:db` passed all 12 tests, including retention boundary/project isolation. Backup rehearsal used reusable local-only logical export, restored 12 synthetic events into a separately migrated PostgreSQL instance, and verified report totals. No real owner/visitor data used.
- **Limits:** JSON logical backup includes project/events/owner records and has owner-only file permissions; it is not a full cluster backup, WAL archive or point-in-time recovery. Need define independent storage and test server-loss recovery during Day 14. Dashboard deletion and retention defaults are in place; work remains local, not deployed.

### November 4, 2026 — Owner project deletion browser flow confirmed

- **Verified:** repeated the full Chromium owner-dashboard flow against a disposable PostgreSQL database. Login, consent-only snippet, collection disablement, wrong-ID rejection, exact-ID project deletion, cross-project event isolation after reload, mobile viewport and logout all passed with no browser errors. Fixture uses synthetic credentials/data and binds to loopback; it was stopped afterward.
- **Harness cleanup:** added a PostgreSQL pool error listener so expected late socket closure during Ctrl+C teardown does not surface as an unhandled pool error.
- **Day 14 inventory:** documented that `/api/health` is liveness only (no PostgreSQL or proxy probe), `/api/tracker.js` has a five-minute public cache, Fastify request logging is off, and the development server binds to loopback. No staging environment or monitor was changed.
- **Next:** continue the Day 14 recovery runbook and staging preparation. A real rehearsal depends on choosing the staging host, reverse-proxy/TLS owner, process supervisor, database/backup destination, service owner and independent alert mailbox. Day 11's multi-engine/device matrix and Day 12's query-index review also remain open. All changes remain local and uncommitted.

### November 6, 2026 — MacBook staging host selected

- **Owner decision:** staging will run on a separate MacBook. Host identity is now resolved; macOS version, routing/access method, process supervision and backup/alert arrangements are still open.
- **Prepared:** added a MacBook setup inventory to the Day 14 recovery checklist: Git, pinned Node.js 24.21.0/npm, PostgreSQL 18, `launchd`, host security settings, and encrypted off-device backup. Clarified that the repository's embedded development database helper is Linux x64-specific and is not the Mac staging database plan. No software was installed and no staging service was started.
- **Packaging update:** added an optional same-origin Angular asset/SPA fallback, `DASHBOARD_DIR` configuration, and a `npm start` API entry point. It leaves the existing dev server path intact. Full `npm run check` passed: lint, TypeScript/Angular checks, 19 tests (7 DB-backed tests skipped without a test database), and all workspace builds. Focused dashboard tests cover SPA fallback, asset serving, API 404 isolation and traversal rejection. A brief built-server smoke check served an Angular route from the dashboard assets and returned health with collection disabled.
- **Readiness:** added `/api/ready`, which probes configured PostgreSQL with `SELECT 1`, returns a generic 503 when the database is not configured/unavailable, and reveals no DB error details. `/api/health` remains liveness-only. Tests cover ready, unavailable and unconfigured states.
- **Latest checks:** `npm run check` passed lint, TypeScript/Angular checks, 20 tests (8 DB-backed tests skipped without a test database), and all workspace builds. `npm run test:db` passed 15/15 tests, including an actual `SELECT 1` readiness probe against disposable PostgreSQL. `git diff --check` passed. The brief built-server smoke covered dashboard routing and disabled collection; readiness itself was verified through injection and database-backed tests.
- **Next:** get the MacBook's macOS version and decide who needs network access. Then configure private versus public HTTPS routing, `launchd` and a restricted PostgreSQL role, and rehearse an off-device restore. The built server has not been run under a supervised service on the MacBook. Day 11 browser/device coverage and Day 12 query-index review remain open. All work remains local and uncommitted.

### November 8, 2026 — Retention query index reviewed

- **Changed:** added migration 006 with a B-tree index on `events.received_at`, matching the retention job's cutoff filter and oldest-first bounded delete. Existing indexes already cover project/date reports, project/session timelines, playback identity lookup and scroll deduplication; no additional report index was justified by the query review.
- **Verified:** disposable PostgreSQL migration suite passed 15/15 tests. It now confirms six migrations apply and repeat cleanly, the retention index exists, expiry preserves recent and other-project rows, and readiness can connect to the test database. `npm run check` also passed lint, TypeScript/Angular checks, 20 tests (8 database-only skips), and all workspace builds; `git diff --check` passed.
- **Status:** Day 12's index review is complete locally. No production database was modified. Day 14 still needs MacBook network/service/backup setup and rehearsal; Day 11 browser/device coverage remains partial.

### November 8, 2026 — Firefox browser privacy journey added

- **Changed:** added Playwright 1.65.0 as a development dependency and a repeatable `npm run test:browser-matrix` harness for the tracker/collector path.
- **Verified:** Firefox 159.0 passed consent gating, one sanitized page view, excluded-route suppression, withdrawal, request origin and no page errors. Existing Chromium verification remains passed.
- **Environment limit:** WebKit 27.2 binary downloaded but could not start because Linux system libraries are missing. The dependency installer was denied at sudo; no host packages were changed. This does not count as Safari. Physical mobile coverage also remains open. See [browser matrix](BROWSER_VERIFICATION.md).
- **Next:** run WebKit on a supported Mac host (MacBook may be suitable after its OS version is known), then continue the physical/device matrix. Day 14 staging details remain open. All work remains local/uncommitted.

### November 11, 2026 — MacBook service template prepared

- **Prepared:** added a per-user `launchd` LaunchAgent example for the Mac staging copy, with pinned Node path, explicit working directory, `.env` loading, restart-on-failure throttling, and separate output/error log paths. Documented that this only runs while the user is logged in; a persistent LaunchDaemon needs an administrator-selected service account and must not be inferred from this template.
- **Status:** template is uninstalled and still contains path placeholders. No macOS version, network access method, backup destination, or alert mailbox has been supplied. No MacBook or production service was touched.
- **Next:** replace/validate paths on the MacBook, settle whether user login or always-on operation is required, then configure HTTPS/private routing and off-device backup. Day 11 WebKit/Safari and physical-device coverage also remains open.

### November 12, 2026 — Linux boot-time startup selected for staging

- **Owner direction:** the MacBook Pro runs Linux, and staging should start automatically at OS boot without waiting for login.
- **Correction:** replaced the macOS plist/LaunchDaemon draft with a Linux systemd service template. It starts at boot under a dedicated unprivileged account, reads a root-owned environment file, restarts on failure and uses journald. Updated the staging runbook to Linux and added administrator install/enable/status/disable steps.
- **Release safeguard:** documented tracker/collector contract v1 compatibility, same-release deployment, and a versioned route requirement for future breaking changes because cached browser scripts can outlive their cache lifetime.
- **Runbook improvement:** corrected the service install source path, added a `systemd-analyze verify` gate, documented read-only root-owned release files and root-only environment secrets, and added local health/readiness checks after service startup. These steps remain unrun on the MacBook.
- **Validation/status:** the systemd verifier reached the unit but cannot complete while the template's Node path is still a placeholder. Distribution, architecture, administrator/service-account details and real install paths are not known. No service was installed. See [staging setup](STAGING_RECOVERY.md) and the [systemd unit template](../deploy/linux/site-analytics-staging.service.example).

### November 13, 2026 — Staging initialization steps documented

- **Runbook update:** added one-shot systemd commands to apply database migrations and provision the owner using the root-protected staging environment file before enabling the web service. Owner password is read without echo and sent to the provisioning utility over stdin.
- **Release preparation:** documented the current workspace runtime dependency, a clean-checkout build/check/prune procedure, and the files/workspace layout that must travel together. The embedded PostgreSQL suite stays on the compatible build machine, not the staging database.
- **Safety and verification:** migrations now require explicit `DATABASE_URL` instead of silently falling back to the development database; regression test added. `npm run check` passed (21 tests, 8 database-only skips, all builds), `npm run test:db` passed 15/15, and `git diff --check` passed. A temporary systemd unit copy passed `systemd-analyze verify`; only unrelated host system-unit deprecation warnings appeared.
- **Engagement acceptance:** added and passed a two-player native adapter regression proving playback IDs stay separate and switching to a second content item advances only its coverage. Marked the remaining overlay/feed/concurrent-playback requirement complete using the existing isolated MediaSpace browser evidence plus this test.
- **Release review:** added [release-readiness record](RELEASE_READINESS.md) and corrected the proposal status. It records the project as locally verified but not production-ready while Day 11 browser coverage and Day 14 host/recovery work remain open.
- **Status:** commands are documentation only and have not been run on the MacBook. Host distro/architecture, service account, actual Node path, database setup, HTTPS access, and backup destination remain unconfirmed. No staging service or external system was changed.

# Release readiness

Status: core MVP implementation and local verification are substantially
complete. This is a readiness record, not an approval to deploy. The project is
not ready for production rollout until the open browser and staging items below
are closed and the owner reviews the release candidate.

## Proposal acceptance walkthrough

| Proposal acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Two websites collect into separate projects with no report leakage | Verified locally with synthetic projects | [Browser journey](BROWSER_VERIFICATION.md), `scripts/check-mediaspace.mjs`, database suite |
| Direct views, client-side navigation, and retry deduplication | Verified locally | [Tracker contract](TRACKER.md), `tests/tracker.test.ts`, browser journey |
| Selected clicks, media overlays, document/feed scrolling | Verified with synthetic browser/database journeys | [Content actions](CONTENT_ACTIONS.md), [pilot evidence](PROGRESS.md), `scripts/check-mediaspace.mjs` |
| Consent denial/withdrawal, protected-content exclusion, URL privacy | Verified locally with synthetic sentinels | [Browser verification](BROWSER_VERIFICATION.md), `tests/tracker.test.ts`, `tests/native-video.test.ts` |
| Malformed, oversized and excessive requests are bounded/rejected | Verified locally | `tests/collection.test.ts`, collector tests in database suite |
| Dashboard totals match fixtures and timezone boundaries | Verified locally | [Reporting](REPORTING.md), [engagement reports](ENGAGEMENT_REPORTS.md), database suite |
| Tracker failure does not block the host site or grow unbounded queues | Verified locally | `tests/tracker.test.ts` |
| Owner authentication protects reporting and administration | Verified locally | [Owner access](OWNER_ACCESS.md), `tests/admin.test.ts`, `scripts/check-owner-dashboard.mjs` |
| Retention and isolated backup restoration | Verified locally; operational backup remains open | `tests/retention.test.ts`, `scripts/check-backup-restore.mjs`, [staging recovery](STAGING_RECOVERY.md) |
| Deployment, rollback, health, logs and disable procedures | Documented; not rehearsed on staging | [Staging and recovery](STAGING_RECOVERY.md), [systemd template](../deploy/linux/site-analytics-staging.service.example) |
| Defined desktop/mobile browser matrix and agreed performance targets | Partial; no final production ceiling agreed | [Browser verification](BROWSER_VERIFICATION.md), [measured pilot notes](PROGRESS.md) |

## Open release blockers

1. Complete the desktop/mobile browser matrix. WebKit could not launch in the
   current Linux environment because system libraries are missing; this is not
   Safari verification. Physical mobile-device coverage is also open.
2. Identify the staging MacBook's Linux distribution/version and CPU
   architecture, select its system-wide Node 24.21.0 path, and create the
   service account. Validate the actual unit and install it with administrator
   access.
3. Configure the staging PostgreSQL database, HTTPS/private access path and
   reverse proxy. Apply migrations, provision the owner, and complete the
   service restart, collection-disable, rollback, encrypted off-host backup and
   isolated restore rehearsals.
4. Set an independent service owner, alert destination and external uptime
   monitor. Verify the actual public routing and alert path from outside the
   host.
5. Resolve the MediaSpace legacy analytics report migration before live
   activation. Keep historical Experience counts, attribution, and new tracker
   metrics distinct until a reviewed migration/reconciliation plan is applied.
6. Revisit the measured operating ceiling on the actual staging hardware before
   any production expansion. Current rate/concurrency limits are per process;
   they do not establish multi-process capacity or cap the number of visitors.

## Release boundaries

- Keep collection disabled outside an explicitly approved, isolated pilot.
- MediaSpace integration evidence uses synthetic fixtures in an isolated
  development checkout. It is not a production deployment or live visitor
  measurement.
- Native HTML video is the supported MVP integration. Mux production integration
  remains deferred; the Mux prototype is not a release dependency.
- Session replay, billing/load-triggered fees, public signup and multi-instance
  scale are outside the first release.
- Repository changes remain local; no staging service, production service,
  production database or live-site tracker was changed. No deployment is
  authorized by this readiness review.

## Decision

Do not call this a production-ready release candidate yet. The core feature set
has repeatable local evidence, but Day 11 browser coverage and Day 14 staging,
backup and recovery exercises remain incomplete. Revisit this decision after the
staging host has been configured and the owner has reviewed the exact release
commit, production configuration and rollout/rollback procedure.
